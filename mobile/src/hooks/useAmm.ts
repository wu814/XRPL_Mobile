import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addLiquidity,
  ammSwap,
  getAmm,
  listAmms,
  withdrawLiquidity,
} from "@/src/api/amm";

export const ammKeys = {
  all: ["amm"] as const,
  list: () => [...ammKeys.all, "list"] as const,
  detail: (account: string) => [...ammKeys.all, "detail", account] as const,
};

export function useAmms() {
  return useQuery({ queryKey: ammKeys.list(), queryFn: listAmms });
}

export function useAmm(account: string | undefined) {
  return useQuery({
    queryKey: ammKeys.detail(account ?? ""),
    queryFn: () => getAmm(account!),
    enabled: !!account,
  });
}

export function useAddLiquidity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: addLiquidity,
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ammKeys.detail(vars.account) }),
  });
}

export function useWithdrawLiquidity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: withdrawLiquidity,
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ammKeys.detail(vars.account) }),
  });
}

export function useAmmSwap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ammSwap,
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ammKeys.detail(vars.account) }),
  });
}
