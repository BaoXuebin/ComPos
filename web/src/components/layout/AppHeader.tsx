import { Settings } from "lucide-react"
import { Button } from "@/components/ui/button"

const APP_VERSION = "v0.3.1"

export function AppHeader({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <header className="flex items-center justify-between h-14 px-6 border-b border-border bg-background shrink-0">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold tracking-tight text-foreground relative">
          ComPos
          <span className="absolute -top-1 -right-10 text-[10px] font-mono text-muted-foreground bg-muted rounded px-1 leading-tight">{APP_VERSION}</span>
        </h1>
      </div>
      <Button variant="ghost" size="icon" onClick={onOpenSettings}>
        <Settings className="w-5 h-5" />
      </Button>
    </header>
  )
}
