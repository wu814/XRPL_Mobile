/**
 * Static USD prices for testnet demo. The xrpl_mvp web app fetches these from
 * an XRPL Price Oracle; for the mobile demo we use the same hardcoded values
 * shown in the web app's screenshots so totals match.
 */

export interface PriceInfo {
  baseAsset: string;
  price: number;
  available: boolean;
}

export const STATIC_PRICES: PriceInfo[] = [
  { baseAsset: "USD", price: 1, available: true },
  { baseAsset: "XRP", price: 1.34, available: true },
  { baseAsset: "EUR", price: 1.16, available: true },
  { baseAsset: "BTC", price: 97969, available: true },
  { baseAsset: "ETH", price: 2072.65, available: true },
  { baseAsset: "SOL", price: 84.12, available: true },
];

export const STATIC_CHANGE_24H: Record<string, string> = {
  XRP: "2.3",
  USD: "1.5",
  EUR: "1.5",
  BTC: "1.5",
  ETH: "1.5",
  SOL: "1.5",
};

export function getUsdValue(currency: string, amount: number, prices: PriceInfo[] = STATIC_PRICES): number {
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

export function formatBalance(value: number, maxDecimals = 6): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0";
  const minFractionDigits = Math.min(2, maxDecimals);
  return num.toLocaleString("en-US", {
    minimumFractionDigits: minFractionDigits,
    maximumFractionDigits: maxDecimals,
  });
}
