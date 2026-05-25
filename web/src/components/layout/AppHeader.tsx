import { Settings } from "lucide-react"
import { Button } from "@/components/ui/button"

export function AppHeader({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <header className="flex items-center justify-between h-14 px-6 border-b border-border bg-background shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
          C
        </div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          公司选址通勤分析
        </h1>
      </div>
      <Button variant="ghost" size="icon" onClick={onOpenSettings}>
        <Settings className="w-5 h-5" />
      </Button>
    </header>
  )
}
