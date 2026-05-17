import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  createWallet,
  deleteWallet,
  getWalletInfo,
  getWalletLines,
  listWallets,
  type WalletSummary,
} from "@/src/api/wallets";

export const walletKeys = {
  all: ["wallets"] as const,
  list: () => [...walletKeys.all, "list"] as const,
  info: (address: string) => [...walletKeys.all, "info", address] as const,
  lines: (address: string) => [...walletKeys.all, "lines", address] as const,
};

export function useWallets(): UseQueryResult<WalletSummary[]> {
  return useQuery({ queryKey: walletKeys.list(), queryFn: listWallets });
}

export function useCreateWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createWallet,
    onSuccess: () => qc.invalidateQueries({ queryKey: walletKeys.list() }),
  });
}

export function useDeleteWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (address: string) => deleteWallet(address),
    onSuccess: () => qc.invalidateQueries({ queryKey: walletKeys.list() }),
  });
}

export function useWalletInfo(address: string | undefined) {
  return useQuery({
    queryKey: walletKeys.info(address ?? ""),
    queryFn: () => getWalletInfo(address!),
    enabled: !!address,
  });
}

export function useWalletLines(address: string | undefined) {
  return useQuery({
    queryKey: walletKeys.lines(address ?? ""),
    queryFn: () => getWalletLines(address!),
    enabled: !!address,
  });
}
