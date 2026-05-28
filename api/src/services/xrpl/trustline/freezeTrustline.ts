import type { Client, TrustSet, Wallet } from "xrpl";
import { handleTransactionError, isTypedTransactionSuccessful } from "../../../lib/errorHandler.js";

// TrustSet freeze flags (issuer side).
const TF_SET_FREEZE = 0x00100000;
const TF_CLEAR_FREEZE = 0x00200000;
const TF_SET_DEEP_FREEZE = 0x00400000;
const TF_CLEAR_DEEP_FREEZE = 0x00800000;

export type FreezeMode = "freeze" | "deep_freeze" | "unfreeze";

/**
 * Freeze / deep-freeze / unfreeze a holder's trustline from the issuer side.
 *
 * - freeze: blocks the holder from sending the token to anyone but the issuer.
 * - deep_freeze: also blocks the holder from receiving the token (implies freeze).
 * - unfreeze: clears both freeze and deep-freeze.
 */
export async function freezeTrustline(
  client: Client,
  issuerWallet: Wallet,
  currency: string,
  holderAddress: string,
  mode: FreezeMode,
): Promise<{ hash: string }> {
  if (!client.isConnected()) await client.connect();

  let flags: number;
  if (mode === "freeze") flags = TF_SET_FREEZE;
  else if (mode === "deep_freeze") flags = TF_SET_FREEZE | TF_SET_DEEP_FREEZE;
  else flags = TF_CLEAR_FREEZE | TF_CLEAR_DEEP_FREEZE;

  const tx: TrustSet = {
    TransactionType: "TrustSet",
    Account: issuerWallet.classicAddress,
    LimitAmount: { currency, issuer: holderAddress, value: "0" },
    Flags: flags,
  };
  const prepared = await client.autofill(tx);
  const signed = issuerWallet.sign(prepared);
  const result = await client.submitAndWait<TrustSet>(signed.tx_blob);
  if (!isTypedTransactionSuccessful(result)) {
    const err = handleTransactionError(result, "freezeTrustline");
    throw new Error(err.message);
  }
  return { hash: result.result.hash };
}
