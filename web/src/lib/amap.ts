import { api } from "./api"

declare global {
  interface Window {
    _AMapSecurityConfig: { securityJsCode: string }
    AMap: any
  }
}

let amapLoaded = false
let amapLoadPromise: Promise<void> | null = null

export function loadAmapSDK(): Promise<void> {
  if (amapLoaded) return Promise.resolve()
  if (amapLoadPromise) return amapLoadPromise

  amapLoadPromise = (async () => {
    if (window.AMap) {
      amapLoaded = true
      return
    }

    const { url, securityJsCode } = await api.getMapSDKUrl()
    window._AMapSecurityConfig = { securityJsCode }

    return new Promise<void>((resolve, reject) => {
      const script = document.createElement("script")
      script.src = url
      script.onload = () => { amapLoaded = true; resolve() }
      script.onerror = () => { amapLoadPromise = null; reject(new Error("高德地图 SDK 加载失败")) }
      document.head.appendChild(script)
    })
  })()

  return amapLoadPromise
}

export function isAmapLoaded() {
  return amapLoaded && typeof window.AMap !== "undefined"
}
