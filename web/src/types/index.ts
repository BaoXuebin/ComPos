export interface Employee {
  id: string
  name: string
  address: string
  lng: number | null
  lat: number | null
  geocoded: boolean
  geocodeError: string | null
  modes?: TravelMode[]
}

export interface Candidate {
  id: string
  name: string
  address: string
  rent: number | null
  lng: number | null
  lat: number | null
  geocoded: boolean
  geocodeError: string | null
}

export type TravelMode = "driving" | "transit" | "walking" | "cycling"

export const TRAVEL_MODES: { key: TravelMode; label: string }[] = [
  { key: "driving", label: "驾车" },
  { key: "transit", label: "公交" },
  { key: "walking", label: "步行" },
  { key: "cycling", label: "骑行" },
]

export interface CommuteResult {
  distance: number | null
  duration: number | null
  error: string | null
}

export type CommuteEntry = {
  employeeId: string
  candidateId: string
  calculatedAt: string
} & Record<TravelMode, CommuteResult | null>

export interface AnalysisResult {
  timestamp: string
  scores: Record<string, { score: number; summary: string }>
  reasoning: string
  recommendedArea: {
    center: [number, number]
    radius: number
    description: string
    overlayType: "circle" | "polygon"
  } | null
}

export interface AppSettings {
  amapKey: string
  amapSecurityCode: string
  amapServiceKey: string
  deepseekApiKey: string
  analysisPrompt: string
}

export interface GeocodeResult {
  lng: number
  lat: number
  formattedAddress: string
}
