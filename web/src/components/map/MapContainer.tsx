import { useEffect, useRef, useState } from "react"
import { useEmployees } from "@/hooks/useEmployees"
import { useCandidates } from "@/hooks/useCandidates"
import { useAnalysis } from "@/hooks/useAnalysis"
import { loadAmapSDK, isAmapLoaded } from "@/lib/amap"
import { useUIStore } from "@/store/useUIStore"
import { cn } from "@/lib/utils"
import { Maximize2, Minimize2 } from "lucide-react"

let mapInstance: any = null
let markersCache: any[] = []

let routeSearchers: any[] = []

export function clearRouteOverlays() {
  routeSearchers.forEach((s) => { try { s.clear() } catch { /* ignore */ } })
  routeSearchers = []
}

export function showCandidateRoutes(
  candidateLng: number,
  candidateLat: number,
  trips: { lng: number; lat: number; bestMode: string }[]
) {
  if (!mapInstance || !isAmapLoaded()) return
  clearRouteOverlays()

  const dest = new window.AMap.LngLat(candidateLng, candidateLat)
  trips.forEach((trip) => {
    const origin = new window.AMap.LngLat(trip.lng, trip.lat)
    let searcher: any = null
    switch (trip.bestMode) {
      case "driving":
        searcher = new window.AMap.Driving({ map: mapInstance })
        break
      case "transit":
        searcher = new window.AMap.Transit({ map: mapInstance, city: "郑州" })
        break
      case "walking":
        searcher = new window.AMap.Walking({ map: mapInstance })
        break
      case "cycling":
        searcher = new window.AMap.Riding({ map: mapInstance })
        break
    }
    if (searcher) {
      searcher.search(origin, dest)
      routeSearchers.push(searcher)
    }
  })
  mapInstance.setFitView(null, false, [120, 80, 120, 80])
}

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

export function MapContainer({ visible, filter = "employees" }: { visible: boolean; filter?: "employees" | "candidates" | "commute" | "analysis" }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const { data: employees } = useEmployees()
  const { data: candidates } = useCandidates()
  const { data: analysis } = useAnalysis()
  const mapFullscreen = useUIStore((s) => s.mapFullscreen)
  const setMapFullscreen = useUIStore((s) => s.setMapFullscreen)

  // Load AMap SDK
  useEffect(() => {
    if (!visible) return
    if (isAmapLoaded()) return
    loadAmapSDK().catch(() => {})
  }, [visible])

  // Create map instance once
  useEffect(() => {
    if (!visible || mapInstance) return

    const init = () => {
      if (!isAmapLoaded() || !mapRef.current) return
      if (mapInstance) return

      mapInstance = new window.AMap.Map(mapRef.current, {
        zoom: 11,
        center: [113.65, 34.76],
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
    let hasMarkers = false

    if (filter !== "candidates") {
      employees?.filter((e) => e.geocoded && e.lng && e.lat).forEach((e) => {
        addMarker(mapInstance, e.lng!, e.lat!, e.name, "#3b82f6")
        hasMarkers = true
      })
    }

    if (filter !== "employees") {
      candidates?.filter((c) => c.geocoded && c.lng && c.lat).forEach((c) => {
        addMarker(mapInstance, c.lng!, c.lat!, c.name, "#6366f1")
        hasMarkers = true
      })
    }

    if (filter === "analysis" && analysis?.recommendedArea) {
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
      hasMarkers = true
    }

    if (hasMarkers) {
      mapInstance.setFitView(null, false, [80, 80, 80, 80])
    }
  }, [employees, candidates, analysis, ready, filter])

  // Resize on fullscreen toggle
  useEffect(() => {
    if (mapInstance && ready) {
      setTimeout(() => mapInstance.resize(), 100)
    }
  }, [mapFullscreen])

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
    <div className={cn("bg-background relative overflow-hidden", !visible && "hidden", mapFullscreen ? "flex-1" : "w-[40%] min-w-[400px]")}>
      <div ref={mapRef} className="w-full h-full" />
      {!ready && visible && (
        <div className="absolute inset-0 flex items-center justify-center bg-background">
          <div className="text-sm text-muted-foreground animate-pulse">地图加载中...</div>
        </div>
      )}
      {ready && (
        <button
          onClick={() => setMapFullscreen(!mapFullscreen)}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-md bg-background/80 backdrop-blur border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
          title={mapFullscreen ? "退出全屏" : "全屏查看"}
        >
          {mapFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      )}
    </div>
  )
}

export function getMapInstance() {
  return mapInstance
}

export function locateOnMap(lng: number, lat: number) {
  if (!mapInstance) return
  mapInstance.setCenter([lng, lat])
}

export function showRoutesOnMap(
  origin: { lng: number; lat: number; label: string },
  destination: { lng: number; lat: number; label: string }
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
