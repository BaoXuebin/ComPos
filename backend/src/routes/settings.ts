import { Router } from "express"
import { getSettings, saveSettings } from "../services/storage.js"
import type { AppSettings } from "../types.js"

const KEY_FIELDS = ["amapKey", "amapSecurityCode", "amapServiceKey", "deepseekApiKey"] as const
const TEXT_FIELDS = ["analysisPrompt"] as const

function maskIfSet(value: string): string {
  return value ? "***configured***" : ""
}

function maskAll(s: AppSettings): AppSettings {
  return {
    ...s,
    amapKey: maskIfSet(s.amapKey),
    amapSecurityCode: maskIfSet(s.amapSecurityCode),
    amapServiceKey: maskIfSet(s.amapServiceKey),
    deepseekApiKey: maskIfSet(s.deepseekApiKey),
  }
}

export const settingsRouter = Router()

settingsRouter.get("/", (_req, res) => {
  res.json(maskAll(getSettings()))
})

settingsRouter.put("/", (req, res) => {
  const current = getSettings()
  const updated = { ...current }
  for (const key of KEY_FIELDS) {
    const val = req.body[key]
    if (val !== undefined && val !== "***configured***" && !val.includes("***")) {
      updated[key] = val
    }
  }
  for (const key of TEXT_FIELDS) {
    if (req.body[key] !== undefined) {
      updated[key] = req.body[key]
    }
  }
  saveSettings(updated)
  res.json(maskAll(updated))
})
