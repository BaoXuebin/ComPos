import { Router } from "express"
import { getSettings, saveSettings } from "../services/storage.js"

export const settingsRouter = Router()

settingsRouter.get("/", (_req, res) => {
  const settings = getSettings()
  // Only mask server-side keys; JS API keys are needed by frontend
  res.json({
    ...settings,
    amapServiceKey: settings.amapServiceKey ? "***configured***" : "",
    deepseekApiKey: settings.deepseekApiKey ? "***configured***" : "",
  })
})

settingsRouter.put("/", (req, res) => {
  const current = getSettings()
  const updated = { ...current, ...req.body }
  saveSettings(updated)
  res.json({
    ...updated,
    amapServiceKey: updated.amapServiceKey ? "***configured***" : "",
    deepseekApiKey: updated.deepseekApiKey ? "***configured***" : "",
  })
})
