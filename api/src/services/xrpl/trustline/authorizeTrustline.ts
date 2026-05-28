import type { Client, TrustSet, Wallet } from "xrpl";
import { handleTransactionError, isTypedTransactionSuccessful } from "../../../lib/errorHandler.js";

// tfSetfAuth — issuer authorizes a holder's trustline (required when the issuer
// has asfRequireAuth enabled).
const TF_SET_AUTH = 0x00010000;

/**
 * Authorize a holder's trustline from the issuer side.
 *
 * The issuer submits a TrustSet referencing the holder as the counterparty with
 * a zero limit and the tfSetfAuth flag. This lets the holder receive the issued
 * token even though the issuer requires authorization.
 */
export async function authorizeTrustline(
  client: Client,
  issuerWallet: Wallet,
  currency: string,
  holderAddress: string,
): Promise<{ hash: string }> {
  if (!client.isConnected()) await client.connect();

  const tx: TrustSet = {
    TransactionType: "TrustSet",
    Account: issuerWallet.classicAddress,
    LimitAmount: { currency, issuer: holderAddress, value: "0" },
    Flags: TF_SET_AUTH,
  };
  const prepared = await client.autofill(tx);
  const signed = issuerWallet.sign(prepared);
  const result = await client.submitAndWait<TrustSet>(signed.tx_blob);
  if (!isTypedTransactionSuccessful(result)) {
    const err = handleTransactionError(result, "authorizeTrustline");
    if (err.code === "tecDUPLICATE") {
      return { hash: result.result.hash };
    }
    throw new Error(err.message);
  }
  return { hash: result.result.hash };
}
