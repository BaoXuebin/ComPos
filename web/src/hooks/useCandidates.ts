import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { Candidate } from "@/types"

export function useCandidates() {
  return useQuery({
    queryKey: ["candidates"],
    queryFn: api.getCandidates,
  })
}

export function useCreateCandidate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, address, rent }: { name: string; address: string; rent?: number | null }) =>
      api.createCandidate(name, address, rent),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["candidates"] }),
  })
}

export function useUpdateCandidate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Candidate> }) =>
      api.updateCandidate(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["candidates"] }),
  })
}

export function useDeleteCandidate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteCandidate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["candidates"] })
      qc.invalidateQueries({ queryKey: ["commutes"] })
    },
  })
}
