import { useState, useMemo, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useEmployees } from "@/hooks/useEmployees"
import { useCandidates } from "@/hooks/useCandidates"
import { useCommutes, useClearCommutes } from "@/hooks/useCommutes"
import { getSocket } from "@/lib/socket"
import { showRoutesOnMap, locateOnMap } from "@/components/map/MapContainer"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { TRAVEL_MODES, type TravelMode, type CommuteEntry } from "@/types"
import { Zap, RotateCcw, Medal, Car, Bus, Footprints, Bike } from "lucide-react"

const MODE_ICONS: Record<TravelMode, typeof Car> = {
  driving: Car,
  transit: Bus,
  walking: Footprints,
  cycling: Bike,
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

  const [selectedModes, setSelectedModes] = useState<Set<TravelMode>>(new Set<TravelMode>(["driving", "transit"]))
  const [calculating, setCalculating] = useState(false)
  const [progress, setProgress] = useState({ completed: 0, total: 0, failed: 0 })
  const [displayMode, setDisplayMode] = useState<TravelMode>("driving")
  const [metricType, setMetricType] = useState<"duration" | "distance">("duration")
  const [error, setError] = useState<string | null>(null)

  const geocodedEmployees = employees.filter((e) => e.geocoded)
  const geocodedCandidates = candidates.filter((c) => c.geocoded)

  const toggleMode = (mode: TravelMode) => {
    setSelectedModes((prev) => {
      const next = new Set(prev)
      if (next.has(mode)) next.delete(mode)
      else next.add(mode)
      return next
    })
  }

  const handleCalculate = () => {
    setCalculating(true)
    setProgress({ completed: 0, total: 0, failed: 0 })
    setError(null)
    getSocket().emit("commute:calculate", { modes: Array.from(selectedModes) })
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
        { lng: cand.lng, lat: cand.lat, label: cand.name },
        displayMode
      )
    }
  }

  const rankings = useMemo(() => {
    const scores: { candidateId: string; name: string; avgDuration: number; avgDistance: number; count: number }[] = []
    for (const cand of geocodedCandidates) {
      let totalDur = 0, totalDist = 0, count = 0
      for (const emp of geocodedEmployees) {
        const key = `${emp.id}_${cand.id}`
        const entry = commutes[key]
        const result = entry?.[displayMode]
        if (result?.duration && result?.distance) {
          totalDur += result.duration
          totalDist += result.distance
          count++
        }
      }
      if (count > 0) {
        scores.push({ candidateId: cand.id, name: cand.name, avgDuration: totalDur / count, avgDistance: totalDist / count, count })
      }
    }
    scores.sort((a, b) => a.avgDuration - b.avgDuration)
    return scores
  }, [geocodedCandidates, geocodedEmployees, commutes, displayMode])

  const canCalculate = geocodedEmployees.length > 0 && geocodedCandidates.length > 0 && selectedModes.size > 0

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4">
        <h2 className="text-lg font-semibold text-foreground mb-1">通勤对比</h2>
        <p className="text-sm text-muted-foreground">计算每位员工到各候选地点的通勤时间与距离</p>
      </div>

      <div className="px-6 pb-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground mr-1">计算方式:</span>
          {TRAVEL_MODES.map((m) => {
            const Icon = MODE_ICONS[m.key]
            const selected = selectedModes.has(m.key)
            return (
              <button key={m.key} onClick={() => toggleMode(m.key)} disabled={calculating}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                  selected ? "bg-accent border-primary text-primary" : "bg-card border-border text-muted-foreground hover:border-primary/30"
                )}
              >
                <Icon className="w-3.5 h-3.5" />{m.label}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">查看:</span>
          {TRAVEL_MODES.map((m) => (
            <button key={m.key} onClick={() => setDisplayMode(m.key)}
              className={cn("text-xs px-2 py-0.5 rounded transition-colors", displayMode === m.key ? "text-primary bg-accent" : "text-muted-foreground hover:text-foreground")}
            >{m.label}</button>
          ))}
          <Separator className="h-4" />
          <button onClick={() => setMetricType("duration")}
            className={cn("text-xs px-2 py-0.5 rounded transition-colors", metricType === "duration" ? "text-primary bg-accent" : "text-muted-foreground hover:text-foreground")}
          >时间</button>
          <button onClick={() => setMetricType("distance")}
            className={cn("text-xs px-2 py-0.5 rounded transition-colors", metricType === "distance" ? "text-primary bg-accent" : "text-muted-foreground hover:text-foreground")}
          >距离</button>
        </div>

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
                    <th key={c.id} onClick={() => locateOnMap(c.lng!, c.lat!)} className="text-center py-2 px-3 text-foreground font-medium min-w-[90px] cursor-pointer hover:text-primary transition-colors">{c.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {geocodedEmployees.map((emp) => (
                  <tr key={emp.id} className="border-b border-border/50 hover:bg-accent/50">
                    <td onClick={() => locateOnMap(emp.lng!, emp.lat!)} className="py-2 px-2 text-muted-foreground font-medium sticky left-0 bg-background z-10 cursor-pointer hover:text-primary transition-colors">{emp.name}</td>
                    {geocodedCandidates.map((cand) => {
                      const key = `${emp.id}_${cand.id}`
                      const entry = commutes[key]
                      const result = entry?.[displayMode]
                      const value = result?.[metricType]
                      const isError = result?.error
                      return (
                        <td key={cand.id} onClick={() => result && !isError && handleCellClick(emp, cand)}
                          className={cn("text-center py-2 px-3 cursor-pointer transition-colors rounded", result && !isError && "hover:bg-accent")}
                        >
                          {isError ? (
                            <span className="text-muted-foreground text-xs">-</span>
                          ) : value ? (
                            <span className={cn("font-mono", getHeatClass(value, metricType === "duration" ? DURATION_THRESHOLDS : DISTANCE_THRESHOLDS))}>
                              {metricType === "duration" ? formatDuration(value) : formatDistance(value)}
                            </span>
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
                    let total = 0, count = 0
                    for (const emp of geocodedEmployees) {
                      const key = `${emp.id}_${cand.id}`
                      const val = commutes[key]?.[displayMode]?.[metricType]
                      if (val != null) { total += val; count++ }
                    }
                    const avg = count > 0 ? total / count : null
                    return (
                      <td key={cand.id} className="text-center py-2 px-3">
                        {avg != null ? (
                          <span className={cn("font-mono", getHeatClass(avg, metricType === "duration" ? DURATION_THRESHOLDS : DISTANCE_THRESHOLDS))}>
                            {metricType === "duration" ? formatDuration(avg) : formatDistance(avg)}
                          </span>
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
            <Medal className="w-4 h-4 text-amber-500" /> 排行榜 · {TRAVEL_MODES.find((m) => m.key === displayMode)?.label} · {metricType === "duration" ? "时间" : "距离"}
          </h3>
          <div className="flex gap-2">
            {rankings.map((item, i) => (
              <div key={item.candidateId}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2.5 transition-all",
                  i === 0 ? "border-amber-500/40 bg-amber-50/30" : "border-border bg-card"
                )}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-sm">{getMedalEmoji(i)}</span>
                  <span className="text-sm font-medium text-foreground">{item.name}</span>
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
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
