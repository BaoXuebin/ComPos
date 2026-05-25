import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { CommuteEntry } from "@/types"

export function useCommutes() {
  return useQuery({
    queryKey: ["commutes"],
    queryFn: api.getCommutes,
    initialData: {} as Record<string, CommuteEntry>,
    staleTime: 0,
  })
}

export function useClearCommutes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.clearCommutes(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["commutes"] }),
  })
}
