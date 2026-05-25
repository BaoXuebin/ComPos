import { Router } from "express"
import { v4 as uuid } from "uuid"
import { getEmployees, saveEmployees } from "../services/storage.js"

export const employeesRouter = Router()

employeesRouter.get("/", (_req, res) => {
  res.json(getEmployees())
})

employeesRouter.post("/", (req, res) => {
  const { name, address, modes } = req.body
  if (!name || !address) return res.status(400).json({ error: "name and address are required" })

  const employees = getEmployees()
  const emp = { id: uuid(), name, address, lng: null, lat: null, geocoded: false, geocodeError: null, modes: Array.isArray(modes) ? modes : [] }
  employees.push(emp)
  saveEmployees(employees)
  res.status(201).json(emp)
})

employeesRouter.put("/:id", (req, res) => {
  const employees = getEmployees()
  const idx = employees.findIndex((e) => e.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: "not found" })

  const existing = employees[idx]
  const updates = { ...req.body }

  // 地址变了就重置定位状态
  if (updates.address && updates.address !== existing.address) {
    updates.lng = null
    updates.lat = null
    updates.geocoded = false
    updates.geocodeError = null
  }

  employees[idx] = { ...existing, ...updates }
  saveEmployees(employees)
  res.json(employees[idx])
})

employeesRouter.delete("/:id", (req, res) => {
  let employees = getEmployees()
  employees = employees.filter((e) => e.id !== req.params.id)
  saveEmployees(employees)
  res.json({ success: true })
})
