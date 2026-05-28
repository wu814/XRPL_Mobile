import type { Amount, Client, Payment, Wallet } from "xrpl";
import { handleTransactionError, isTypedTransactionSuccessful } from "../../../lib/errorHandler.js";

export type CrossCurrencyMode = "exact_input" | "exact_output";

interface SendCrossCurrencyArgs {
  client: Client;
  senderWallet: Wallet;
  destinationAddress: string;
  sendCurrency: string;
  receiveCurrency: string;
  issuerAddress: string;
  mode: CrossCurrencyMode;
  sendAmount?: number;
  exactOutputAmount?: number;
  slippagePercent?: number;
  destinationTag?: number;
}

function toAmount(currency: string, value: string, issuer: string): Amount {
  if (currency === "XRP") {
    return Math.floor(parseFloat(value) * 1_000_000).toString();
  }
  return { currency, issuer, value };
}

/**
 * Cross-currency Payment using XRPL's native pathfinding.
 *
 * - exact_input: sender spends exactly `sendAmount`. We set SendMax = sendAmount
 *   and Amount = a high placeholder cap with tfPartialPayment so the receiver
 *   gets whatever conversion yields.
 * - exact_output: receiver gets exactly `exactOutputAmount`. We set Amount =
 *   exactOutputAmount and SendMax = exactOutputAmount + slippage buffer in the
 *   send currency.
 */
export async function sendCrossCurrency(args: SendCrossCurrencyArgs): Promise<{ hash: string }> {
  const {
    client,
    senderWallet,
    destinationAddress,
    sendCurrency,
    receiveCurrency,
    issuerAddress,
    mode,
    sendAmount,
    exactOutputAmount,
    slippagePercent = 0,
    destinationTag,
  } = args;

  if (!client.isConnected()) await client.connect();

  let amount: Amount;
  let sendMax: Amount;
  let flags = 0;

  if (mode === "exact_input") {
    if (!sendAmount || sendAmount <= 0) throw new Error("sendAmount required for exact_input");
    sendMax = toAmount(sendCurrency, sendAmount.toString(), issuerAddress);
    // High placeholder cap so the receiver can be credited up to (but not above) this amount.
    amount = toAmount(receiveCurrency, "1000000000", issuerAddress);
    flags = 0x00020000; // tfPartialPayment
  } else {
    if (!exactOutputAmount || exactOutputAmount <= 0) {
      throw new Error("exactOutputAmount required for exact_output");
    }
    amount = toAmount(receiveCurrency, exactOutputAmount.toString(), issuerAddress);
    // SendMax cap: caller supplies the slippage-adjusted maximum input.
    const maxIn = sendAmount && sendAmount > 0 ? sendAmount : exactOutputAmount * (1 + slippagePercent / 100);
    sendMax = toAmount(sendCurrency, maxIn.toString(), issuerAddress);
  }

  const tx: Payment = {
    TransactionType: "Payment",
    Account: senderWallet.classicAddress,
    Destination: destinationAddress,
    Amount: amount,
    SendMax: sendMax,
    Flags: flags,
  };
  if (typeof destinationTag === "number") tx.DestinationTag = destinationTag;

  const prepared = await client.autofill(tx);
  const signed = senderWallet.sign(prepared);
  const result = await client.submitAndWait<Payment>(signed.tx_blob);
  if (!isTypedTransactionSuccessful(result)) {
    const err = handleTransactionError(result, "sendCrossCurrency");
    throw new Error(err.message);
  }
  return { hash: result.result.hash };
}
