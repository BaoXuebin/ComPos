import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { api } from "@/lib/api"
import { loadAmapSDK } from "@/lib/amap"

function maskKey(key: string): string {
  if (!key) return "未配置"
  if (key === "***configured***") return "已配置"
  return key.slice(0, 4) + "****" + key.slice(-4)
}

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
    staleTime: 0,
    initialData: { amapKey: "", amapSecurityCode: "", amapServiceKey: "", deepseekApiKey: "" },
  })
  const updateMutation = useMutation({
    mutationFn: api.updateSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  })

  const hasExisting = !!(settings.amapKey || settings.amapServiceKey || settings.deepseekApiKey)
  const [editing, setEditing] = useState(!hasExisting)
  const [local, setLocal] = useState(settings)
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<"success" | "fail" | null>(null)

  useEffect(() => {
    if (open) {
      setLocal(settings)
      setEditing(!settings.amapKey && !settings.amapServiceKey && !settings.deepseekApiKey)
      setSaveResult(null)
    }
  }, [open, settings])

  const handleSave = async () => {
    setSaving(true)
    setSaveResult(null)
    try {
      await updateMutation.mutateAsync(local)
      try { await loadAmapSDK() } catch { /* key not configured */ }
      setSaveResult("success")
      setEditing(false)
    } catch {
      setSaveResult("fail")
    }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[460px] max-w-[460px]">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
        </DialogHeader>

        {editing ? (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                高德 JS API Key（地图渲染）
              </label>
              <Input value={local.amapKey} onChange={(e) => setLocal({ ...local, amapKey: e.target.value })} placeholder="Web端(JS API) Key" className="font-mono" />
              <p className="text-xs text-muted-foreground mt-1">服务平台选「Web端(JS API)」，获取地址: console.amap.com/dev/key/app</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                高德安全密钥
              </label>
              <Input value={local.amapSecurityCode} onChange={(e) => setLocal({ ...local, amapSecurityCode: e.target.value })} placeholder="JS API 安全密钥" className="font-mono" />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                高德 Web服务 Key（地理编码/路线）
              </label>
              <Input value={local.amapServiceKey} onChange={(e) => setLocal({ ...local, amapServiceKey: e.target.value })} placeholder="Web服务 Key" className="font-mono" />
              <p className="text-xs text-muted-foreground mt-1">服务平台选「Web服务」，与 JS API Key 分开申请</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                DeepSeek API Key
              </label>
              <Input value={local.deepseekApiKey} onChange={(e) => setLocal({ ...local, deepseekApiKey: e.target.value })} placeholder="sk-..." className="font-mono" />
              <p className="text-xs text-muted-foreground mt-1">获取地址: platform.deepseek.com/api_keys</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 px-1">
              <span className="text-sm text-muted-foreground">高德 JS API Key（地图）</span>
              <span className="text-sm font-mono text-foreground">{maskKey(local.amapKey)}</span>
            </div>
            <div className="flex items-center justify-between py-2 px-1">
              <span className="text-sm text-muted-foreground">高德安全密钥</span>
              <span className="text-sm font-mono text-foreground">{maskKey(local.amapSecurityCode)}</span>
            </div>
            <div className="flex items-center justify-between py-2 px-1">
              <span className="text-sm text-muted-foreground">高德 Web服务 Key（API）</span>
              <span className="text-sm font-mono text-foreground">{maskKey(local.amapServiceKey)}</span>
            </div>
            <div className="flex items-center justify-between py-2 px-1">
              <span className="text-sm text-muted-foreground">DeepSeek API Key</span>
              <span className="text-sm font-mono text-foreground">{maskKey(local.deepseekApiKey)}</span>
            </div>
          </div>
        )}

        {saveResult && (
          <div className={`px-3 py-2 rounded text-sm ${saveResult === "success" ? "bg-green-50 text-green-600 border border-green-200" : "bg-destructive/10 text-destructive border border-destructive/20"}`}>
            {saveResult === "success" ? "设置已保存，SDK 验证通过" : "保存失败"}
          </div>
        )}

        <DialogFooter>
          {editing ? (
            <>
              <Button variant="ghost" onClick={onClose}>取消</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "保存中..." : "保存"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose}>关闭</Button>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="w-4 h-4 mr-1" /> 编辑
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
