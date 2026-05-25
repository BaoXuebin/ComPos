declare global {
  interface Window {
    _AMapSecurityConfig: { securityJsCode: string }
    AMap: any
  }
}

let amapLoaded = false
let amapLoadPromise: Promise<void> | null = null

export function loadAmapSDK(key: string, securityCode: string): Promise<void> {
  if (amapLoaded) return Promise.resolve()
  if (amapLoadPromise) return amapLoadPromise

  amapLoadPromise = new Promise((resolve, reject) => {
    if (window.AMap) {
      amapLoaded = true
      resolve()
      return
    }

    window._AMapSecurityConfig = { securityJsCode: securityCode }

    const script = document.createElement("script")
    const plugins = [
      "AMap.Geocoder",
      "AMap.Driving",
      "AMap.Transit",
      "AMap.Walking",
      "AMap.Riding",
      "AMap.Polygon",
      "AMap.Circle",
      "AMap.Marker",
      "AMap.Polyline",
    ]
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${key}&plugin=${plugins.join(",")}`
    script.onload = () => {
      amapLoaded = true
      resolve()
    }
    script.onerror = () => {
      amapLoadPromise = null
      reject(new Error("高德地图 SDK 加载失败"))
    }
    document.head.appendChild(script)
  })

  return amapLoadPromise
}

export function isAmapLoaded() {
  return amapLoaded && typeof window.AMap !== "undefined"
}
