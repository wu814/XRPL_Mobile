import type { Amount, Currency } from "xrpl";

export interface PoolAsset {
  currency: string;
  issuer: string;
  value?: string;
}

export function toCurrency(a: PoolAsset): Currency {
  return a.currency === "XRP" ? { currency: "XRP" } : { currency: a.currency, issuer: a.issuer };
}

export function toAmount(a: PoolAsset & { value: string }): Amount {
  if (a.currency === "XRP") return Math.floor(Number(a.value) * 1_000_000).toString();
  return { currency: a.currency, issuer: a.issuer, value: a.value };
}

export function pickPoolAssets(
  amount1: PoolAsset,
  amount2: PoolAsset,
  selectedCurrency: string,
): { deposit: PoolAsset; other: PoolAsset } {
  if (selectedCurrency === amount1.currency) return { deposit: amount1, other: amount2 };
  if (selectedCurrency === amount2.currency) return { deposit: amount2, other: amount1 };
  throw new Error(`Currency ${selectedCurrency} not found in AMM pool`);
}

export function zeroAmount(asset: PoolAsset): Amount {
  if (asset.currency === "XRP") return "0";
  return { currency: asset.currency, issuer: asset.issuer, value: "0" };
}
