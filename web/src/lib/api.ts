import type { Employee, Candidate, CommuteEntry, AnalysisResult, AppSettings, GeocodeResult, TravelMode } from "@/types"

const BASE = "/api"

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || "Request failed")
  }
  return res.json()
}

// Employees
export const api = {
  getEmployees: () => request<Employee[]>("/employees"),
  createEmployee: (name: string, address: string, modes?: TravelMode[]) =>
    request<Employee>("/employees", { method: "POST", body: JSON.stringify({ name, address, modes: modes ?? [] }) }),
  updateEmployee: (id: string, data: Partial<Employee>) =>
    request<Employee>(`/employees/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteEmployee: (id: string) =>
    request<{ success: boolean }>(`/employees/${id}`, { method: "DELETE" }),

  getCandidates: () => request<Candidate[]>("/candidates"),
  createCandidate: (name: string, address: string) =>
    request<Candidate>("/candidates", { method: "POST", body: JSON.stringify({ name, address }) }),
  updateCandidate: (id: string, data: Partial<Candidate>) =>
    request<Candidate>(`/candidates/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteCandidate: (id: string) =>
    request<{ success: boolean }>(`/candidates/${id}`, { method: "DELETE" }),

  geocodeAddress: (address: string) =>
    request<GeocodeResult>("/geocode", { method: "POST", body: JSON.stringify({ address }) }),

  getCommutes: () => request<Record<string, CommuteEntry>>("/commutes"),
  clearCommutes: () => request<{ success: boolean }>("/commutes", { method: "DELETE" }),

  getAnalysis: () => request<AnalysisResult | null>("/analysis"),

  getSettings: () => request<AppSettings>("/settings"),
  updateSettings: (data: Partial<AppSettings>) =>
    request<AppSettings>("/settings", { method: "PUT", body: JSON.stringify(data) }),
}

export type { GeocodeResult } from "@/types"
