import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  authorizeTrustline,
  freezeTrustline,
  setTrustline,
} from "@/src/api/trustlines";
import { authorizeDeposit } from "@/src/api/wallets";
import { clawback } from "@/src/api/transactions";
import { deleteOracle, setOracle } from "@/src/api/oracle";
import { livePriceKeys } from "./useLivePrices";

function useLedgerInvalidation() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["wallets", "lines"] });
    qc.invalidateQueries({ queryKey: ["wallets", "info"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
  };
}

export function useSetTrustline() {
  const qc = useQueryClient();
  const invalidate = useLedgerInvalidation();
  return useMutation({
    mutationFn: setTrustline,
    onSuccess: (result) => {
      invalidate();
      if (result.welcomeBonusPending) {
        // Bonus payment validates ~1 ledger after the HTTP response (~4s).
        for (const delayMs of [5000, 10000]) {
          setTimeout(() => {
            qc.invalidateQueries({ queryKey: ["wallets", "lines"] });
            qc.invalidateQueries({ queryKey: ["wallets", "info"] });
            qc.invalidateQueries({ queryKey: ["transactions"] });
          }, delayMs);
        }
      }
    },
  });
}

export function useAuthorizeTrustline() {
  const invalidate = useLedgerInvalidation();
  return useMutation({ mutationFn: authorizeTrustline, onSuccess: invalidate });
}

export function useFreezeTrustline() {
  const invalidate = useLedgerInvalidation();
  return useMutation({ mutationFn: freezeTrustline, onSuccess: invalidate });
}

export function useAuthorizeDeposit() {
  const invalidate = useLedgerInvalidation();
  return useMutation({ mutationFn: authorizeDeposit, onSuccess: invalidate });
}

export function useClawback() {
  const invalidate = useLedgerInvalidation();
  return useMutation({ mutationFn: clawback, onSuccess: invalidate });
}

export function useSetOracle() {
  const qc = useQueryClient();
  const invalidate = useLedgerInvalidation();
  return useMutation({
    mutationFn: setOracle,
    onSuccess: async () => {
      invalidate();
      await qc.invalidateQueries({ queryKey: livePriceKeys.all });
    },
  });
}

export function useDeleteOracle() {
  const qc = useQueryClient();
  const invalidate = useLedgerInvalidation();
  return useMutation({
    mutationFn: deleteOracle,
    onSuccess: async () => {
      invalidate();
      await qc.invalidateQueries({ queryKey: livePriceKeys.all });
    },
  });
}
