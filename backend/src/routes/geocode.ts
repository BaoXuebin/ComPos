import { Router } from "express"
import { geocodeAddress } from "../services/amap.js"

export const geocodeRouter = Router()

geocodeRouter.post("/", async (req, res) => {
  try {
    const { address } = req.body
    if (!address) return res.status(400).json({ error: "address required" })
    const result = await geocodeAddress(address)
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

geocodeRouter.post("/batch", async (req, res) => {
  try {
    const { addresses } = req.body
    if (!Array.isArray(addresses)) return res.status(400).json({ error: "addresses array required" })

    const results = []
    for (const addr of addresses) {
      try {
        const r = await geocodeAddress(addr)
        results.push({ address: addr, ...r, error: null })
      } catch (err: any) {
        results.push({ address: addr, lng: null, lat: null, formattedAddress: null, error: err.message })
      }
      await new Promise((r) => setTimeout(r, 150))
    }
    res.json({ results })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})
