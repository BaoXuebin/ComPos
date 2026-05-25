import { useEffect, useRef, useState } from "react"
import { useEmployees } from "@/hooks/useEmployees"
import { useCandidates } from "@/hooks/useCandidates"
import { useAnalysis } from "@/hooks/useAnalysis"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { loadAmapSDK, isAmapLoaded } from "@/lib/amap"
import { cn } from "@/lib/utils"

let mapInstance: any = null
let markersCache: any[] = []

export function clearMapMarkers() {
  if (mapInstance) {
    markersCache.forEach((m) => mapInstance.remove(m))
    markersCache = []
  }
}

function addMarker(map: any, lng: number, lat: number, label: string, color: string) {
  const marker = new window.AMap.Marker({
    position: new window.AMap.LngLat(lng, lat),
    label: {
      content: `<div style="background:${color};color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;white-space:nowrap;box-shadow:0 0 8px ${color}44">${label}</div>`,
      direction: "top",
    },
  })
  marker.setMap(map)
  markersCache.push(marker)
  return marker
}

export function MapContainer({ visible }: { visible: boolean }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
    staleTime: 0,
    initialData: { amapKey: "", amapSecurityCode: "", amapServiceKey: "", deepseekApiKey: "" },
  })
  const { data: employees } = useEmployees()
  const { data: candidates } = useCandidates()
  const { data: analysis } = useAnalysis()

  // Load AMap SDK
  useEffect(() => {
    if (!visible || !settings?.amapKey) return
    if (isAmapLoaded()) return

    loadAmapSDK(settings.amapKey, settings.amapSecurityCode).catch(() => {})
  }, [visible, settings?.amapKey, settings?.amapSecurityCode])

  // Create map instance once
  useEffect(() => {
    if (!visible || mapInstance) return

    const init = () => {
      if (!isAmapLoaded() || !mapRef.current) return
      if (mapInstance) return

      mapInstance = new window.AMap.Map(mapRef.current, {
        zoom: 11,
        center: [113.65, 34.76],
        mapStyle: "amap://styles/normal",
        features: ["bg", "road", "building"],
      })
      setReady(true)
    }

    if (isAmapLoaded()) {
      init()
    } else {
      const interval = setInterval(() => {
        if (isAmapLoaded()) {
          init()
          clearInterval(interval)
        }
      }, 500)
      return () => clearInterval(interval)
    }
  }, [visible])

  // Update markers when data changes
  useEffect(() => {
    if (!mapInstance || !ready) return

    clearMapMarkers()

    employees?.filter((e) => e.geocoded && e.lng && e.lat).forEach((e) => {
      addMarker(mapInstance, e.lng!, e.lat!, e.name, "#3b82f6")
    })

    candidates?.filter((c) => c.geocoded && c.lng && c.lat).forEach((c) => {
      addMarker(mapInstance, c.lng!, c.lat!, c.name, "#6366f1")
    })

    if (analysis?.recommendedArea) {
      const area = analysis.recommendedArea
      const circle = new window.AMap.Circle({
        center: new window.AMap.LngLat(area.center[0], area.center[1]),
        radius: area.radius,
        fillColor: "rgba(139, 92, 246, 0.15)",
        strokeColor: "#a78bfa",
        strokeWeight: 2,
        strokeOpacity: 0.8,
        strokeStyle: "dashed",
      })
      circle.setMap(mapInstance)
      markersCache.push(circle)

      const label = new window.AMap.Marker({
        position: new window.AMap.LngLat(area.center[0], area.center[1]),
        label: {
          content: `<div style="background:rgba(139,92,246,0.9);color:#fff;padding:4px 12px;border-radius:6px;font-size:13px;box-shadow:0 0 16px rgba(139,92,246,0.4)">推荐: ${area.description}</div>`,
          direction: "center",
        },
      })
      label.setMap(mapInstance)
      markersCache.push(label)

      mapInstance.setFitView(null, false, [80, 80, 80, 80])
    }
  }, [employees, candidates, analysis, ready])

  // Resize handler
  useEffect(() => {
    const handle = () => {
      if (mapInstance && mapRef.current?.offsetParent) {
        mapInstance.resize()
      }
    }
    window.addEventListener("resize", handle)
    return () => window.removeEventListener("resize", handle)
  }, [])

  return (
    <div className={cn("w-[40%] min-w-[400px] bg-background relative overflow-hidden", !visible && "hidden")}>
      <div ref={mapRef} className="w-full h-full" />
      {!ready && visible && (
        <div className="absolute inset-0 flex items-center justify-center bg-background">
          <div className="text-sm text-muted-foreground animate-pulse">地图加载中...</div>
        </div>
      )}
    </div>
  )
}

export function getMapInstance() {
  return mapInstance
}

export function locateOnMap(lng: number, lat: number) {
  if (!mapInstance) return
  mapInstance.setZoomAndCenter(15, [lng, lat])
}

export function showRoutesOnMap(
  origin: { lng: number; lat: number; label: string },
  destination: { lng: number; lat: number; label: string },
  _mode: string
) {
  if (!mapInstance || !isAmapLoaded()) return

  markersCache.forEach((m) => {
    if (m instanceof window.AMap.Polyline) {
      mapInstance.remove(m)
    }
  })

  const polyline = new window.AMap.Polyline({
    path: [
      new window.AMap.LngLat(origin.lng, origin.lat),
      new window.AMap.LngLat(destination.lng, destination.lat),
    ],
    strokeColor: "#00d4ff",
    strokeWeight: 2,
    strokeOpacity: 0.6,
    strokeStyle: "dashed",
  })
  polyline.setMap(mapInstance)
  markersCache.push(polyline)

  mapInstance.setFitView(null, false, [120, 80, 120, 80])
}
