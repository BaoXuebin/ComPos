import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { Employee, TravelMode } from "@/types"

export function useEmployees() {
  return useQuery({
    queryKey: ["employees"],
    queryFn: api.getEmployees,
  })
}

export function useCreateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, address, modes }: { name: string; address: string; modes?: TravelMode[] }) =>
      api.createEmployee(name, address, modes),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  })
}

export function useUpdateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Employee> }) =>
      api.updateEmployee(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  })
}

export function useDeleteEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteEmployee(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] })
      qc.invalidateQueries({ queryKey: ["commutes"] })
    },
  })
}

export function useGeocodeAddress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (address: string) => api.geocodeAddress(address),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  })
}
