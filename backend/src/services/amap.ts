import { getSettings } from "./storage.js"
import { logger } from "../logger.js"
import type { TravelMode, CommuteResult, GeocodeResult } from "../types.js"

const AMAP_BASE = "https://restapi.amap.com/v3"

function getKey(): string {
  return getSettings().amapServiceKey || getSettings().amapKey
}

// ========== 地理编码 (REST API) ==========
export async function geocodeAddress(
  address: string,
  city = "全国"
): Promise<GeocodeResult> {
  const key = getKey()
  if (!key) throw new Error("高德 API Key 未配置")

  const url = `${AMAP_BASE}/geocode/geo?key=${key}&address=${encodeURIComponent(address)}&city=${encodeURIComponent(city)}`
  logger.info("Geocoding address", { address })

  const res = await fetch(url)
  const data = await res.json()

  if (data.status === "1" && data.geocodes?.length > 0) {
    const geo = data.geocodes[0]
    const [lng, lat] = geo.location.split(",").map(Number)
    return {
      lng,
      lat,
      formattedAddress: geo.formatted_address || address,
    }
  }

  logger.error("Geocoding failed", { address, amapStatus: data.status, amapInfo: data.info, amapInfocode: data.infocode })
  const reason = data.info ? ` (${data.info})` : ""
  throw new Error(`地理编码失败: "${address}" 未找到匹配坐标${reason}`)
}

// ========== 路线规划 (REST API) ==========
const DIRECTION_PATHS: Record<TravelMode, string> = {
  driving: "/direction/driving",
  transit: "/direction/transit/integrated",
  walking: "/direction/walking",
  cycling: "/direction/bicycling",
}

export async function calculateRoute(
  origin: { lng: number; lat: number },
  destination: { lng: number; lat: number },
  mode: TravelMode
): Promise<CommuteResult> {
  const key = getKey()
  if (!key) return { distance: null, duration: null, error: "高德 API Key 未配置" }

  const originStr = `${origin.lng},${origin.lat}`
  const destStr = `${destination.lng},${destination.lat}`
  const path = DIRECTION_PATHS[mode]
  const url = `${AMAP_BASE}${path}?key=${key}&origin=${originStr}&destination=${destStr}`

  try {
    const res = await fetch(url)
    const data = await res.json()

    if (data.status === "1") {
      const route =
        mode === "transit" ? data.route?.transits?.[0] : data.route?.paths?.[0]
      if (route) {
        return {
          distance: parseInt(route.distance) || 0,
          duration: parseInt(route.duration) || 0,
          error: null,
        }
      }
    }

    const msg =
      mode === "walking" ? "步行距离过远" :
      mode === "cycling" ? "骑行距离过远" :
      `未找到${mode}路线`
    return { distance: null, duration: null, error: msg }
  } catch (err: any) {
    logger.error("Route calculation failed", { mode, origin: originStr, dest: destStr, err: err.message })
    return { distance: null, duration: null, error: err.message }
  }
}

// ========== 批量路线计算 ==========
export async function batchCalculateRoutes(
  items: {
    employeeId: string
    candidateId: string
    mode: TravelMode
    origin: { lng: number; lat: number }
    destination: { lng: number; lat: number }
  }[],
  onProgress: (completed: number, total: number, failed: number) => void,
  onResult: (employeeId: string, candidateId: string, mode: TravelMode, result: CommuteResult) => void,
  signal?: { aborted: boolean }
): Promise<void> {
  const CONCURRENCY = 3
  let completed = 0
  let failed = 0

  for (let i = 0; i < items.length; i += CONCURRENCY) {
    if (signal?.aborted) break

    const batch = items.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map((item) => calculateRoute(item.origin, item.destination, item.mode))
    )

    results.forEach((r, j) => {
      completed++
      const item = batch[j]
      if (r.status === "fulfilled") {
        if (r.value.error) failed++
        onResult(item.employeeId, item.candidateId, item.mode, r.value)
      } else {
        failed++
        onResult(item.employeeId, item.candidateId, item.mode, {
          distance: null,
          duration: null,
          error: r.reason?.message || "计算失败",
        })
      }
    })

    onProgress(completed, items.length, failed)

    if (i + CONCURRENCY < items.length && !signal?.aborted) {
      await new Promise((r) => setTimeout(r, 200))
    }
  }
}
