import { useQuery } from "@tanstack/react-query";
import { adminWallets } from "@/src/api/admin";

export const adminKeys = {
  all: ["admin"] as const,
  wallets: () => [...adminKeys.all, "wallets"] as const,
};

export function useAdminWallets(enabled = true) {
  return useQuery({
    queryKey: adminKeys.wallets(),
    queryFn: adminWallets,
    enabled,
  });
}
