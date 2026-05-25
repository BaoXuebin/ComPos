import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const config = {
  port: parseInt(process.env.PORT || "3001"),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  dataDir: path.resolve(__dirname, "..", "data"),
}
