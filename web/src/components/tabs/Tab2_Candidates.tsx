import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useCandidates, useCreateCandidate, useUpdateCandidate, useDeleteCandidate } from "@/hooks/useCandidates"
import { api, type GeocodeResult } from "@/lib/api"
import type { Candidate } from "@/types"
import { Plus, Trash2, MapPin, Loader2, Navigation, Pencil } from "lucide-react"
import { locateOnMap } from "@/components/map/MapContainer"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

export function Tab2_Candidates() {
  const { data: candidates = [] } = useCandidates()
  const createMutation = useCreateCandidate()
  const updateMutation = useUpdateCandidate()
  const deleteMutation = useDeleteCandidate()

  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [rent, setRent] = useState("")
  const [geocodingId, setGeocodingId] = useState<string | null>(null)

  // Dialog editing
  const [editTarget, setEditTarget] = useState<Candidate | null>(null)
  const [dlgName, setDlgName] = useState("")
  const [dlgAddress, setDlgAddress] = useState("")
  const [dlgRent, setDlgRent] = useState("")

  const openEditDialog = (cand: Candidate) => {
    setEditTarget(cand)
    setDlgName(cand.name)
    setDlgAddress(cand.address)
    setDlgRent(cand.rent != null ? String(cand.rent) : "")
  }

  const saveDialog = () => {
    if (!editTarget || !dlgName.trim() || !dlgAddress.trim()) return
    const rentVal = dlgRent.trim() ? Number(dlgRent.trim()) : null
    updateMutation.mutate({ id: editTarget.id, data: { name: dlgName.trim(), address: dlgAddress.trim(), rent: isNaN(rentVal as number) ? null : rentVal } })
    setEditTarget(null)
  }

  const handleAdd = () => {
    if (!name.trim() || !address.trim()) return
    const rentVal = rent.trim() ? Number(rent.trim()) : null
    createMutation.mutate({ name: name.trim(), address: address.trim(), rent: isNaN(rentVal as number) ? null : rentVal })
    setName("")
    setAddress("")
    setRent("")
  }

  const handleGeocode = async (cand: Candidate) => {
    setGeocodingId(cand.id)
    try {
      const result: GeocodeResult = await api.geocodeAddress(cand.address)
      updateMutation.mutate({ id: cand.id, data: { lng: result.lng, lat: result.lat, geocoded: true, geocodeError: null } })
    } catch (err: any) {
      updateMutation.mutate({ id: cand.id, data: { geocodeError: err.message } })
    }
    setGeocodingId(null)
  }

  const handleBatchGeocode = async () => {
    const ungeocoded = candidates.filter((c) => !c.geocoded)
    for (const cand of ungeocoded) {
      setGeocodingId(cand.id)
      try {
        const result: GeocodeResult = await api.geocodeAddress(cand.address)
        updateMutation.mutate({ id: cand.id, data: { lng: result.lng, lat: result.lat, geocoded: true, geocodeError: null } })
      } catch (err: any) {
        updateMutation.mutate({ id: cand.id, data: { geocodeError: err.message } })
      }
      await new Promise((r) => setTimeout(r, 150))
    }
    setGeocodingId(null)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4">
        <h2 className="text-lg font-semibold text-foreground mb-1">候选办公地点</h2>
        <p className="text-sm text-muted-foreground">添加并管理候选办公地址，系统将在地图上标记</p>
      </div>

      <div className="px-6 pb-4">
        <div className="flex gap-3 items-end">
          <div className="w-36">
            <label className="block text-xs text-muted-foreground mb-1">地点名称</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="国贸CBD" onKeyDown={(e) => e.key === "Enter" && handleAdd()} className="h-9" />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-muted-foreground mb-1">详细地址</label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="北京市朝阳区国贸大厦" onKeyDown={(e) => e.key === "Enter" && handleAdd()} className="h-9" />
          </div>
          <div className="w-28">
            <label className="block text-xs text-muted-foreground mb-1">月租金(元)</label>
            <Input value={rent} onChange={(e) => setRent(e.target.value)} placeholder="可选" type="number" className="h-9" />
          </div>
          <Button onClick={handleAdd} size="sm">
            <Plus className="w-4 h-4 mr-1" /> 添加
          </Button>
        </div>
      </div>

      <Separator />

      <div className="px-6 py-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          共 <span className="text-foreground font-medium">{candidates.length}</span> 个候选地点
        </span>
        <Button variant="ghost" size="sm" onClick={handleBatchGeocode} disabled={candidates.length === 0 || candidates.every((c) => c.geocoded)} className="text-primary hover:text-primary h-7 text-xs">
          <MapPin className="w-3.5 h-3.5 mr-1" /> 全部定位
        </Button>
      </div>

      <div className="flex-1 overflow-auto px-6">
        {candidates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Navigation className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">暂无候选地点</p>
            <p className="text-xs mt-1">添加候选办公地址开始评估</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {candidates.map((cand) => (
              <div key={cand.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-card border border-border transition-colors group hover:border-primary/30">
                <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shrink-0">
                  <Navigation className="w-3.5 h-3.5 text-primary" />
                </div>
                <div
                  className={cn("flex-1 min-w-0", cand.geocoded && "cursor-pointer hover:opacity-80")}
                  onClick={() => { if (cand.geocoded && cand.lng != null && cand.lat != null) locateOnMap(cand.lng, cand.lat) }}
                >
                  <div className="text-sm font-medium text-foreground truncate">{cand.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{cand.address}</div>
                </div>
                {cand.rent != null && (
                  <Badge className="bg-blue-50 text-blue-600 border-blue-200 text-xs h-5 shrink-0 font-mono">
                    ¥{cand.rent.toLocaleString()}/月
                  </Badge>
                )}
                <div className="flex items-center gap-1.5 shrink-0">
                  {cand.geocoded ? (
                    <Badge className="bg-green-50 text-green-600 border-green-200 text-xs h-5 font-mono">
                      {cand.lng?.toFixed(4)}, {cand.lat?.toFixed(4)}
                    </Badge>
                  ) : cand.geocodeError ? (
                    <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-xs h-5 max-w-[120px] truncate">{cand.geocodeError}</Badge>
                  ) : (
                    <Badge className="bg-amber-50 text-amber-600 border-amber-200 text-xs h-5">待定位</Badge>
                  )}
                  {geocodingId === cand.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  ) : !cand.geocoded ? (
                    <button onClick={() => handleGeocode(cand)} className="opacity-0 group-hover:opacity-100 transition-opacity text-primary">
                      <MapPin className="w-4 h-4" />
                    </button>
                  ) : null}
                  <button onClick={() => openEditDialog(cand)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteMutation.mutate(cand.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive ml-0.5">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!editTarget} onOpenChange={(v) => { if (!v) setEditTarget(null) }}>
        <DialogContent className="w-[420px] max-w-[420px]">
          <DialogHeader><DialogTitle>编辑候选地点</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">地点名称</label>
              <Input value={dlgName} onChange={(e) => setDlgName(e.target.value)} placeholder="地点名称" className="h-9" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">详细地址</label>
              <Input value={dlgAddress} onChange={(e) => setDlgAddress(e.target.value)} placeholder="详细地址" className="h-9" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">月租金(元)</label>
              <Input value={dlgRent} onChange={(e) => setDlgRent(e.target.value)} placeholder="可选" type="number" className="h-9" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setEditTarget(null)}>取消</Button>
            <Button size="sm" onClick={saveDialog}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
