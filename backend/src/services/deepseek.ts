import { getSettings } from "./storage.js"
import type { Employee, Candidate, CommuteEntry } from "../types.js"
import { TRAVEL_MODES } from "../types.js"

export interface StreamCallbacks {
  onReasoning: (chunk: string) => void
  onContent: (chunk: string) => void
}

export function buildPrompt(
  employees: Employee[],
  candidates: Candidate[],
  commutes: Record<string, CommuteEntry>
) {
  const candScores: Record<string, Record<string, { totalDist: number; totalDur: number; count: number }>> = {}

  for (const key in commutes) {
    const entry = commutes[key]
    for (const m of TRAVEL_MODES) {
      const r = entry[m.key]
      if (r?.distance && r?.duration) {
        if (!candScores[entry.candidateId]) candScores[entry.candidateId] = {}
        if (!candScores[entry.candidateId][m.key]) {
          candScores[entry.candidateId][m.key] = { totalDist: 0, totalDur: 0, count: 0 }
        }
        candScores[entry.candidateId][m.key].totalDist += r.distance
        candScores[entry.candidateId][m.key].totalDur += r.duration
        candScores[entry.candidateId][m.key].count++
      }
    }
  }

  const summary = candidates.map((c) => {
    const modes: Record<string, { avgDist: number; avgDur: number; coverage: string }> = {}
    for (const m of TRAVEL_MODES) {
      const cs = candScores[c.id]?.[m.key]
      modes[m.label] = cs && cs.count > 0
        ? { avgDist: Math.round(cs.totalDist / cs.count), avgDur: Math.round(cs.totalDur / cs.count / 60), coverage: `${cs.count}/${employees.length}` }
        : { avgDist: 0, avgDur: 0, coverage: `0/${employees.length}` }
    }
    return { id: c.id, name: c.name, address: c.address, rent: c.rent, location: `[${c.lng}, ${c.lat}]`, commuteModes: modes }
  })

  return {
    employees: employees.map((e) => ({ name: e.name, address: e.address, location: `[${e.lng}, ${e.lat}]` })),
    candidates: summary,
    employeeCount: employees.length,
    totalCommutes: Object.keys(commutes).length,
  }
}

export async function streamDeepSeekAnalysis(
  employees: Employee[],
  candidates: Candidate[],
  commutes: Record<string, CommuteEntry>,
  callbacks: StreamCallbacks,
  signal?: { aborted: boolean }
): Promise<string> {
  const settings = getSettings()
  if (!settings.deepseekApiKey) throw new Error("DeepSeek API Key 未配置")

  const data = buildPrompt(employees, candidates, commutes)
  let fullContent = ""

  const defaultPrompt = `你是一位专业的办公选址分析师。请根据提供的员工通勤数据和候选地点租金进行综合评估。

## 数据说明
- avgDur：平均通勤耗时（分钟），取所有员工在该出行方式下的平均值
- avgDist：平均通勤距离（米）
- coverage：覆盖比例，如 3/5 表示 5 名员工中有 3 名可通过该方式到达
- rent：月租金（元），null 表示未填写

## 评分标准（1-10分）
- 通勤权重占 70%，租金权重占 30%
- 通勤评估：以驾车和公交为主要参考，步行和骑行为辅助
  - 驾车平均耗时 <20分钟 为优秀，<40分钟 为良好，>60分钟 为较差
  - 公交覆盖率越高越好，耗时越短越好
- 租金评估：结合通勤便利度判断性价比
  - 通勤便利但租金过高，适当扣分
  - 通勤一般但租金低廉，适当加分
- 评分应有区分度，不要所有候选地点都给相近分数

## 推荐区域
- center：推荐选址的地理中心坐标 [lng, lat]，应综合考虑评分最高的1-2个候选地点位置
- radius：搜索半径（米），建议 2000-5000
- description：简要说明推荐理由，提及通勤优势和租金因素
- overlayType：固定为 "circle"

## 输出要求
- summary 用简洁的1-2句话评价，包含关键数据（如最短通勤时间、租金等）
- 严格使用以下JSON格式，key 必须使用候选地点的 id 字段
- 只输出JSON，不要输出其他内容

\`\`\`json
{"scores":{"candidateId":{"score":8.5,"summary":"驾车平均25分钟，公交覆盖4/5，租金适中，综合性价比高"}},"recommendedArea":{"center":[113.65,34.76],"radius":3000,"description":"该区域靠近评分最高的XX，驾车通勤便利，周边公交线路密集","overlayType":"circle"}}
\`\`\``

  const systemPrompt = settings.analysisPrompt?.trim() || defaultPrompt

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.deepseekApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(data, null, 2) },
      ],
      temperature: 0.3,
      max_tokens: 4096,
    }),
  })

  if (!response.ok) {
    if (response.status === 401) throw new Error("DeepSeek API Key 无效")
    if (response.status === 429) throw new Error("请求过于频繁，请稍后重试")
    throw new Error(`DeepSeek API 错误 (${response.status})`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error("无法读取响应流")

  const decoder = new TextDecoder("utf-8")
  let buffer = ""

  try {
    while (true) {
      if (signal?.aborted) break
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() || ""

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith("data: ")) continue
        const d = trimmed.slice(6)
        if (d === "[DONE]") break

        try {
          const parsed = JSON.parse(d)
          const delta = parsed.choices?.[0]?.delta
          if (delta?.reasoning_content) callbacks.onReasoning(delta.reasoning_content)
          if (delta?.content) {
            fullContent += delta.content
            callbacks.onContent(delta.content)
          }
        } catch { /* skip */ }
      }
    }
  } finally {
    reader.releaseLock()
  }

  return fullContent
}

export function extractAnalysisJSON(text: string): {
  scores: Record<string, { score: number; summary: string }>
  recommendedArea: {
    center: [number, number]
    radius: number
    description: string
    overlayType: "circle" | "polygon"
  } | null
} | null {
  const jsonBlock = text.match(/```json\s*([\s\S]*?)\s*```/)
  const jsonStr = jsonBlock ? jsonBlock[1] : text
  const match = jsonStr.match(/\{[\s\S]*\}/)
  if (!match) return null
  try { return JSON.parse(match[0]) } catch { return null }
}
