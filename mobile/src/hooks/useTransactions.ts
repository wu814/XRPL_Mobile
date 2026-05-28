import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAccountTransactions,
  sendCrossCurrency,
  sendIou,
  sendXrp,
  type AccountTransactionsResponse,
} from "@/src/api/transactions";

export const transactionKeys = {
  all: ["transactions"] as const,
  history: (address: string) => [...transactionKeys.all, "history", address] as const,
};

export function useAccountTransactions(address: string | undefined) {
  return useQuery<AccountTransactionsResponse>({
    queryKey: transactionKeys.history(address ?? ""),
    queryFn: () => getAccountTransactions(address!),
    enabled: !!address,
  });
}

export function useSendXrp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: sendXrp,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: transactionKeys.history(vars.walletAddress) });
      qc.invalidateQueries({ queryKey: ["wallets", "info"] });
      qc.invalidateQueries({ queryKey: ["wallets", "lines"] });
    },
  });
}

export function useSendIou() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: sendIou,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: transactionKeys.history(vars.walletAddress) });
      qc.invalidateQueries({ queryKey: ["wallets", "info"] });
      qc.invalidateQueries({ queryKey: ["wallets", "lines"] });
    },
  });
}

export function useSendCrossCurrency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: sendCrossCurrency,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: transactionKeys.history(vars.walletAddress) });
      qc.invalidateQueries({ queryKey: ["wallets", "info"] });
      qc.invalidateQueries({ queryKey: ["wallets", "lines"] });
    },
  });
}
