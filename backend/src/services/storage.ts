import fs from "fs"
import path from "path"
import { config } from "../config.js"
import { logger } from "../logger.js"
import type { Employee, Candidate, CommuteEntry, AnalysisResult, AppSettings } from "../types.js"

function ensureDataDir() {
  if (!fs.existsSync(config.dataDir)) {
    fs.mkdirSync(config.dataDir, { recursive: true })
  }
}

function readJSON<T>(filename: string, fallback: T): T {
  ensureDataDir()
  const filepath = path.join(config.dataDir, filename)
  try {
    if (fs.existsSync(filepath)) {
      const raw = fs.readFileSync(filepath, "utf-8")
      return JSON.parse(raw) as T
    }
  } catch (err) {
    logger.error("Failed to read JSON file", { filepath, err })
  }
  return fallback
}

function writeJSON(filename: string, data: unknown) {
  ensureDataDir()
  const filepath = path.join(config.dataDir, filename)
  try {
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), "utf-8")
  } catch (err) {
    logger.error("Failed to write JSON file", { filepath, err })
  }
}

// Employees
export function getEmployees(): Employee[] {
  return readJSON<Employee[]>("employees.json", [])
}
export function saveEmployees(data: Employee[]) {
  writeJSON("employees.json", data)
}

// Candidates
export function getCandidates(): Candidate[] {
  return readJSON<Candidate[]>("candidates.json", [])
}
export function saveCandidates(data: Candidate[]) {
  writeJSON("candidates.json", data)
}

// Commutes
export function getCommutes(): Record<string, CommuteEntry> {
  return readJSON<Record<string, CommuteEntry>>("commutes.json", {})
}
export function saveCommutes(data: Record<string, CommuteEntry>) {
  writeJSON("commutes.json", data)
}

// Analysis
export function getAnalysis(): AnalysisResult | null {
  return readJSON<AnalysisResult | null>("analysis.json", null)
}
export function saveAnalysis(data: AnalysisResult | null) {
  writeJSON("analysis.json", data)
}

// Settings
const defaultSettings: AppSettings = {
  amapKey: "",
  amapSecurityCode: "",
  amapServiceKey: "",
  deepseekApiKey: "",
}
export function getSettings(): AppSettings {
  return readJSON<AppSettings>("settings.json", defaultSettings)
}
export function saveSettings(data: AppSettings) {
  writeJSON("settings.json", data)
}
