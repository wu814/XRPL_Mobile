import type { Client, LedgerEntryRequest } from "xrpl";
import type { SupabaseClient } from "@supabase/supabase-js";
import { staticPriceUSD } from "../../../lib/prices.js";

const ORACLE_DOCUMENT_ID = 1;

interface LivePriceResult {
  available: boolean;
  price: number;
  source: "oracle" | "static" | "none";
  reason?: string;
}

function decodeAssetPrice(assetPrice: string | number, scale: number): number {
  let raw: number;
  if (typeof assetPrice === "string") {
    const hex = assetPrice.startsWith("0x") ? assetPrice : `0x${assetPrice}`;
    raw = parseInt(hex, 16);
  } else {
    raw = assetPrice;
  }
  return raw / Math.pow(10, scale || 0);
}

/**
 * Look up the USD price per unit for a currency symbol.
 *
 * Mirrors xrpl_mvp: prefer the on-chain XRPL Price Oracle owned by the treasury
 * wallet, then fall back to the static demo prices. USD short-circuits to 1.
 */
export async function getLivePriceUSD(
  client: Client,
  supabase: SupabaseClient,
  currency: string,
): Promise<LivePriceResult> {
  if (currency === "USD") return { available: true, price: 1, source: "static" };

  try {
    const { data: treasuryRows } = await supabase
      .from("wallets")
      .select("classic_address")
      .eq("wallet_type", "treasury")
      .order("created_at", { ascending: true });
    const treasuryAddress = treasuryRows?.[0]?.classic_address as string | undefined;

    if (treasuryAddress) {
      if (!client.isConnected()) await client.connect();
      const request: LedgerEntryRequest = {
        command: "ledger_entry",
        oracle: {
          account: treasuryAddress,
          oracle_document_id: ORACLE_DOCUMENT_ID,
        },
        ledger_index: "validated",
      };
      const response = await client.request(request);
      const node = (response.result as { node?: { PriceDataSeries?: unknown[] } }).node;
      const series = node?.PriceDataSeries as
        | Array<{ PriceData: { BaseAsset: string; QuoteAsset: string; AssetPrice: string | number; Scale: number } }>
        | undefined;
      const match = series?.find(
        (s) => s.PriceData?.BaseAsset === currency && s.PriceData?.QuoteAsset === "USD",
      );
      if (match) {
        const price = decodeAssetPrice(match.PriceData.AssetPrice, match.PriceData.Scale);
        if (price > 0) return { available: true, price, source: "oracle" };
      }
    }
  } catch {
    // Fall through to the static price table.
  }

  const fallback = staticPriceUSD(currency);
  if (fallback && fallback > 0) {
    return { available: true, price: fallback, source: "static" };
  }
  return {
    available: false,
    price: 0,
    source: "none",
    reason: `No USD price available for ${currency}`,
  };
}
