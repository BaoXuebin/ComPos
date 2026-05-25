import { useCallback } from "react"
import { useUIStore, type TabId } from "@/store/useUIStore"
import { AppHeader } from "@/components/layout/AppHeader"
import { TabNavigation } from "@/components/layout/TabNavigation"
import { SettingsDialog } from "@/components/layout/SettingsDialog"
import { MapContainer } from "@/components/map/MapContainer"
import { Tab1_AddressInput } from "@/components/tabs/Tab1_AddressInput"
import { Tab2_Candidates } from "@/components/tabs/Tab2_Candidates"
import { Tab3_CommuteComparison } from "@/components/tabs/Tab3_CommuteComparison"
import { Tab4_AIAnalysis } from "@/components/tabs/Tab4_AIAnalysis"

const MAP_VISIBLE_TABS: Set<TabId> = new Set(["employees", "candidates", "commute", "analysis"])

function App() {
  const activeTab = useUIStore((s) => s.activeTab)
  const setActiveTab = useUIStore((s) => s.setActiveTab)
  const settingsOpen = useUIStore((s) => s.settingsOpen)
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)

  const showMap = MAP_VISIBLE_TABS.has(activeTab)
  const mapFilter = activeTab

  const renderTab = useCallback(() => {
    switch (activeTab) {
      case "employees":
        return <Tab1_AddressInput />
      case "candidates":
        return <Tab2_Candidates />
      case "commute":
        return <Tab3_CommuteComparison />
      case "analysis":
        return <Tab4_AIAnalysis />
    }
  }, [activeTab])

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AppHeader onOpenSettings={() => setSettingsOpen(true)} />
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex flex-1 overflow-hidden">
        <div className={`${showMap ? "w-[60%]" : "flex-1"} overflow-hidden bg-background`}>
          {renderTab()}
        </div>
        <MapContainer visible={showMap} filter={mapFilter} />
      </div>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}

export default App
