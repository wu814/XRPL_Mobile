import { useQuery } from "@tanstack/react-query";
import { getLivePrices } from "@/src/api/oracle";

export const livePriceKeys = {
  all: ["oracle", "prices"] as const,
};

export function useLivePrices() {
  const query = useQuery({
    queryKey: livePriceKeys.all,
    queryFn: getLivePrices,
    staleTime: 0,
  });

  const prices = query.data?.prices ?? [];

  return {
    prices,
    dataSource: query.data?.dataSource ?? "static",
    oracleAvailable: query.data?.oracleAvailable ?? false,
    lastUpdateTime: query.data?.lastUpdateTime ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
