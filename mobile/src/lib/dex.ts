import { dropsToXrp, formatXrp, xrpToDrops } from "./formatters";
import { availableCurrencies } from "./currencyIcon";
import type { Amount, OfferExecution, OfferFlags } from "@/src/api/dex";

export type DexOrderSide = "buy" | "sell";

export interface DexCurrencyPair {
  base: string;
  quote: string;
  issuerAddress: string;
}

export interface ParsedDexAsset {
  currency: string;
  value: number;
}

export type BookOfferRow = Record<string, unknown>;

export function parseDexAsset(asset: unknown): ParsedDexAsset {
  if (typeof asset === "string") {
    return { currency: "XRP", value: dropsToXrp(asset) };
  }
  if (asset && typeof asset === "object") {
    const o = asset as { currency?: string; value?: string };
    return {
      currency: o.currency ?? "?",
      value: Number(o.value ?? 0),
    };
  }
  return { currency: "?", value: 0 };
}

/** Read TakerGets / TakerPays from book or account offer objects (mixed casing). */
export function offerLeg(offer: BookOfferRow, leg: "gets" | "pays"): unknown {
  if (leg === "gets") {
    return offer.TakerGets ?? offer.taker_gets ?? offer.takerGets;
  }
  return offer.TakerPays ?? offer.taker_pays ?? offer.takerPays;
}

export function sellOfferPrice(offer: BookOfferRow): number {
  const pays = parseDexAsset(offerLeg(offer, "pays"));
  const gets = parseDexAsset(offerLeg(offer, "gets"));
  if (!gets.value) return 0;
  return pays.value / gets.value;
}

export function buyOfferPrice(offer: BookOfferRow): number {
  const pays = parseDexAsset(offerLeg(offer, "pays"));
  const gets = parseDexAsset(offerLeg(offer, "gets"));
  if (!pays.value) return 0;
  return gets.value / pays.value;
}

export function offerBaseQuantity(offer: BookOfferRow, isSell: boolean): number {
  const pays = parseDexAsset(offerLeg(offer, "pays"));
  const gets = parseDexAsset(offerLeg(offer, "gets"));
  return isSell ? gets.value : pays.value;
}

export interface BookOffersQuery {
  takerGetsCurrency: string;
  takerGetsIssuer?: string;
  takerPaysCurrency: string;
  takerPaysIssuer?: string;
}

export function bookOffersQuery(side: "sell" | "buy", pair: DexCurrencyPair): BookOffersQuery {
  const issuer = (currency: string) => (currency === "XRP" ? undefined : pair.issuerAddress);
  if (side === "sell") {
    return {
      takerGetsCurrency: pair.base,
      takerGetsIssuer: issuer(pair.base),
      takerPaysCurrency: pair.quote,
      takerPaysIssuer: issuer(pair.quote),
    };
  }
  return {
    takerGetsCurrency: pair.quote,
    takerGetsIssuer: issuer(pair.quote),
    takerPaysCurrency: pair.base,
    takerPaysIssuer: issuer(pair.base),
  };
}

function toAmount(currency: string, value: number, issuerAddress: string): Amount {
  if (currency === "XRP") return xrpToDrops(value);
  return {
    currency,
    issuer: issuerAddress,
    value: value.toFixed(6).replace(/\.?0+$/, "") || "0",
  };
}

/**
 * Build OfferCreate legs using the same buy/sell mapping as xrpl_mvp.
 */
export function buildOfferAmounts(input: {
  side: DexOrderSide;
  base: string;
  quote: string;
  issuerAddress: string;
  limitPrice: number;
  quantity: number;
}): { takerPays: Amount; takerGets: Amount } {
  const { side, base, quote, issuerAddress, limitPrice, quantity } = input;
  const totalValue = limitPrice * quantity;

  if (side === "buy") {
    return {
      takerPays: toAmount(base, quantity, issuerAddress),
      takerGets: toAmount(quote, totalValue, issuerAddress),
    };
  }
  return {
    takerPays: toAmount(quote, totalValue, issuerAddress),
    takerGets: toAmount(base, quantity, issuerAddress),
  };
}

export const OFFER_EXECUTION_OPTIONS: {
  value: OfferExecution;
  label: string;
  name: string;
  hint: string;
}[] = [
  {
    value: "gtc",
    label: "GTC",
    name: "Good-till-cancel",
    hint: "Rests on the book until filled or cancelled",
  },
  {
    value: "ioc",
    label: "IOC",
    name: "Immediate-or-cancel",
    hint: "Fill immediately; cancel any unfilled amount",
  },
  {
    value: "fok",
    label: "FOK",
    name: "Fill-or-kill",
    hint: "Fill entirely now or cancel the whole order",
  },
];

export function formatExecutionDescription(execution: OfferExecution): string {
  const opt = OFFER_EXECUTION_OPTIONS.find((o) => o.value === execution);
  if (!opt) return "";
  return `${opt.name}: ${opt.hint}`;
}

export const POST_ONLY_OPTION = {
  name: "Post-only",
  hintEnabled: "Won't take existing orders when placed",
  hintDisabled: "Only available with Good-till-cancel",
} as const;

export function formatPostOnlyDescription(enabled: boolean): string {
  return `${POST_ONLY_OPTION.name}: ${
    enabled ? POST_ONLY_OPTION.hintEnabled : POST_ONLY_OPTION.hintDisabled
  }`;
}

export function dexPairKey(base: string, quote: string): string {
  return `${base}/${quote}`;
}

export function buildCreateOfferFlags(
  execution: OfferExecution,
  passive: boolean,
  side: DexOrderSide,
): OfferFlags {
  return {
    execution,
    passive: execution === "gtc" ? passive : false,
    sell: side === "sell",
  };
}

export interface DexPairPreset {
  base: string;
  quote: string;
}

export const DEFAULT_DEX_PAIR: DexPairPreset = { base: "XRP", quote: "USD" };

/** Canonical base/quote: USD is always quote when present; otherwise alphabetical. */
export function canonicalDexPair(a: string, b: string): DexPairPreset {
  if (a === b) throw new Error("Pair currencies must differ");
  if (a === "USD" || b === "USD") {
    const other = a === "USD" ? b : a;
    return { base: other, quote: "USD" };
  }
  return a < b ? { base: a, quote: b } : { base: b, quote: a };
}

/** One entry per market (no USD/XRP and XRP/USD duplicates). */
function buildDexPairPresets(): DexPairPreset[] {
  const ids = availableCurrencies.map((c) => c.id);
  const pairs: DexPairPreset[] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      pairs.push(canonicalDexPair(ids[i], ids[j]));
    }
  }
  return pairs.sort((a, b) => dexPairKey(a.base, a.quote).localeCompare(dexPairKey(b.base, b.quote)));
}

export const DEX_PAIR_PRESETS: DexPairPreset[] = buildDexPairPresets();

export function formatOfferPrice(price: number): string {
  if (!Number.isFinite(price) || price <= 0) return "—";
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(6);
}

export function formatOfferQty(qty: number): string {
  if (!Number.isFinite(qty)) return "0";
  if (qty >= 1000) return qty.toFixed(2);
  if (qty >= 1) return qty.toFixed(4);
  return qty.toFixed(6);
}

export function rippleTimeToDate(rippleTime?: number | string | null): string | null {
  if (rippleTime == null) return null;
  const sec = typeof rippleTime === "string" ? Number(rippleTime) : rippleTime;
  if (Number.isNaN(sec)) return null;
  const unix = (sec + 946684800) * 1000;
  return new Date(unix).toLocaleString();
}

export function formatActiveOfferLeg(asset: unknown): string {
  const p = parseDexAsset(asset);
  if (p.currency === "XRP") return `${formatXrp(p.value, 4)} XRP`;
  return `${formatOfferQty(p.value)} ${p.currency}`;
}
