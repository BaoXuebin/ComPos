import { cn } from "@/lib/utils"
import type { TabId } from "@/store/useUIStore"

const TABS: { id: TabId; label: string }[] = [
  { id: "employees", label: "地址录入" },
  { id: "candidates", label: "候选地点" },
  { id: "commute", label: "通勤对比" },
  { id: "analysis", label: "AI 分析" },
]

export function TabNavigation({ activeTab, onTabChange }: { activeTab: TabId; onTabChange: (tab: TabId) => void }) {
  return (
    <nav className="flex items-center gap-0 px-6 border-b border-border bg-background shrink-0">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "relative px-5 py-3 text-sm font-medium transition-colors duration-200",
            "text-muted-foreground hover:text-foreground",
            activeTab === tab.id && "text-primary"
          )}
        >
          {tab.label}
          {activeTab === tab.id && (
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
          )}
        </button>
      ))}
    </nav>
  )
}
