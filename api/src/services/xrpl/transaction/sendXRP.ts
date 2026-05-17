import type { Client, Payment, Wallet } from "xrpl";
import { handleTransactionError, isTypedTransactionSuccessful } from "../../../lib/errorHandler.js";

export async function sendXRP(
  client: Client,
  fromWallet: Wallet,
  destination: string,
  xrpAmount: number,
  destinationTag?: number,
): Promise<{ hash: string }> {
  if (!client.isConnected()) await client.connect();

  const tx: Payment = {
    TransactionType: "Payment",
    Account: fromWallet.classicAddress,
    Destination: destination,
    Amount: Math.floor(xrpAmount * 1_000_000).toString(),
  };
  if (typeof destinationTag === "number") tx.DestinationTag = destinationTag;

  const prepared = await client.autofill(tx);
  const signed = fromWallet.sign(prepared);
  const result = await client.submitAndWait<Payment>(signed.tx_blob);
  if (!isTypedTransactionSuccessful(result)) {
    const err = handleTransactionError(result, "sendXRP");
    throw new Error(err.message);
  }
  return { hash: result.result.hash };
}
