import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { buyNFT, mintAndListNFT, nftsByAccount } from "@/src/api/nft";

export const nftKeys = {
  all: ["nft"] as const,
  byAccount: (address: string) => [...nftKeys.all, "by-account", address] as const,
};

export function useNftsByAccount(address: string | undefined) {
  return useQuery({
    queryKey: nftKeys.byAccount(address ?? ""),
    queryFn: () => nftsByAccount(address!),
    enabled: !!address,
  });
}

export function useMintAndListNFT() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: mintAndListNFT,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: nftKeys.byAccount(vars.walletAddress) });
    },
  });
}

export function useBuyNFT() {
  return useMutation({
    mutationFn: buyNFT,
  });
}
