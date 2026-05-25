import { Router } from "express"
import { getCommutes, saveCommutes, getEmployees, getCandidates, getSettings } from "../services/storage.js"
import { logger } from "../logger.js"
import type { TravelMode } from "../types.js"

export const commutesRouter = Router()

commutesRouter.get("/", (_req, res) => {
  res.json(getCommutes())
})

commutesRouter.delete("/", (_req, res) => {
  saveCommutes({})
  res.json({ success: true })
})

// Check if backend has minimal config to calculate
commutesRouter.get("/can-calculate", (_req, res) => {
  const settings = getSettings()
  const employees = getEmployees().filter((e) => e.geocoded)
  const candidates = getCandidates().filter((c) => c.geocoded)
  const hasKey = !!(settings.amapServiceKey || settings.amapKey)
  res.json({
    canCalculate: !!(hasKey && employees.length > 0 && candidates.length > 0),
    employeeCount: employees.length,
    candidateCount: candidates.length,
  })
})
