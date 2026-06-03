/**
 * Static USD prices for the Testnet demo. Mirrors the mobile app's hardcoded
 * values (mobile/src/lib/prices.ts) so welcome-bonus amounts line up with the
 * balances shown in the UI. Used as a fallback when no on-chain price oracle
 * is available.
 */
interface StaticPrice {
  baseAsset: string;
  price: number;
}

const STATIC_PRICES: StaticPrice[] = [
  { baseAsset: "USD", price: 1 },
  { baseAsset: "XRP", price: 1.34 },
  { baseAsset: "EUR", price: 1.16 },
  { baseAsset: "BTC", price: 97969 },
  { baseAsset: "ETH", price: 2072.65 },
  { baseAsset: "SOL", price: 84.12 },
];

export function staticPriceUSD(currency: string): number | null {
  const found = STATIC_PRICES.find((p) => p.baseAsset === currency);
  return found ? found.price : null;
}
