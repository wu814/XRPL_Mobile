import type { Client } from "xrpl";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPPORTED_CURRENCIES, staticPriceUSD } from "../../../lib/prices.js";
import {
  DEFAULT_COIN_GECKO_IDS,
  DEFAULT_VS_CURRENCY,
  fetchCoinGeckoPrices,
} from "./coinGecko.js";
import { DEFAULT_ORACLE_DOCUMENT_ID, getTreasuryAddress } from "./oracleConfig.js";
import { getOracleData } from "./oracleData.js";

export type PriceSource = "coingecko" | "oracle" | "static";

export interface LivePriceInfo {
  baseAsset: string;
  price: number;
  available: boolean;
  source: PriceSource;
}

export interface LivePricesResult {
  prices: LivePriceInfo[];
  oracleAvailable: boolean;
  dataSource: PriceSource;
  lastUpdateTime: number | null;
}

function buildPriceList(input: {
  coinGeckoPrices: Map<string, number> | null;
  oraclePrices: Map<string, number> | null;
}): LivePriceInfo[] {
  return SUPPORTED_CURRENCIES.map((currency) => {
    if (currency === "USD") {
      return { baseAsset: "USD", price: 1, available: true, source: "static" as const };
    }

    const coinGeckoPrice = input.coinGeckoPrices?.get(currency);
    if (coinGeckoPrice) {
      return { baseAsset: currency, price: coinGeckoPrice, available: true, source: "coingecko" as const };
    }

    const oraclePrice = input.oraclePrices?.get(currency);
    if (oraclePrice) {
      return { baseAsset: currency, price: oraclePrice, available: true, source: "oracle" as const };
    }

    const fallback = staticPriceUSD(currency);
    return {
      baseAsset: currency,
      price: fallback ?? 0,
      available: !!fallback,
      source: "static" as const,
    };
  });
}

async function loadOraclePrices(
  client: Client,
  supabase: SupabaseClient,
): Promise<{ prices: Map<string, number>; lastUpdateTime: number | null } | null> {
  const treasuryAddress = await getTreasuryAddress(supabase);
  if (!treasuryAddress) return null;

  const { oracle } = await getOracleData(client, treasuryAddress, DEFAULT_ORACLE_DOCUMENT_ID);
  const prices = new Map<string, number>();
  for (const series of oracle.PriceDataSeries ?? []) {
    const { BaseAsset, QuoteAsset, AssetPriceDecimal } = series.PriceData;
    if (QuoteAsset !== "USD" || !AssetPriceDecimal || AssetPriceDecimal <= 0) continue;
    prices.set(BaseAsset, AssetPriceDecimal);
  }

  if (prices.size === 0) return null;
  return { prices, lastUpdateTime: oracle.LastUpdateTime ?? null };
}

/**
 * Return USD prices for supported currencies.
 * Tries CoinGecko first (mirrors xrpl_mvp), then on-chain oracle, then static demo prices.
 */
export async function getLivePrices(
  client: Client,
  supabase: SupabaseClient,
): Promise<LivePricesResult> {
  let coinGeckoPrices: Map<string, number> | null = null;
  let dataSource: PriceSource = "static";

  try {
    const live = await fetchCoinGeckoPrices([...DEFAULT_COIN_GECKO_IDS], DEFAULT_VS_CURRENCY);
    coinGeckoPrices = new Map(live.map((p) => [p.symbol, p.price]));
    dataSource = "coingecko";
  } catch {
    // Fall through to oracle/static.
  }

  let oraclePrices: Map<string, number> | null = null;
  let lastUpdateTime: number | null = null;
  let oracleAvailable = false;

  try {
    const oracle = await loadOraclePrices(client, supabase);
    if (oracle) {
      oraclePrices = oracle.prices;
      lastUpdateTime = oracle.lastUpdateTime;
      oracleAvailable = true;
      if (!coinGeckoPrices) dataSource = "oracle";
    }
  } catch {
    // Fall through to static prices.
  }

  return {
    prices: buildPriceList({ coinGeckoPrices, oraclePrices }),
    oracleAvailable,
    dataSource,
    lastUpdateTime,
  };
}
