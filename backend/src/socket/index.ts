import { Server as SocketIOServer } from "socket.io"
import type { Server as HTTPServer } from "http"
import {
  getEmployees,
  getCandidates,
  getCommutes,
  saveCommutes,
  getAnalysis,
  saveAnalysis,
} from "../services/storage.js"
import { batchCalculateRoutes } from "../services/amap.js"
import { streamDeepSeekAnalysis, extractAnalysisJSON } from "../services/deepseek.js"
import { logger } from "../logger.js"
import type { TravelMode, CommuteEntry, CommuteResult } from "../types.js"

const abortFlags = new Map<string, boolean>()

export function setupSocketIO(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  })

  io.on("connection", (socket) => {
    logger.info("Client connected", { id: socket.id })

    // ========== Commute Calculation ==========
    socket.on("commute:calculate", async () => {
      const roomId = socket.id
      abortFlags.set(roomId, false)

      const employees = getEmployees().filter((e) => e.geocoded)
      const candidates = getCandidates().filter((c) => c.geocoded)

      if (employees.length === 0 || candidates.length === 0) {
        socket.emit("commute:error", { message: "没有已定位的员工或候选地点" })
        return
      }

      const ALL_MODES: TravelMode[] = ["driving", "transit", "walking", "cycling"]

      const items: any[] = []
      for (const emp of employees) {
        const empModes = emp.modes?.length ? emp.modes : ALL_MODES
        for (const cand of candidates) {
          for (const mode of empModes) {
            const key = `${emp.id}_${cand.id}`
            const existing = getCommutes()[key]
            if (existing?.[mode] && !existing[mode]?.error) continue
            items.push({
              employeeId: emp.id,
              candidateId: cand.id,
              mode,
              origin: { lng: emp.lng!, lat: emp.lat! },
              destination: { lng: cand.lng!, lat: cand.lat! },
            })
          }
        }
      }

      if (items.length === 0) {
        socket.emit("commute:done", { total: 0, failed: 0 })
        return
      }

      socket.emit("commute:progress", { completed: 0, total: items.length, failed: 0 })

      logger.info("Starting commute calculation", { totalItems: items.length })

      // Track failed count for final event
      let totalFailed = 0

      await batchCalculateRoutes(
        items,
        (completed, total, failed) => {
          totalFailed = failed
          socket.emit("commute:progress", { completed, total, failed })
        },
        (employeeId, candidateId, mode, result) => {
          // Save incrementally
          const key = `${employeeId}_${candidateId}`
          const commutes = getCommutes()
          const existing = commutes[key]
          const entry: CommuteEntry = existing
            ? { ...existing, [mode]: result, calculatedAt: new Date().toISOString() }
            : {
                employeeId,
                candidateId,
                calculatedAt: new Date().toISOString(),
                driving: null,
                transit: null,
                walking: null,
                cycling: null,
                [mode]: result,
              }
          commutes[key] = entry
          saveCommutes(commutes)

          socket.emit("commute:result", { employeeId, candidateId, mode, result })
        },
        { get aborted() { return abortFlags.get(roomId) || false } }
      )

      socket.emit("commute:done", { total: items.length, failed: totalFailed })
      logger.info("Commute calculation completed", { total: items.length, failed: totalFailed })
    })

    socket.on("commute:cancel", () => {
      abortFlags.set(socket.id, true)
      logger.info("Commute calculation cancelled", { id: socket.id })
    })

    // ========== AI Analysis ==========
    socket.on("analysis:start", async () => {
      const roomId = socket.id
      abortFlags.set(roomId + "_analysis", false)

      const employees = getEmployees()
      const candidates = getCandidates()
      const commutes = getCommutes()

      if (candidates.length === 0) {
        socket.emit("analysis:error", { message: "没有候选地点" })
        return
      }
      if (Object.keys(commutes).length === 0) {
        socket.emit("analysis:error", { message: "没有通勤数据，请先计算路线" })
        return
      }

      logger.info("Starting AI analysis")

      let reasoning = ""
      let content = ""

      try {
        const fullContent = await streamDeepSeekAnalysis(
          employees,
          candidates,
          commutes,
          {
            onReasoning: (chunk) => {
              reasoning += chunk
              socket.emit("analysis:reasoning", { chunk })
            },
            onContent: (chunk) => {
              content += chunk
              socket.emit("analysis:content", { chunk })
            },
          },
          { get aborted() { return abortFlags.get(roomId + "_analysis") || false } }
        )

        const parsed = extractAnalysisJSON(content)
        if (parsed) {
          const result = {
            timestamp: new Date().toISOString(),
            scores: parsed.scores,
            reasoning: reasoning + "\n\n" + content,
            recommendedArea: parsed.recommendedArea,
          }
          saveAnalysis(result)
          socket.emit("analysis:done", { result })
          logger.info("AI analysis completed")
        } else {
          socket.emit("analysis:error", { message: "无法解析 AI 分析结果" })
        }
      } catch (err: any) {
        logger.error("AI analysis failed", { error: err.message })
        socket.emit("analysis:error", { message: err.message })
      }
    })

    socket.on("analysis:cancel", () => {
      abortFlags.set(socket.id + "_analysis", true)
      logger.info("AI analysis cancelled", { id: socket.id })
    })

    socket.on("disconnect", () => {
      abortFlags.set(socket.id, true)
      abortFlags.set(socket.id + "_analysis", true)
      logger.info("Client disconnected", { id: socket.id })
    })
  })

  return io
}
