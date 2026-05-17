import type { Client, TrustSet, Wallet } from "xrpl";
import { handleTransactionError, isTypedTransactionSuccessful } from "../../../lib/errorHandler.js";

export async function setTrustline(
  client: Client,
  wallet: Wallet,
  currency: string,
  issuer: string,
  limit: string,
): Promise<{ hash: string }> {
  if (!client.isConnected()) await client.connect();

  const tx: TrustSet = {
    TransactionType: "TrustSet",
    Account: wallet.classicAddress,
    LimitAmount: { currency, issuer, value: limit },
  };
  const prepared = await client.autofill(tx);
  const signed = wallet.sign(prepared);
  const result = await client.submitAndWait<TrustSet>(signed.tx_blob);
  if (!isTypedTransactionSuccessful(result)) {
    const err = handleTransactionError(result, "setTrustline");
    throw new Error(err.message);
  }
  return { hash: result.result.hash };
}
