import type { AMMWithdraw, Client, Wallet } from "xrpl";
import { handleTransactionError, isTypedTransactionSuccessful } from "../../../lib/errorHandler.js";

interface AssetSpec {
  currency: string;
  issuer: string;
}

function toCurrency(a: AssetSpec) {
  return a.currency === "XRP" ? { currency: "XRP" } : { currency: a.currency, issuer: a.issuer };
}

export async function withdrawWithLPToken(
  client: Client,
  wallet: Wallet,
  asset1: AssetSpec,
  asset2: AssetSpec,
  lpToken: { currency: string; issuer: string; value: string },
): Promise<{ hash: string }> {
  if (!client.isConnected()) await client.connect();

  const tx: AMMWithdraw = {
    TransactionType: "AMMWithdraw",
    Account: wallet.classicAddress,
    Asset: toCurrency(asset1) as never,
    Asset2: toCurrency(asset2) as never,
    LPTokenIn: lpToken,
    Flags: 0x00010000, // tfLPToken
  };
  const prepared = await client.autofill(tx);
  const signed = wallet.sign(prepared);
  const result = await client.submitAndWait<AMMWithdraw>(signed.tx_blob);
  if (!isTypedTransactionSuccessful(result)) {
    const err = handleTransactionError(result, "withdrawWithLPToken");
    throw new Error(err.message);
  }
  return { hash: result.result.hash };
}
