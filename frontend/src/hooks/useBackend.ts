import { useQuery } from "@tanstack/react-query";

import { api } from "../lib/api";

export function useDeployment() {
  return useQuery({ queryKey: ["config"], queryFn: api.getConfig, staleTime: Infinity });
}

export function useOracle() {
  return useQuery({ queryKey: ["oracle"], queryFn: api.getOracle, refetchInterval: 4000 });
}

export function useLendingStats() {
  return useQuery({ queryKey: ["lendingStats"], queryFn: api.getLendingStats, refetchInterval: 5000 });
}

export function useInsuranceStats() {
  return useQuery({ queryKey: ["insuranceStats"], queryFn: api.getInsuranceStats, refetchInterval: 5000 });
}

export function usePosition(id: number | null) {
  return useQuery({
    queryKey: ["position", id],
    queryFn: () => api.getPosition(id as number),
    enabled: id !== null && id > 0,
    refetchInterval: 4000,
  });
}
