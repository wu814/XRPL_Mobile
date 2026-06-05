export const DEFAULT_COIN_GECKO_IDS = [
  "ripple",
  "bitcoin",
  "ethereum",
  "euro-coin",
  "solana",
] as const;

export const DEFAULT_VS_CURRENCY = "usd";

export interface CoinGeckoPrice {
  symbol: string;
  price: number;
  quoteAsset: string;
  lastUpdated?: number;
}

const COIN_ID_TO_SYMBOL: Record<string, string> = {
  bitcoin: "BTC",
  ethereum: "ETH",
  ripple: "XRP",
  solana: "SOL",
  cardano: "ADA",
  polkadot: "DOT",
  chainlink: "LINK",
  litecoin: "LTC",
  "bitcoin-cash": "BCH",
  stellar: "XLM",
  "euro-coin": "EUR",
};

export async function fetchCoinGeckoPrices(
  coinIds: string[],
  vsCurrency = "usd",
): Promise<CoinGeckoPrice[]> {
  const vs = vsCurrency.toLowerCase();
  const url = new URL("https://api.coingecko.com/api/v3/simple/price");
  url.searchParams.set("ids", coinIds.join(","));
  url.searchParams.set("vs_currencies", vs);
  url.searchParams.set("include_last_updated_at", "true");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`CoinGecko request failed (${response.status})`);
  }

  const priceData = (await response.json()) as Record<
    string,
    Record<string, number> & { last_updated_at?: number }
  >;

  const prices: CoinGeckoPrice[] = [];
  for (const coinId of coinIds) {
    const entry = priceData[coinId];
    if (!entry?.[vs]) continue;
    prices.push({
      symbol: COIN_ID_TO_SYMBOL[coinId] ?? coinId.toUpperCase(),
      price: entry[vs],
      quoteAsset: vs.toUpperCase(),
      lastUpdated: entry.last_updated_at,
    });
  }

  if (prices.length === 0) {
    throw new Error("No price data retrieved from CoinGecko");
  }

  return prices;
}
