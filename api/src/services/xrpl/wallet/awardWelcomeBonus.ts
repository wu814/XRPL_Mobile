import type { AccountInfoResponse, Client } from "xrpl";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadWalletByAddress } from "./loadWallet.js";
import { getLivePriceUSD } from "../oracle/getLivePriceUSD.js";
import { authorizeTrustline } from "../trustline/authorizeTrustline.js";
import { sendIOU } from "../transaction/sendIOU.js";

const WELCOME_BONUS_USD = 1000;
// lsfRequireAuth on the AccountRoot Flags bitfield.
const LSF_REQUIRE_AUTH = 0x00040000;

export interface WelcomeBonusInfo {
  currency: string;
  amount: string;
  usdValue: number;
  pricePerUnitUSD: number;
  skipped: boolean;
  skipReason?: string;
  transactionHash?: string;
}

async function issuerRequiresAuth(client: Client, issuerAddress: string): Promise<boolean> {
  const info: AccountInfoResponse = await client.request({
    command: "account_info",
    account: issuerAddress,
    ledger_index: "validated",
  });
  const flags = Number(info.result.account_data.Flags ?? 0);
  return (flags & LSF_REQUIRE_AUTH) !== 0;
}

/**
 * Issue the first-time welcome bonus from the issuer wallet to a user.
 *
 * Mirrors xrpl_mvp: the gift is worth a fixed USD amount, priced via the live
 * oracle/static price, and the issuer authorizes the holder's trustline first
 * if it requires authorization. Never throws — on any failure it returns a
 * `skipped` result so the caller can still report the trustline as set.
 */
export async function awardWelcomeBonus(params: {
  client: Client;
  supabase: SupabaseClient;
  recipientAddress: string;
  issuerAddress: string;
  currency: string;
}): Promise<WelcomeBonusInfo> {
  const { client, supabase, recipientAddress, issuerAddress, currency } = params;

  const skipped = (reason: string): WelcomeBonusInfo => ({
    currency,
    amount: "0",
    usdValue: WELCOME_BONUS_USD,
    pricePerUnitUSD: 0,
    skipped: true,
    skipReason: reason,
  });

  try {
    const priceResult = await getLivePriceUSD(client, supabase, currency);
    if (!priceResult.available || priceResult.price <= 0) {
      return skipped(priceResult.reason || `USD price for ${currency} is unavailable`);
    }

    const rawAmount = WELCOME_BONUS_USD / priceResult.price;
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
      return skipped(`Computed bonus amount is invalid for ${currency}`);
    }
    // Round down to 6 decimals (well within XRPL IOU precision).
    const amountString = (Math.floor(rawAmount * 1e6) / 1e6).toString();

    let issuerWallet;
    try {
      ({ wallet: issuerWallet } = await loadWalletByAddress(supabase, issuerAddress));
    } catch {
      return skipped("Issuer wallet is not managed by this server");
    }

    if (await issuerRequiresAuth(client, issuerAddress)) {
      await authorizeTrustline(client, issuerWallet, currency, recipientAddress);
    }

    const { hash } = await sendIOU(client, issuerWallet, recipientAddress, {
      currency,
      issuer: issuerAddress,
      value: amountString,
    });

    return {
      currency,
      amount: amountString,
      usdValue: WELCOME_BONUS_USD,
      pricePerUnitUSD: priceResult.price,
      skipped: false,
      transactionHash: hash,
    };
  } catch (err) {
    return skipped(err instanceof Error ? err.message : "Unknown error issuing welcome bonus");
  }
}
