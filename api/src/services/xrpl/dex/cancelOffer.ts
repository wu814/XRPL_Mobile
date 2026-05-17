import type { Client, OfferCancel, Wallet } from "xrpl";
import { handleTransactionError, isTypedTransactionSuccessful } from "../../../lib/errorHandler.js";

export async function cancelOffer(
  client: Client,
  wallet: Wallet,
  offerSequence: number,
): Promise<{ hash: string; ledgerIndex: number }> {
  if (!client.isConnected()) await client.connect();

  if (!Number.isInteger(offerSequence) || offerSequence <= 0) {
    throw new Error("Invalid offer sequence");
  }

  const tx: OfferCancel = {
    TransactionType: "OfferCancel",
    Account: wallet.classicAddress,
    OfferSequence: offerSequence,
  };
  const prepared = await client.autofill(tx);
  const ledger = await client.request({ command: "ledger_current" });
  prepared.LastLedgerSequence = ledger.result.ledger_current_index + 20;

  const signed = wallet.sign(prepared);
  const response = await client.submitAndWait(signed.tx_blob);

  if (!isTypedTransactionSuccessful(response)) {
    const err = handleTransactionError(response, "cancelOffer");
    throw new Error(err.message);
  }
  return {
    hash: response.result.hash,
    ledgerIndex: response.result.ledger_index ?? 0,
  };
}
