import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useEmployees, useCreateEmployee, useUpdateEmployee, useDeleteEmployee } from "@/hooks/useEmployees"
import { api, type GeocodeResult } from "@/lib/api"
import type { Employee } from "@/types"
import { TRAVEL_MODES, type TravelMode } from "@/types"
import { cn } from "@/lib/utils"
import { Plus, Trash2, Upload, Download, MapPin, Loader2, Car, Bus, Footprints, Bike, Pencil } from "lucide-react"
import { locateOnMap } from "@/components/map/MapContainer"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

const MODE_ICONS: Record<TravelMode, typeof Car> = {
  driving: Car,
  transit: Bus,
  walking: Footprints,
  cycling: Bike,
}

export function Tab1_AddressInput() {
  const { data: employees = [] } = useEmployees()
  const createMutation = useCreateEmployee()
  const updateMutation = useUpdateEmployee()
  const deleteMutation = useDeleteEmployee()

  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [selectedModes, setSelectedModes] = useState<Set<TravelMode>>(new Set<TravelMode>(["driving", "transit"]))
  const [geocodingId, setGeocodingId] = useState<string | null>(null)
  const [batchGeocoding, setBatchGeocoding] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Dialog editing
  const [editTarget, setEditTarget] = useState<Employee | null>(null)
  const [dlgName, setDlgName] = useState("")
  const [dlgAddress, setDlgAddress] = useState("")
  const [dlgModes, setDlgModes] = useState<Set<TravelMode>>(new Set())

  const openEditDialog = (emp: Employee) => {
    setEditTarget(emp)
    setDlgName(emp.name)
    setDlgAddress(emp.address)
    setDlgModes(new Set(emp.modes || ["driving", "transit"]))
  }

  const saveDialog = () => {
    if (!editTarget || !dlgName.trim() || !dlgAddress.trim()) return
    updateMutation.mutate({ id: editTarget.id, data: { name: dlgName.trim(), address: dlgAddress.trim(), modes: Array.from(dlgModes) } })
    setEditTarget(null)
  }

  const toggleMode = (mode: TravelMode) => {
    setSelectedModes((prev) => {
      const next = new Set(prev)
      if (next.has(mode)) next.delete(mode)
      else next.add(mode)
      return next
    })
  }

  const handleAdd = () => {
    if (!name.trim() || !address.trim()) return
    createMutation.mutate({ name: name.trim(), address: address.trim(), modes: Array.from(selectedModes) })
    setName("")
    setAddress("")
    setSelectedModes(new Set<TravelMode>(["driving", "transit"]))
  }

  const handleGeocode = async (emp: Employee) => {
    setGeocodingId(emp.id)
    try {
      const result: GeocodeResult = await api.geocodeAddress(emp.address)
      updateMutation.mutate({ id: emp.id, data: { lng: result.lng, lat: result.lat, geocoded: true, geocodeError: null } })
    } catch (err: any) {
      updateMutation.mutate({ id: emp.id, data: { geocodeError: err.message } })
    }
    setGeocodingId(null)
  }

  const handleBatchGeocode = async () => {
    setBatchGeocoding(true)
    const ungeocoded = employees.filter((e) => !e.geocoded)
    for (const emp of ungeocoded) {
      setGeocodingId(emp.id)
      try {
        const result: GeocodeResult = await api.geocodeAddress(emp.address)
        updateMutation.mutate({ id: emp.id, data: { lng: result.lng, lat: result.lat, geocoded: true, geocodeError: null } })
      } catch (err: any) {
        updateMutation.mutate({ id: emp.id, data: { geocodeError: err.message } })
      }
      await new Promise((r) => setTimeout(r, 150))
    }
    setGeocodingId(null)
    setBatchGeocoding(false)
  }

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(employees, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `员工地址_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = () => {
    const file = fileInputRef.current?.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)
        if (Array.isArray(data) && data.every((d: any) => d.name && d.address)) {
          data.forEach((d: any) => createMutation.mutate({ name: d.name, address: d.address, modes: d.modes || [] }))
        }
      } catch {
        alert("文件格式不正确")
      }
    }
    reader.readAsText(file)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const geocodedCount = employees.filter((e) => e.geocoded).length
  const errorCount = employees.filter((e) => e.geocodeError).length

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4">
        <h2 className="text-lg font-semibold text-foreground mb-1">员工地址录入</h2>
        <p className="text-sm text-muted-foreground">录入每位同事的家庭地址，系统将自动转换为地图坐标</p>
      </div>

      <div className="px-6 pb-4 space-y-3">
        <div className="flex gap-3 items-end">
          <div className="w-32">
            <label className="block text-xs text-muted-foreground mb-1">姓名</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="张三" onKeyDown={(e) => e.key === "Enter" && handleAdd()} className="h-9" />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-muted-foreground mb-1">家庭地址</label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="北京市海淀区xx路xx号" onKeyDown={(e) => e.key === "Enter" && handleAdd()} className="h-9" />
          </div>
          <Button onClick={handleAdd} size="sm">
            <Plus className="w-4 h-4 mr-1" /> 添加
          </Button>
        </div>
        <div className="flex gap-1.5 items-center">
          <span className="text-xs text-muted-foreground mr-1">出行:</span>
          {TRAVEL_MODES.map((m) => {
            const Icon = MODE_ICONS[m.key]
            const selected = selectedModes.has(m.key)
            return (
              <button key={m.key} type="button" onClick={() => toggleMode(m.key)}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-all",
                  selected ? "bg-accent border-primary text-primary" : "bg-card border-border text-muted-foreground hover:border-primary/30"
                )}
              >
                <Icon className="w-3 h-3" />{m.label}
              </button>
            )
          })}
        </div>
      </div>

      <Separator />

      <div className="px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>共 <span className="text-foreground font-medium">{employees.length}</span> 人</span>
          <span>已定位 <span className="text-green-600 font-medium">{geocodedCount}</span></span>
          {errorCount > 0 && <span>失败 <span className="text-destructive font-medium">{errorCount}</span></span>}
        </div>
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
          <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} className="h-7 text-xs">
            <Upload className="w-3.5 h-3.5 mr-1" /> 导入
          </Button>
          <Button variant="ghost" size="sm" onClick={handleExport} disabled={employees.length === 0} className="h-7 text-xs">
            <Download className="w-3.5 h-3.5 mr-1" /> 导出
          </Button>
          <Button variant="ghost" size="sm" onClick={handleBatchGeocode} disabled={batchGeocoding || employees.every((e) => e.geocoded)} className="h-7 text-xs text-primary hover:text-primary">
            <MapPin className="w-3.5 h-3.5 mr-1" /> 批量定位
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6">
        {employees.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <MapPin className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">暂无员工数据</p>
            <p className="text-xs mt-1">在上方输入姓名和地址，开始添加</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {employees.map((emp) => (
              <div key={emp.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-card border border-border transition-colors group hover:border-primary/30">
                <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-xs font-medium text-primary shrink-0">
                  {emp.name[0]}
                </div>
                <div
                  className={cn("flex-1 min-w-0", emp.geocoded && "cursor-pointer hover:opacity-80")}
                  onClick={() => { if (emp.geocoded && emp.lng != null && emp.lat != null) locateOnMap(emp.lng, emp.lat) }}
                >
                  <div className="text-sm font-medium text-foreground truncate">{emp.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{emp.address}</div>
                  {emp.modes && emp.modes.length > 0 && (
                    <div className="flex gap-1 mt-0.5">
                      {emp.modes.map((m) => {
                        const Icon = MODE_ICONS[m] || Car
                        const label = TRAVEL_MODES.find((t) => t.key === m)?.label || m
                        return (
                          <span key={m} className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground bg-accent px-1 py-px rounded">
                            <Icon className="w-2.5 h-2.5" />{label}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {emp.geocoded ? (
                    <Badge className="bg-green-50 text-green-600 border-green-200 text-xs h-5 font-mono">
                      {emp.lng?.toFixed(4)}, {emp.lat?.toFixed(4)}
                    </Badge>
                  ) : emp.geocodeError ? (
                    <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-xs h-5">{emp.geocodeError}</Badge>
                  ) : (
                    <Badge className="bg-amber-50 text-amber-600 border-amber-200 text-xs h-5">待定位</Badge>
                  )}
                  {geocodingId === emp.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  ) : !emp.geocoded ? (
                    <button onClick={() => handleGeocode(emp)} className="opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:text-primary/80">
                      <MapPin className="w-4 h-4" />
                    </button>
                  ) : null}
                  <button onClick={() => openEditDialog(emp)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteMutation.mutate(emp.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive ml-0.5">
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
          <DialogHeader><DialogTitle>编辑员工信息</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">姓名</label>
              <Input value={dlgName} onChange={(e) => setDlgName(e.target.value)} placeholder="姓名" className="h-9" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">家庭地址</label>
              <Input value={dlgAddress} onChange={(e) => setDlgAddress(e.target.value)} placeholder="家庭地址" className="h-9" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">出行方式</label>
              <div className="flex gap-1.5">
                {TRAVEL_MODES.map((m) => {
                  const Icon = MODE_ICONS[m.key]
                  const selected = dlgModes.has(m.key)
                  return (
                    <button key={m.key} type="button" onClick={() => setDlgModes((prev) => { const next = new Set(prev); if (next.has(m.key)) next.delete(m.key); else next.add(m.key); return next })}
                      className={cn("flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-all", selected ? "bg-accent border-primary text-primary" : "bg-card border-border text-muted-foreground")}>
                      <Icon className="w-3 h-3" />{m.label}
                    </button>
                  )
                })}
              </div>
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
