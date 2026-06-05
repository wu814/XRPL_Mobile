/**
 * USD price helpers. Live prices come from GET /oracle/prices (on-chain oracle
 * with server-side static fallback).
 */

export type PriceSource = "coingecko" | "oracle" | "static";

export interface PriceInfo {
  baseAsset: string;
  price: number;
  available: boolean;
  source?: PriceSource;
}

export function getUsdValue(currency: string, amount: number, prices: PriceInfo[] = []): number {
  if (!currency || !amount) return 0;
  if (currency === "USD") return amount;
  const info = prices.find((p) => p.baseAsset === currency && p.available);
  if (!info) return 0;
  return amount * info.price;
}

export function formatUsd(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** USD with leading `$`, placing the minus sign before the currency symbol when negative. */
export function formatUsdDisplay(value: number): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return `$${formatUsd(0)}`;
  if (n < 0) return `-$${formatUsd(Math.abs(n))}`;
  return `$${formatUsd(n)}`;
}

export function formatBalance(value: number, maxDecimals = 6): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0";
  const minFractionDigits = Math.min(2, maxDecimals);
  return num.toLocaleString("en-US", {
    minimumFractionDigits: minFractionDigits,
    maximumFractionDigits: maxDecimals,
  });
}
