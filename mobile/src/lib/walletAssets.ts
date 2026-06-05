import { getUsdValue, type PriceInfo } from "@/src/lib/prices";
import { decodeCurrency } from "@/src/lib/formatters";

export interface WalletAsset {
  id: string;
  currency: string;
  balance: number;
  value: number;
  issuer: string | null;
  walletAddress: string;
}

export interface WalletBalanceSummary {
  xrpBalance: number;
  ownerCount: number;
  reservedXrp: number;
  availableXrp: number;
}

export interface TrustlineRow {
  currency: string;
  balance: string;
  account: string;
}

const BASE_RESERVE_XRP = 1;
const OWNER_RESERVE_XRP = 0.2;

export function parseXrpBalance(raw: unknown): number {
  if (raw === undefined || raw === null) return 0;
  const str = String(raw);
  const num = Number(str);
  if (!Number.isFinite(num)) return 0;
  if (num > 1_000_000 && !str.includes(".")) {
    return num / 1_000_000;
  }
  return num;
}

export function summarizeXrpAccount(infoData: unknown): WalletBalanceSummary {
  const xrpBalance = parseXrpBalance((infoData as { Balance?: unknown })?.Balance);
  const ownerCount = Number((infoData as { OwnerCount?: unknown })?.OwnerCount ?? 0) || 0;
  const reservedXrp = BASE_RESERVE_XRP + OWNER_RESERVE_XRP * ownerCount;
  const availableXrp = Math.max(0, xrpBalance - reservedXrp);
  return { xrpBalance, ownerCount, reservedXrp, availableXrp };
}

export function buildWalletAssets(input: {
  address: string;
  infoData: unknown | undefined;
  lines: TrustlineRow[] | undefined;
  includeZeroXrp?: boolean;
  prices?: PriceInfo[];
}): WalletAsset[] {
  const { address, infoData, lines, includeZeroXrp = true, prices = [] } = input;
  const out: WalletAsset[] = [];

  if (infoData) {
    const xrpBalance = parseXrpBalance((infoData as { Balance?: unknown }).Balance);
    if (includeZeroXrp || xrpBalance > 0) {
      out.push({
        id: `xrp-${address}`,
        currency: "XRP",
        balance: xrpBalance,
        value: getUsdValue("XRP", xrpBalance, prices),
        issuer: null,
        walletAddress: address,
      });
    }
  }

  if (lines) {
    for (const line of lines) {
      const balance = parseFloat(line.balance);
      if (!Number.isFinite(balance) || balance <= 0) continue;
      out.push({
        id: `${line.currency}-${line.account}-${address}`,
        currency: line.currency,
        balance,
        value: getUsdValue(line.currency, balance, prices),
        issuer: line.account,
        walletAddress: address,
      });
    }
  }

  return out;
}

/** Issuer portfolio: outstanding issued IOUs shown as negative balances/USD values. */
export function buildIssuerWalletAssets(input: {
  address: string;
  obligations: Record<string, string> | undefined;
  prices?: PriceInfo[];
}): WalletAsset[] {
  const { address, obligations, prices = [] } = input;
  if (!obligations) return [];

  const out: WalletAsset[] = [];
  for (const [rawCurrency, rawAmount] of Object.entries(obligations)) {
    const issued = parseFloat(rawAmount);
    if (!Number.isFinite(issued) || issued <= 0) continue;
    const currency = decodeCurrency(rawCurrency);
    const balance = -issued;
    out.push({
      id: `issued-${currency}-${address}`,
      currency,
      balance,
      value: getUsdValue(currency, balance, prices),
      issuer: address,
      walletAddress: address,
    });
  }

  return out.sort((a, b) => a.currency.localeCompare(b.currency));
}

export function totalUsdForAssets(assets: WalletAsset[]): number {
  return assets.reduce((acc, a) => acc + (a.value || 0), 0);
}

/** Per-currency max balance across wallets (for Smart Trade max button). */
export function maxBalanceByCurrency(assets: WalletAsset[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const a of assets) {
    const prev = map[a.currency] ?? 0;
    if (a.balance > prev) map[a.currency] = a.balance;
  }
  return map;
}

/** Single-wallet available XRP + trustline balances. */
export function balanceByCurrencyFromWallet(input: {
  summary: WalletBalanceSummary;
  lines: TrustlineRow[] | undefined;
}): Record<string, number> {
  const map: Record<string, number> = { XRP: input.summary.availableXrp };
  if (input.lines) {
    for (const line of input.lines) {
      const v = parseFloat(line.balance);
      if (Number.isFinite(v)) map[line.currency] = v;
    }
  }
  return map;
}
