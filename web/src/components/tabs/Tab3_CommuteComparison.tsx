import { useState, useMemo, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useEmployees } from "@/hooks/useEmployees"
import { useCandidates } from "@/hooks/useCandidates"
import { useCommutes, useClearCommutes } from "@/hooks/useCommutes"
import { getSocket } from "@/lib/socket"
import { showRoutesOnMap, locateOnMap, showCandidateRoutes, clearRouteOverlays } from "@/components/map/MapContainer"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { TRAVEL_MODES, type TravelMode, type CommuteEntry, type CommuteResult } from "@/types"
import { Zap, RotateCcw, Medal, Car, Bus, Footprints, Bike } from "lucide-react"

const MODE_ICONS: Record<TravelMode, typeof Car> = {
  driving: Car,
  transit: Bus,
  walking: Footprints,
  cycling: Bike,
}

const MODE_LABELS: Record<TravelMode, string> = {
  driving: "驾车",
  transit: "公交",
  walking: "步行",
  cycling: "骑行",
}

const DURATION_THRESHOLDS = { good: 30 * 60, medium: 60 * 60 }
const DISTANCE_THRESHOLDS = { good: 10000, medium: 25000 }

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`
  if (seconds < 3600) return `${Math.round(seconds / 60)}分钟`
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return `${h}小时${m}分钟`
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters}米`
  return `${(meters / 1000).toFixed(1)}公里`
}

function getHeatClass(value: number, thresholds: typeof DURATION_THRESHOLDS): string {
  if (value <= thresholds.good) return "text-green-600"
  if (value <= thresholds.medium) return "text-amber-600"
  return "text-destructive"
}

function getBestResult(entry: CommuteEntry | undefined): { result: CommuteResult; mode: TravelMode } | null {
  if (!entry) return null
  let best: { result: CommuteResult; mode: TravelMode } | null = null
  for (const m of TRAVEL_MODES) {
    const r = entry[m.key]
    if (r?.duration && r?.distance && !r.error) {
      if (!best || r.duration < best.result.duration!) {
        best = { result: r, mode: m.key }
      }
    }
  }
  return best
}

function getFirstError(entry: CommuteEntry | undefined): string | null {
  if (!entry) return null
  for (const m of TRAVEL_MODES) {
    if (entry[m.key]?.error) return entry[m.key]!.error!
  }
  return null
}

function getMedalEmoji(rank: number): string {
  if (rank === 0) return "\u{1F947}"
  if (rank === 1) return "\u{1F948}"
  if (rank === 2) return "\u{1F949}"
  return ""
}

export function Tab3_CommuteComparison() {
  const { data: employees = [] } = useEmployees()
  const { data: candidates = [] } = useCandidates()
  const { data: commutes = {} as Record<string, CommuteEntry> } = useCommutes()
  const clearCommutesMutation = useClearCommutes()
  const qc = useQueryClient()

  const [calculating, setCalculating] = useState(false)
  const [progress, setProgress] = useState({ completed: 0, total: 0, failed: 0 })
  const [error, setError] = useState<string | null>(null)
  const [activeRouteCand, setActiveRouteCand] = useState<string | null>(null)

  const geocodedEmployees = employees.filter((e) => e.geocoded)
  const geocodedCandidates = candidates.filter((c) => c.geocoded)

  const handleCalculate = () => {
    setCalculating(true)
    setProgress({ completed: 0, total: 0, failed: 0 })
    setError(null)
    getSocket().emit("commute:calculate")
  }

  const handleCancel = () => {
    getSocket().emit("commute:cancel")
    setCalculating(false)
  }

  useEffect(() => {
    const socket = getSocket()
    const onProgress = (data: { completed: number; total: number; failed: number }) => setProgress(data)
    const onDone = (data: { total: number; failed: number }) => {
      setCalculating(false)
      setProgress({ completed: data.total, total: data.total, failed: data.failed })
      qc.invalidateQueries({ queryKey: ["commutes"] })
    }
    const onError = (data: { message: string }) => {
      setError(data.message)
      setCalculating(false)
    }
    socket.on("commute:progress", onProgress)
    socket.on("commute:done", onDone)
    socket.on("commute:error", onError)
    return () => {
      socket.off("commute:progress", onProgress)
      socket.off("commute:done", onDone)
      socket.off("commute:error", onError)
    }
  }, [qc])

  const handleCellClick = (emp: typeof geocodedEmployees[0], cand: typeof geocodedCandidates[0]) => {
    if (emp.lng && emp.lat && cand.lng && cand.lat) {
      showRoutesOnMap(
        { lng: emp.lng, lat: emp.lat, label: emp.name },
        { lng: cand.lng, lat: cand.lat, label: cand.name }
      )
    }
  }

  const handleRankingClick = (cand: typeof geocodedCandidates[0]) => {
    if (activeRouteCand === cand.id) {
      clearRouteOverlays()
      setActiveRouteCand(null)
      return
    }
    if (!cand.lng || !cand.lat) return
    const trips = geocodedEmployees
      .filter((emp) => emp.lng && emp.lat)
      .map((emp) => {
        const best = bestResults.get(`${emp.id}_${cand.id}`)
        return { lng: emp.lng!, lat: emp.lat!, bestMode: best?.mode || "driving" }
      })
    showCandidateRoutes(cand.lng, cand.lat, trips)
    setActiveRouteCand(cand.id)
  }

  // Best results per pair (cached for rankings + table)
  const bestResults = useMemo(() => {
    const map = new Map<string, { duration: number; distance: number; mode: TravelMode }>()
    for (const emp of geocodedEmployees) {
      for (const cand of geocodedCandidates) {
        const key = `${emp.id}_${cand.id}`
        const best = getBestResult(commutes[key])
        if (best) {
          map.set(key, { duration: best.result.duration!, distance: best.result.distance!, mode: best.mode })
        }
      }
    }
    return map
  }, [commutes, geocodedEmployees, geocodedCandidates])

  const rankings = useMemo(() => {
    const scores: { candidateId: string; name: string; avgDuration: number; avgDistance: number; count: number }[] = []
    for (const cand of geocodedCandidates) {
      let totalDur = 0, totalDist = 0, count = 0
      for (const emp of geocodedEmployees) {
        const best = bestResults.get(`${emp.id}_${cand.id}`)
        if (best) {
          totalDur += best.duration
          totalDist += best.distance
          count++
        }
      }
      if (count > 0) {
        scores.push({ candidateId: cand.id, name: cand.name, avgDuration: totalDur / count, avgDistance: totalDist / count, count })
      }
    }
    scores.sort((a, b) => a.avgDuration - b.avgDuration)
    return scores
  }, [geocodedCandidates, geocodedEmployees, bestResults])

  const canCalculate = geocodedEmployees.length > 0 && geocodedCandidates.length > 0

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4">
        <h2 className="text-lg font-semibold text-foreground mb-1">通勤对比</h2>
        <p className="text-sm text-muted-foreground">计算每位员工到各候选地点的通勤时间与距离，自动展示最快方案</p>
      </div>

      <div className="px-6 pb-4 space-y-3">
        <div className="flex items-center gap-2">
          <Button onClick={handleCalculate} disabled={!canCalculate || calculating} size="sm">
            <Zap className="w-3.5 h-3.5 mr-1" />{calculating ? "计算中..." : "计算全部路线"}
          </Button>
          {calculating && (
            <Button onClick={handleCancel} variant="ghost" size="sm" className="text-destructive h-8 text-xs">取消</Button>
          )}
          <Button onClick={() => clearCommutesMutation.mutate()} variant="ghost" size="sm" className="h-8 text-xs">
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> 清除结果
          </Button>
        </div>

        {calculating && progress.total > 0 && (
          <div className="space-y-1.5">
            <Progress value={(progress.completed / progress.total) * 100} className="h-1.5" />
            <p className="text-xs text-muted-foreground">{progress.completed}/{progress.total} · 失败 {progress.failed}</p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
        )}
      </div>

      <Separator />

      <div className="flex-1 overflow-auto px-6 pb-4">
        {geocodedEmployees.length === 0 || geocodedCandidates.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            请先在「地址录入」和「候选地点」中添加数据并完成地理编码
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 text-muted-foreground font-medium sticky left-0 bg-background z-10">员工 \ 候选</th>
                  {geocodedCandidates.map((c) => (
                    <th key={c.id} onClick={() => locateOnMap(c.lng!, c.lat!)} className="text-center py-2 px-3 text-foreground font-medium min-w-[100px] cursor-pointer hover:text-primary transition-colors">{c.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {geocodedEmployees.map((emp) => (
                  <tr key={emp.id} className="border-b border-border/50 hover:bg-accent/50">
                    <td onClick={() => locateOnMap(emp.lng!, emp.lat!)} className="py-2 px-2 text-muted-foreground font-medium sticky left-0 bg-background z-10 cursor-pointer hover:text-primary transition-colors">{emp.name}</td>
                    {geocodedCandidates.map((cand) => {
                      const pairKey = `${emp.id}_${cand.id}`
                      const best = bestResults.get(pairKey)
                      const errMsg = !best ? getFirstError(commutes[pairKey]) : null
                      return (
                        <td key={cand.id} onClick={() => best && handleCellClick(emp, cand)}
                          className={cn("text-center py-2 px-3 cursor-pointer transition-colors rounded", best && "hover:bg-accent")}
                        >
                          {best ? (
                            <div className="space-y-0.5">
                              <div className="flex items-center justify-center gap-1">
                                {(() => { const Icon = MODE_ICONS[best.mode]; return <Icon className="w-3 h-3 text-muted-foreground shrink-0" /> })()}
                                <span className={cn("font-mono font-medium", getHeatClass(best.duration, DURATION_THRESHOLDS))}>
                                  {formatDuration(best.duration)}
                                </span>
                              </div>
                              <div className={cn("font-mono", getHeatClass(best.distance, DISTANCE_THRESHOLDS))}>
                                {formatDistance(best.distance)}
                              </div>
                            </div>
                          ) : errMsg ? (
                            <span className="text-muted-foreground text-[11px] leading-tight" title={errMsg}>{errMsg}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
                <tr className="border-t border-primary/30 bg-accent/30 font-medium">
                  <td className="py-2 px-2 text-primary sticky left-0 bg-background z-10">平均</td>
                  {geocodedCandidates.map((cand) => {
                    let totalDur = 0, totalDist = 0, count = 0
                    for (const emp of geocodedEmployees) {
                      const best = bestResults.get(`${emp.id}_${cand.id}`)
                      if (best) {
                        totalDur += best.duration
                        totalDist += best.distance
                        count++
                      }
                    }
                    const avgDur = count > 0 ? totalDur / count : null
                    const avgDist = count > 0 ? totalDist / count : null
                    return (
                      <td key={cand.id} className="text-center py-2 px-3">
                        {avgDur != null ? (
                          <div className="space-y-0.5">
                            <div className={cn("font-mono", getHeatClass(avgDur, DURATION_THRESHOLDS))}>{formatDuration(avgDur)}</div>
                            <div className={cn("font-mono", getHeatClass(avgDist!, DISTANCE_THRESHOLDS))}>{formatDistance(avgDist!)}</div>
                          </div>
                        ) : <span className="text-muted-foreground">-</span>}
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rankings.length > 0 && (
        <div className="px-6 pb-4">
          <Separator className="mb-3" />
          <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <Medal className="w-4 h-4 text-amber-500" /> 排行榜 · 最快方案
          </h3>
          <div className="flex gap-2 overflow-x-auto">
            {rankings.map((item, i) => {
              const cand = geocodedCandidates.find((c) => c.id === item.candidateId)!
              const isActive = activeRouteCand === item.candidateId
              return (
              <div key={item.candidateId} onClick={() => handleRankingClick(cand)}
                className={cn(
                  "w-[240px] shrink-0 rounded-lg border px-3 py-2.5 transition-all cursor-pointer",
                  isActive ? "border-primary bg-accent/40" :
                  i === 0 ? "border-amber-500/40 bg-amber-50/30" : "border-border bg-card hover:border-primary/30"
                )}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-sm">{getMedalEmoji(i)}</span>
                  <span className="text-sm font-medium text-foreground max-w-[140px] truncate">{item.name}</span>
                </div>
                <div className="space-y-0.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">平均时间</span>
                    <span className={cn("font-mono", getHeatClass(item.avgDuration, DURATION_THRESHOLDS))}>{formatDuration(item.avgDuration)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">平均距离</span>
                    <span className={cn("font-mono", getHeatClass(item.avgDistance, DISTANCE_THRESHOLDS))}>{formatDistance(item.avgDistance)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">数据覆盖</span>
                    <span className="text-muted-foreground">{item.count}/{geocodedEmployees.length}</span>
                  </div>
                </div>
              </div>
            )})}
          </div>
        </div>
      )}
    </div>
  )
}
