import type { Client, IssuedCurrencyAmount, Payment, Wallet } from "xrpl";
import { handleTransactionError, isTypedTransactionSuccessful } from "../../../lib/errorHandler.js";

export async function sendIOU(
  client: Client,
  fromWallet: Wallet,
  destination: string,
  amount: IssuedCurrencyAmount,
): Promise<{ hash: string }> {
  if (!client.isConnected()) await client.connect();

  const tx: Payment = {
    TransactionType: "Payment",
    Account: fromWallet.classicAddress,
    Destination: destination,
    Amount: amount,
  };
  const prepared = await client.autofill(tx);
  const signed = fromWallet.sign(prepared);
  const result = await client.submitAndWait<Payment>(signed.tx_blob);
  if (!isTypedTransactionSuccessful(result)) {
    const err = handleTransactionError(result, "sendIOU");
    throw new Error(err.message);
  }
  return { hash: result.result.hash };
}
