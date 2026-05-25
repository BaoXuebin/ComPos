import { Router } from "express"
import { v4 as uuid } from "uuid"
import { getCandidates, saveCandidates } from "../services/storage.js"

export const candidatesRouter = Router()

candidatesRouter.get("/", (_req, res) => {
  res.json(getCandidates())
})

candidatesRouter.post("/", (req, res) => {
  const { name, address } = req.body
  if (!name || !address) return res.status(400).json({ error: "name and address are required" })

  const candidates = getCandidates()
  const cand = { id: uuid(), name, address, lng: null, lat: null, geocoded: false, geocodeError: null }
  candidates.push(cand)
  saveCandidates(candidates)
  res.status(201).json(cand)
})

candidatesRouter.put("/:id", (req, res) => {
  const candidates = getCandidates()
  const idx = candidates.findIndex((c) => c.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: "not found" })

  candidates[idx] = { ...candidates[idx], ...req.body }
  saveCandidates(candidates)
  res.json(candidates[idx])
})

candidatesRouter.delete("/:id", (req, res) => {
  let candidates = getCandidates()
  candidates = candidates.filter((c) => c.id !== req.params.id)
  saveCandidates(candidates)
  res.json({ success: true })
})
