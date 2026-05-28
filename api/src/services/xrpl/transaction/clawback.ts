import type { Clawback, Client, Wallet } from "xrpl";
import { handleTransactionError, isTypedTransactionSuccessful } from "../../../lib/errorHandler.js";

/**
 * Claw back issued tokens from a holder.
 *
 * Requires the issuer to have asfAllowTrustLineClawback enabled (set when the
 * issuer wallet is created). In a Clawback transaction the Amount.issuer field
 * is the *holder* (counterparty) address, not the issuer's own address.
 */
export async function clawback(
  client: Client,
  issuerWallet: Wallet,
  currency: string,
  holderAddress: string,
  value: string,
): Promise<{ hash: string }> {
  if (!client.isConnected()) await client.connect();

  const tx: Clawback = {
    TransactionType: "Clawback",
    Account: issuerWallet.classicAddress,
    Amount: { currency, issuer: holderAddress, value },
  };
  const prepared = await client.autofill(tx);
  const signed = issuerWallet.sign(prepared);
  const result = await client.submitAndWait<Clawback>(signed.tx_blob);
  if (!isTypedTransactionSuccessful(result)) {
    const err = handleTransactionError(result, "clawback");
    throw new Error(err.message);
  }
  return { hash: result.result.hash };
}
