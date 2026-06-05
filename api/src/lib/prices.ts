/**
 * Static USD prices for the Testnet demo. Used as a fallback when no on-chain
 * price oracle is available. Mobile reads live/static prices via GET /oracle/prices.
 */
export const SUPPORTED_CURRENCIES = ["USD", "XRP", "EUR", "BTC", "ETH", "SOL"] as const;

const STATIC_PRICES: Record<(typeof SUPPORTED_CURRENCIES)[number], number> = {
  USD: 1,
  XRP: 1.34,
  EUR: 1.16,
  BTC: 97969,
  ETH: 2072.65,
  SOL: 84.12,
};

export function staticPriceUSD(currency: string): number | null {
  if (!(currency in STATIC_PRICES)) return null;
  return STATIC_PRICES[currency as keyof typeof STATIC_PRICES];
}
