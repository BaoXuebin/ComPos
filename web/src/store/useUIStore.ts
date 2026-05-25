import { create } from "zustand"

export type TabId = "employees" | "candidates" | "commute" | "analysis"

interface UIState {
  activeTab: TabId
  setActiveTab: (tab: TabId) => void
  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void
  mapFullscreen: boolean
  setMapFullscreen: (fullscreen: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  activeTab: "employees",
  setActiveTab: (activeTab) => set({ activeTab }),
  settingsOpen: false,
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  mapFullscreen: false,
  setMapFullscreen: (mapFullscreen) => set({ mapFullscreen }),
}))
