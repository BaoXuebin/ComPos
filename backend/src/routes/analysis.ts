import { Router } from "express"
import { getAnalysis, saveAnalysis } from "../services/storage.js"

export const analysisRouter = Router()

analysisRouter.get("/", (_req, res) => {
  res.json(getAnalysis())
})
