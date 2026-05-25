import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { AnalysisResult } from "@/types"

export function useAnalysis() {
  return useQuery({
    queryKey: ["analysis"],
    queryFn: api.getAnalysis,
  })
}

export function useClearAnalysis() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.clearAnalysis(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["analysis"] }),
  })
}
