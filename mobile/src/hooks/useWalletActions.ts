import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  authorizeTrustline,
  freezeTrustline,
  setTrustline,
} from "@/src/api/trustlines";
import { authorizeDeposit } from "@/src/api/wallets";
import { clawback } from "@/src/api/transactions";
import { deleteOracle, setOracle } from "@/src/api/oracle";

function useLedgerInvalidation() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["wallets", "lines"] });
    qc.invalidateQueries({ queryKey: ["wallets", "info"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
  };
}

export function useSetTrustline() {
  const invalidate = useLedgerInvalidation();
  return useMutation({ mutationFn: setTrustline, onSuccess: invalidate });
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
  const invalidate = useLedgerInvalidation();
  return useMutation({ mutationFn: setOracle, onSuccess: invalidate });
}

export function useDeleteOracle() {
  const invalidate = useLedgerInvalidation();
  return useMutation({ mutationFn: deleteOracle, onSuccess: invalidate });
}
