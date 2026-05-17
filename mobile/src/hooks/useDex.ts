import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  bookOffers,
  cancelOffer,
  completedOffers,
  createOffer,
  userOffers,
  type CreateOfferRequest,
} from "@/src/api/dex";

export const dexKeys = {
  all: ["dex"] as const,
  user: (address: string) => [...dexKeys.all, "user", address] as const,
  completed: (address: string) => [...dexKeys.all, "completed", address] as const,
  book: (params: object) => [...dexKeys.all, "book", params] as const,
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

export function useBookOffers(params: {
  takerGetsCurrency: string;
  takerGetsIssuer?: string;
  takerPaysCurrency: string;
  takerPaysIssuer?: string;
} | null) {
  return useQuery({
    queryKey: dexKeys.book(params ?? {}),
    queryFn: () => bookOffers(params!),
    enabled: !!params,
  });
}

export function useCreateOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOfferRequest) => createOffer(input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: dexKeys.user(vars.walletAddress) });
    },
  });
}

export function useCancelOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { walletAddress: string; sequence: number }) =>
      cancelOffer(input.walletAddress, input.sequence),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: dexKeys.user(vars.walletAddress) });
    },
  });
}
