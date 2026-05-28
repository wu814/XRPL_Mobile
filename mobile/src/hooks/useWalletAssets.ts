import { useMemo } from "react";
import { useWalletInfo, useWalletLines } from "./useWallets";
import {
  STATIC_CHANGE_24H,
  STATIC_PRICES,
  getUsdValue,
} from "@/src/lib/prices";

export interface WalletAsset {
  id: string;
  currency: string;
  balance: number;
  value: number;
  change24h: string;
  issuer: string | null;
  walletAddress: string;
}

export interface WalletBalanceSummary {
  xrpBalance: number;
  ownerCount: number;
  reservedXrp: number;
  availableXrp: number;
}

const BASE_RESERVE_XRP = 1;
const OWNER_RESERVE_XRP = 0.2;

function parseXrpBalance(raw: unknown): number {
  if (raw === undefined || raw === null) return 0;
  const str = String(raw);
  const num = Number(str);
  if (!Number.isFinite(num)) return 0;
  // The backend converts drops -> xrp string (e.g. "100"), but we still see
  // raw drops on some clients. Heuristic: anything > 1e6 is likely drops.
  if (num > 1_000_000 && !str.includes(".")) {
    return num / 1_000_000;
  }
  return num;
}

export function useWalletAssets(address: string | undefined) {
  const info = useWalletInfo(address);
  const lines = useWalletLines(address);

  const summary = useMemo<WalletBalanceSummary>(() => {
    const xrpBalance = parseXrpBalance((info.data as any)?.Balance);
    const ownerCount = Number((info.data as any)?.OwnerCount ?? 0) || 0;
    const reservedXrp = BASE_RESERVE_XRP + OWNER_RESERVE_XRP * ownerCount;
    const availableXrp = Math.max(0, xrpBalance - reservedXrp);
    return { xrpBalance, ownerCount, reservedXrp, availableXrp };
  }, [info.data]);

  const assets = useMemo<WalletAsset[]>(() => {
    if (!address) return [];
    const out: WalletAsset[] = [];

    if (info.data) {
      const xrpBalance = summary.xrpBalance;
      out.push({
        id: "xrp-native",
        currency: "XRP",
        balance: xrpBalance,
        value: getUsdValue("XRP", xrpBalance, STATIC_PRICES),
        change24h: STATIC_CHANGE_24H.XRP ?? "0",
        issuer: null,
        walletAddress: address,
      });
    }

    if (lines.data) {
      for (const line of lines.data as Array<{
        currency: string;
        balance: string;
        account: string;
      }>) {
        const balance = parseFloat(line.balance);
        if (!Number.isFinite(balance) || balance <= 0) continue;
        out.push({
          id: `${line.currency}-${line.account}`,
          currency: line.currency,
          balance,
          value: getUsdValue(line.currency, balance, STATIC_PRICES),
          change24h: STATIC_CHANGE_24H[line.currency] ?? "0",
          issuer: line.account,
          walletAddress: address,
        });
      }
    }

    return out;
  }, [address, info.data, lines.data, summary.xrpBalance]);

  const totalUsd = useMemo(
    () => assets.reduce((acc, a) => acc + (a.value || 0), 0),
    [assets],
  );

  const balanceByCurrency = useMemo(() => {
    const map: Record<string, number> = {};
    map.XRP = summary.availableXrp;
    if (lines.data) {
      for (const line of lines.data as Array<{ currency: string; balance: string }>) {
        const v = parseFloat(line.balance);
        if (Number.isFinite(v)) map[line.currency] = v;
      }
    }
    return map;
  }, [lines.data, summary.availableXrp]);

  return {
    isLoading: info.isLoading || lines.isLoading,
    error: info.error || lines.error,
    summary,
    assets,
    totalUsd,
    balanceByCurrency,
    refetch: async () => {
      await Promise.all([info.refetch(), lines.refetch()]);
    },
  };
}
