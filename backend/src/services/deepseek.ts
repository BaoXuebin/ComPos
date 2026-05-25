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
    return { id: c.id, name: c.name, address: c.address, location: `[${c.lng}, ${c.lat}]`, commuteModes: modes }
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

  const systemPrompt = `你是一位专业的办公选址分析师。请根据员工家庭地址和候选办公地点的通勤数据进行评估：

1. 逐一评估每个候选地点的通勤便捷度
2. 从1-10分给每个候选地点打分
3. 推荐最优办公选址地理区域（中心坐标+搜索半径）

最后用JSON格式输出：
\`\`\`json
{"scores":{"candidateId":{"score":8.5,"summary":"评价"}},"recommendedArea":{"center":[lng,lat],"radius":3000,"description":"推荐理由","overlayType":"circle"}}
\`\`\`
仅输出JSON。`

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
