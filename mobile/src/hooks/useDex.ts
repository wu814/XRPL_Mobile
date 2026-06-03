import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import {
  bookOffers,
  cancelOffer,
  completedOffers,
  createOffer,
  userOffers,
  type CreateOfferRequest,
} from "@/src/api/dex";
import {
  bookOffersQuery,
  type BookOffersQuery,
  type DexCurrencyPair,
} from "@/src/lib/dex";

export const dexKeys = {
  all: ["dex"] as const,
  user: (address: string) => [...dexKeys.all, "user", address] as const,
  completed: (address: string) => [...dexKeys.all, "completed", address] as const,
  book: (params: BookOffersQuery & { side: "sell" | "buy" }) =>
    [...dexKeys.all, "book", params] as const,
};

export function useUserOffers(address: string | undefined) {
  return useQuery({
    queryKey: dexKeys.user(address ?? ""),
    queryFn: () => userOffers(address!),
    enabled: !!address,
  });
}

export function useCompletedOffers(address: string | undefined) {
  return useQuery({
    queryKey: dexKeys.completed(address ?? ""),
    queryFn: () => completedOffers(address!),
    enabled: !!address,
  });
}

export function useBookOffers(params: BookOffersQuery | null) {
  return useQuery({
    queryKey: dexKeys.book({ side: "sell", ...(params ?? { takerGetsCurrency: "", takerPaysCurrency: "" }) }),
    queryFn: () => bookOffers(params!),
    enabled: !!params,
    refetchInterval: 15_000,
  });
}

/** Fetches sell + buy sides of the book (xrpl_mvp getAllSellOffers / getAllBuyOffers). */
export function useDexOrderBook(pair: DexCurrencyPair | null) {
  const sellParams = pair ? bookOffersQuery("sell", pair) : null;
  const buyParams = pair ? bookOffersQuery("buy", pair) : null;

  const [isRefreshing, setIsRefreshing] = useState(false);

  const [sellQuery, buyQuery] = useQueries({
    queries: [
      {
        queryKey: dexKeys.book({ side: "sell", ...sellParams! }),
        queryFn: () => bookOffers(sellParams!),
        enabled: !!sellParams,
        refetchInterval: 15_000,
      },
      {
        queryKey: dexKeys.book({ side: "buy", ...buyParams! }),
        queryFn: () => bookOffers(buyParams!),
        enabled: !!buyParams,
        refetchInterval: 15_000,
      },
    ],
  });

  const refetch = useCallback(() => {
    setIsRefreshing(true);
    void Promise.all([sellQuery.refetch(), buyQuery.refetch()]).finally(() => {
      setIsRefreshing(false);
    });
  }, [sellQuery, buyQuery]);

  return {
    sellOffers: (sellQuery.data ?? []) as Record<string, unknown>[],
    buyOffers: (buyQuery.data ?? []) as Record<string, unknown>[],
    isLoading: sellQuery.isLoading || buyQuery.isLoading,
    isRefreshing,
    isError: sellQuery.isError || buyQuery.isError,
    refetch,
  };
}

function invalidateDexQueries(qc: ReturnType<typeof useQueryClient>, walletAddress: string) {
  qc.invalidateQueries({ queryKey: dexKeys.user(walletAddress) });
  qc.invalidateQueries({ queryKey: dexKeys.completed(walletAddress) });
  qc.invalidateQueries({ queryKey: dexKeys.all });
}

export function useCreateOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOfferRequest) => createOffer(input),
    onSuccess: (_data, vars) => {
      invalidateDexQueries(qc, vars.walletAddress);
    },
  });
}

export function useCancelOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { walletAddress: string; sequence: number }) =>
      cancelOffer(input.walletAddress, input.sequence),
    onSuccess: (_data, vars) => {
      invalidateDexQueries(qc, vars.walletAddress);
    },
  });
}
