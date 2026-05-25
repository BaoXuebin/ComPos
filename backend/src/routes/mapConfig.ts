import { Router } from "express"
import { getSettings } from "../services/storage.js"

export const mapConfigRouter = Router()

mapConfigRouter.get("/", (_req, res) => {
  const { amapKey, amapSecurityCode } = getSettings()
  if (!amapKey) {
    return res.status(400).json({ error: "AMap JS API Key not configured" })
  }
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
  res.json({
    url: `https://webapi.amap.com/maps?v=2.0&key=${amapKey}&plugin=${plugins.join(",")}`,
    securityJsCode: amapSecurityCode,
  })
})
