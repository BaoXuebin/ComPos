import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { AnalysisResult } from "@/types"

export function useAnalysis() {
  return useQuery({
    queryKey: ["analysis"],
    queryFn: api.getAnalysis,
  })
}
