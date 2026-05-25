import path from "path"
import express from "express"
import cors from "cors"
import { createServer } from "http"
import { config } from "./config.js"
import { logger } from "./logger.js"
import { employeesRouter } from "./routes/employees.js"
import { candidatesRouter } from "./routes/candidates.js"
import { geocodeRouter } from "./routes/geocode.js"
import { commutesRouter } from "./routes/commutes.js"
import { analysisRouter } from "./routes/analysis.js"
import { settingsRouter } from "./routes/settings.js"
import { mapConfigRouter } from "./routes/mapConfig.js"
import { setupSocketIO } from "./socket/index.js"

const app = express()
const httpServer = createServer(app)

// Middleware
app.use(cors({ origin: config.corsOrigin }))
app.use(express.json())

// REST API routes
app.use("/api/employees", employeesRouter)
app.use("/api/candidates", candidatesRouter)
app.use("/api/geocode", geocodeRouter)
app.use("/api/commutes", commutesRouter)
app.use("/api/analysis", analysisRouter)
app.use("/api/settings", settingsRouter)
app.use("/api/map-sdk-url", mapConfigRouter)

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() })
})

// Serve frontend static files in production
if (config.publicDir) {
  app.use(express.static(config.publicDir))
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next()
    res.sendFile(path.join(config.publicDir, "index.html"))
  })
}

// Socket.IO
setupSocketIO(httpServer)

// Start
httpServer.listen(config.port, () => {
  logger.info(`Backend server running on http://localhost:${config.port}`)
})
