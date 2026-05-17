import type { Amount, Client, Payment, Wallet } from "xrpl";
import { handleTransactionError, isTypedTransactionSuccessful } from "../../../lib/errorHandler.js";

/**
 * Cross-currency swap implemented as a Payment to self with destinationAmount.
 * On XRPL, a Payment with an issued amount and tfPartialPayment flag will use
 * the available AMM/order book liquidity automatically.
 */
export async function swap(
  client: Client,
  wallet: Wallet,
  sendMax: Amount,
  destinationAmount: Amount,
): Promise<{ hash: string }> {
  if (!client.isConnected()) await client.connect();

  const tx: Payment = {
    TransactionType: "Payment",
    Account: wallet.classicAddress,
    Destination: wallet.classicAddress,
    Amount: destinationAmount,
    SendMax: sendMax,
    Flags: 0x00020000, // tfPartialPayment
  };

  const prepared = await client.autofill(tx);
  const signed = wallet.sign(prepared);
  const result = await client.submitAndWait<Payment>(signed.tx_blob);
  if (!isTypedTransactionSuccessful(result)) {
    const err = handleTransactionError(result, "swap");
    throw new Error(err.message);
  }
  return { hash: result.result.hash };
}
