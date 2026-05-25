import { useState, useRef, useCallback, useEffect } from "react"
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query"
import { useEmployees } from "@/hooks/useEmployees"
import { useCandidates } from "@/hooks/useCandidates"
import { useCommutes } from "@/hooks/useCommutes"
import { useAnalysis, useClearAnalysis } from "@/hooks/useAnalysis"
import { getSocket } from "@/lib/socket"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { TRAVEL_MODES, type CommuteEntry, type TravelMode } from "@/types"
import { showCandidateRoutes, clearRouteOverlays } from "@/components/map/MapContainer"
import { Sparkles, Copy, Loader2, ChevronDown, ChevronUp, ExternalLink, Trash2, Settings } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

export function Tab4_AIAnalysis() {
  const { data: employees = [] } = useEmployees()
  const { data: candidates = [] } = useCandidates()
  const { data: commutes = {} as Record<string, CommuteEntry> } = useCommutes()
  const { data: analysis } = useAnalysis()
  const clearAnalysisMutation = useClearAnalysis()
  const qc = useQueryClient()

  const [streaming, setStreaming] = useState(false)
  const [reasoning, setReasoning] = useState("")
  const [content, setContent] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [reasoningCollapsed, setReasoningCollapsed] = useState(false)
  const [activeRouteCand, setActiveRouteCand] = useState<string | null>(null)
  const reasoningRef = useRef<HTMLDivElement>(null)

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
    staleTime: 0,
    initialData: { amapKey: "", amapSecurityCode: "", amapServiceKey: "", deepseekApiKey: "", analysisPrompt: "" },
  })
  const updateSettingsMutation = useMutation({
    mutationFn: api.updateSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  })
  const [promptEditing, setPromptEditing] = useState(false)
  const [promptText, setPromptText] = useState("")
  const [promptSaving, setPromptSaving] = useState(false)

  const scrollToBottom = useCallback(() => {
    if (reasoningRef.current) reasoningRef.current.scrollTop = reasoningRef.current.scrollHeight
  }, [])

  const handleAnalyze = () => {
    setStreaming(true)
    setReasoning("")
    setContent("")
    setError(null)
    setReasoningCollapsed(false)
    getSocket().emit("analysis:start")
  }

  const handleCancel = () => {
    getSocket().emit("analysis:cancel")
    setStreaming(false)
  }

  useEffect(() => {
    const socket = getSocket()
    const onReasoning = (data: { chunk: string }) => { setReasoning((p) => p + data.chunk); scrollToBottom() }
    const onContent = (data: { chunk: string }) => setContent((p) => p + data.chunk)
    const onDone = () => { setStreaming(false); qc.invalidateQueries({ queryKey: ["analysis"] }) }
    const onError = (data: { message: string }) => { setError(data.message); setStreaming(false) }
    socket.on("analysis:reasoning", onReasoning)
    socket.on("analysis:content", onContent)
    socket.on("analysis:done", onDone)
    socket.on("analysis:error", onError)
    return () => {
      socket.off("analysis:reasoning", onReasoning)
      socket.off("analysis:content", onContent)
      socket.off("analysis:done", onDone)
      socket.off("analysis:error", onError)
    }
  }, [qc, scrollToBottom])

  const handleCopy = () => {
    navigator.clipboard.writeText(analysis?.reasoning || content)
  }

  const geocodedEmployees = employees.filter((e) => e.geocoded)
  const geocodedCandidates = candidates.filter((c) => c.geocoded)
  const hasCommutes = Object.keys(commutes).length > 0

  function getBestMode(employeeId: string, candidateId: string): TravelMode | null {
    const entry = commutes[`${employeeId}_${candidateId}`]
    if (!entry) return null
    let best: TravelMode | null = null
    let bestDur = Infinity
    for (const m of TRAVEL_MODES) {
      const r = entry[m.key]
      if (r?.duration && r?.distance && !r.error && r.duration < bestDur) {
        bestDur = r.duration
        best = m.key
      }
    }
    return best
  }

  const handleScoreClick = (candidateId: string) => {
    if (activeRouteCand === candidateId) {
      clearRouteOverlays()
      setActiveRouteCand(null)
      return
    }
    const cand = geocodedCandidates.find((c) => c.id === candidateId)
    if (!cand?.lng || !cand?.lat) return
    const trips = geocodedEmployees
      .filter((emp) => emp.lng && emp.lat)
      .map((emp) => {
        const mode = getBestMode(emp.id, candidateId) || "driving"
        return { lng: emp.lng!, lat: emp.lat!, bestMode: mode }
      })
    showCandidateRoutes(cand.lng, cand.lat, trips)
    setActiveRouteCand(candidateId)
  }

  const bestCandidateId = analysis
    ? Object.entries(analysis.scores).sort((a, b) => b[1].score - a[1].score)[0]?.[0]
    : null

  const openPromptEditor = () => {
    const defaultPrompt = `你是一位专业的办公选址分析师。请根据员工家庭地址、候选办公地点的通勤数据和租金进行评估：

1. 逐一评估每个候选地点的通勤便捷度和租金性价比
2. 从1-10分给每个候选地点打分（综合考虑通勤便利度和租金成本）
3. 推荐最优办公选址地理区域（中心坐标+搜索半径）

最后用JSON格式输出：
\`\`\`json
{"scores":{"candidateId":{"score":8.5,"summary":"评价"}},"recommendedArea":{"center":[lng,lat],"radius":3000,"description":"推荐理由","overlayType":"circle"}}
\`\`\`
仅输出JSON。`
    setPromptText(settings.analysisPrompt || defaultPrompt)
    setPromptEditing(true)
  }
  const handleSavePrompt = async () => {
    setPromptSaving(true)
    try {
      await updateSettingsMutation.mutateAsync({ analysisPrompt: promptText })
      setPromptEditing(false)
    } catch { /* ignore */ }
    setPromptSaving(false)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4">
        <h2 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" /> AI 智能分析
        </h2>
        <p className="text-sm text-muted-foreground">基于 DeepSeek 大模型，对通勤数据进行智能评估，推荐最优选址区域</p>
      </div>

      <div className="px-6 pb-4 flex items-center gap-2">
        <Button onClick={handleAnalyze} disabled={!hasCommutes || streaming} size="sm">
          {streaming ? (
            <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> 分析中...</>
          ) : (
            <><Sparkles className="w-3.5 h-3.5 mr-1" /> 开始分析</>
          )}
        </Button>
        {streaming && (
          <Button onClick={handleCancel} variant="ghost" size="sm" className="text-destructive h-8 text-xs">取消</Button>
        )}
        {analysis && (
          <Button onClick={handleCopy} variant="ghost" size="sm" className="h-8 text-xs">
            <Copy className="w-3.5 h-3.5 mr-1" /> 复制报告
          </Button>
        )}
        {analysis && (
          <Button onClick={() => clearAnalysisMutation.mutate()} variant="ghost" size="sm" className="h-8 text-xs text-destructive hover:text-destructive">
            <Trash2 className="w-3.5 h-3.5 mr-1" /> 清除分析
          </Button>
        )}
        <button onClick={openPromptEditor} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-1">
          <Settings className="w-3 h-3" />
          {settings.analysisPrompt ? "修改提示词" : "自定义提示词"}
        </button>
        {!hasCommutes && !streaming && (
          <span className="text-xs text-muted-foreground">请先在「通勤对比」中计算路线数据</span>
        )}
      </div>

      <Separator />

      {(streaming || reasoning || content) && (
        <div className="flex-1 overflow-auto px-6 py-3 space-y-3">
          {(reasoning || streaming) && (
            <div className="rounded-lg border border-border bg-card">
              <button onClick={() => setReasoningCollapsed(!reasoningCollapsed)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  推理过程
                </span>
                {reasoningCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
              {!reasoningCollapsed && (
                <div ref={reasoningRef} className="px-4 pb-4 max-h-60 overflow-auto text-xs text-muted-foreground font-mono leading-relaxed whitespace-pre-wrap border-t border-border">
                  {reasoning}
                  {streaming && <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5 align-middle" />}
                </div>
              )}
            </div>
          )}

          {content && (
            <div className="rounded-lg border border-border bg-card p-4">
              <pre className="text-xs text-muted-foreground font-mono leading-relaxed whitespace-pre-wrap">{content}</pre>
              {streaming && <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5" />}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="px-6 py-3">
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
        </div>
      )}

      {analysis && !streaming && (
        <div className="px-6 pb-4 space-y-3 overflow-auto">
          <Separator />
          <h3 className="text-sm font-semibold text-foreground">评分结果</h3>
          <div className="flex gap-2 overflow-x-auto">
            {Object.entries(analysis.scores)
              .sort((a, b) => b[1].score - a[1].score)
              .map(([candId, { score, summary }]) => {
                const cand = geocodedCandidates.find((c) => c.id === candId)
                const isBest = candId === bestCandidateId
                const isActive = activeRouteCand === candId
                return (
                  <div key={candId} onClick={() => handleScoreClick(candId)}
                    className={cn(
                      "w-[240px] shrink-0 rounded-lg border px-3 py-3 transition-all cursor-pointer",
                      isActive ? "border-primary bg-accent/40" :
                      isBest ? "border-primary/40 bg-accent/50" : "border-border bg-card hover:border-primary/30"
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-1.5">
                      {isBest && <span className="text-sm">⭐</span>}
                      <span className="text-sm font-medium text-foreground max-w-[140px] truncate">{cand?.name || candId}</span>
                      {isBest && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-accent text-primary border border-primary/20">推荐</span>}
                    </div>
                    <div className="text-2xl font-bold text-primary mb-1 font-mono">{score.toFixed(1)}</div>
                    <div className="flex gap-0.5 mb-2">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <div key={j} className={cn("h-1.5 w-4 rounded-full", j < Math.round(score / 2) ? "bg-primary" : "bg-border")} />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">{summary}</p>
                  </div>
                )
              })}
          </div>

          {analysis.recommendedArea && (
            <>
              <Separator />
              <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-accent/30 px-4 py-3">
                <ExternalLink className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-sm font-medium text-primary mb-1">推荐选址区域</h4>
                  <p className="text-sm text-foreground/70 break-words">{analysis.recommendedArea.description}</p>
                  <p className="text-xs text-muted-foreground mt-1 font-mono">
                    中心: [{analysis.recommendedArea.center[0].toFixed(4)}, {analysis.recommendedArea.center[1].toFixed(4)}] · 半径: {(analysis.recommendedArea.radius / 1000).toFixed(1)}km
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {!streaming && !analysis && !error && hasCommutes && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
            <p className="text-sm text-muted-foreground">点击「开始分析」让 AI 评估候选地点</p>
            <p className="text-xs text-muted-foreground mt-1">分析过程将实时展示推理步骤</p>
          </div>
        </div>
      )}

      <Dialog open={promptEditing} onOpenChange={(v) => { if (!v) setPromptEditing(false) }}>
        <DialogContent className="w-[560px] max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-4 h-4" /> 自定义分析提示词
            </DialogTitle>
          </DialogHeader>
          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            rows={12}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y"
          />
          <p className="text-xs text-muted-foreground">修改后点击保存即可生效，下次分析将使用自定义提示词</p>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setPromptEditing(false)}>取消</Button>
            <Button size="sm" onClick={handleSavePrompt} disabled={promptSaving}>
              {promptSaving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
