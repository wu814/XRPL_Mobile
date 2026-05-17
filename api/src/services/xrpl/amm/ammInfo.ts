import type { Client } from "xrpl";

export interface FormattedAMMInfo {
  account: string;
  formattedAmount1: { currency: string; issuer: string; value: string };
  formattedAmount2: { currency: string; issuer: string; value: string };
  lpToken: { currency: string; issuer: string; value: string };
  tradingFee: number;
}

function formatAmount(a: unknown): { currency: string; issuer: string; value: string } {
  if (typeof a === "string") {
    return { currency: "XRP", issuer: "", value: (Number(a) / 1_000_000).toString() };
  }
  const obj = a as { currency: string; issuer: string; value: string };
  return { currency: obj.currency, issuer: obj.issuer, value: obj.value };
}

export async function getFormattedAMMInfo(
  client: Client,
  ammAccount: string,
): Promise<FormattedAMMInfo | null> {
  if (!client.isConnected()) await client.connect();
  try {
    const response = await client.request({
      command: "amm_info",
      amm_account: ammAccount,
    });
    const amm = response.result.amm;
    return {
      account: ammAccount,
      formattedAmount1: formatAmount(amm.amount),
      formattedAmount2: formatAmount(amm.amount2),
      lpToken: formatAmount(amm.lp_token),
      tradingFee: (amm as { trading_fee?: number }).trading_fee ?? 0,
    };
  } catch {
    return null;
  }
}
