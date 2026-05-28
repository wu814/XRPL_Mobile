import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  getWalletInfo,
  getWalletLines,
} from "@/src/api/wallets";
import { walletKeys } from "./useWallets";
import {
  STATIC_CHANGE_24H,
  STATIC_PRICES,
  getUsdValue,
} from "@/src/lib/prices";
import type { WalletAsset } from "./useWalletAssets";

const BASE_RESERVE_XRP = 1;
const OWNER_RESERVE_XRP = 0.2;

function parseXrpBalance(raw: unknown): number {
  if (raw === undefined || raw === null) return 0;
  const str = String(raw);
  const num = Number(str);
  if (!Number.isFinite(num)) return 0;
  if (num > 1_000_000 && !str.includes(".")) return num / 1_000_000;
  return num;
}

/**
 * Fetch and aggregate asset data across many wallet addresses.
 *
 * Returns combined balances, USD-valued asset rows (one per wallet+trustline),
 * an aggregate XRP available balance, and a totalUsd across every wallet.
 */
export function useAllWalletAssets(addresses: string[]) {
  const infoQueries = useQueries({
    queries: addresses.map((address) => ({
      queryKey: walletKeys.info(address),
      queryFn: () => getWalletInfo(address),
      enabled: !!address,
    })),
  });

  const linesQueries = useQueries({
    queries: addresses.map((address) => ({
      queryKey: walletKeys.lines(address),
      queryFn: () => getWalletLines(address),
      enabled: !!address,
    })),
  });

  const isLoading =
    infoQueries.some((q) => q.isLoading) || linesQueries.some((q) => q.isLoading);

  const assets = useMemo<WalletAsset[]>(() => {
    const out: WalletAsset[] = [];
    addresses.forEach((address, i) => {
      const info = infoQueries[i]?.data as any;
      const lines = linesQueries[i]?.data as
        | Array<{ currency: string; balance: string; account: string }>
        | undefined;

      if (info) {
        const xrpBalance = parseXrpBalance(info.Balance);
        if (xrpBalance > 0) {
          out.push({
            id: `xrp-${address}`,
            currency: "XRP",
            balance: xrpBalance,
            value: getUsdValue("XRP", xrpBalance, STATIC_PRICES),
            change24h: STATIC_CHANGE_24H.XRP ?? "0",
            issuer: null,
            walletAddress: address,
          });
        }
      }

      if (lines) {
        for (const line of lines) {
          const balance = parseFloat(line.balance);
          if (!Number.isFinite(balance) || balance <= 0) continue;
          out.push({
            id: `${line.currency}-${line.account}-${address}`,
            currency: line.currency,
            balance,
            value: getUsdValue(line.currency, balance, STATIC_PRICES),
            change24h: STATIC_CHANGE_24H[line.currency] ?? "0",
            issuer: line.account,
            walletAddress: address,
          });
        }
      }
    });
    return out;
  }, [addresses, infoQueries, linesQueries]);

  const totalUsd = useMemo(
    () => assets.reduce((acc, a) => acc + (a.value || 0), 0),
    [assets],
  );

  // Aggregate balance-by-currency across every wallet, picking the largest
  // single-wallet balance so the Smart Trade sheet can show a usable Max button.
  const balanceByCurrency = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of assets) {
      const prev = map[a.currency] ?? 0;
      if (a.balance > prev) map[a.currency] = a.balance;
    }
    return map;
  }, [assets]);

  const refetch = async () => {
    await Promise.all([
      ...infoQueries.map((q) => q.refetch()),
      ...linesQueries.map((q) => q.refetch()),
    ]);
  };

  return { isLoading, assets, totalUsd, balanceByCurrency, refetch };
}
