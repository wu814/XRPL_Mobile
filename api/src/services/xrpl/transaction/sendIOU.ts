import type { AccountLinesResponse, Client, IssuedCurrencyAmount, Payment, Wallet } from "xrpl";
import { handleTransactionError, isTypedTransactionSuccessful } from "../../../lib/errorHandler.js";
import { checkTrustline } from "../trustline/setTrustline.js";

async function senderBalance(
  client: Client,
  sender: string,
  issuer: string,
  currency: string,
): Promise<number> {
  const lines: AccountLinesResponse = await client.request({
    command: "account_lines",
    account: sender,
    peer: issuer,
    ledger_index: "validated",
  });
  const line = lines.result.lines.find((l) => l.currency === currency);
  return Number(line?.balance ?? 0);
}

/**
 * Send an issued-currency (IOU) payment.
 *
 * Mirrors xrpl_mvp: when the sender is the issuer the payment *mints* new
 * tokens (only the destination trustline is required); otherwise the sender
 * must already hold enough of the IOU. Both cases are validated before
 * submission so callers get a clear error instead of a raw ledger code.
 */
export async function sendIOU(
  client: Client,
  fromWallet: Wallet,
  destination: string,
  amount: IssuedCurrencyAmount,
): Promise<{ hash: string }> {
  if (!client.isConnected()) await client.connect();

  const { currency, issuer: issuerAddress } = amount;
  const value = Number(amount.value);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Invalid IOU amount");
  }

  const senderIsIssuer = fromWallet.classicAddress === issuerAddress;

  if (senderIsIssuer) {
    if (!(await checkTrustline(client, destination, issuerAddress, currency))) {
      throw new Error(
        `Destination ${destination} lacks an authorized trustline to issuer ${issuerAddress} for ${currency}`,
      );
    }
  } else {
    if (!(await checkTrustline(client, fromWallet.classicAddress, issuerAddress, currency))) {
      throw new Error(
        `Sender has no trust line with ${issuerAddress} for ${currency}`,
      );
    }

    const available = await senderBalance(client, fromWallet.classicAddress, issuerAddress, currency);
    if (available < value) {
      throw new Error(
        `Insufficient balance: ${available} ${currency}, required: ${value}`,
      );
    }

    if (!(await checkTrustline(client, destination, issuerAddress, currency))) {
      throw new Error(`Destination ${destination} lacks trustline for ${currency}`);
    }
  }

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
