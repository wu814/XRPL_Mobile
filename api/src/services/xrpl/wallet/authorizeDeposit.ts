import type { Client, DepositPreauth, Wallet } from "xrpl";
import { handleTransactionError, isTypedTransactionSuccessful } from "../../../lib/errorHandler.js";

export async function authorizeDeposit(
  client: Client,
  wallet: Wallet,
  authorizedAddress: string,
): Promise<{ message: string }> {
  if (!client.isConnected()) await client.connect();

  const tx: DepositPreauth = {
    TransactionType: "DepositPreauth",
    Account: wallet.classicAddress,
    Authorize: authorizedAddress,
  };
  const prepared = await client.autofill(tx);
  const signed = wallet.sign(prepared);
  const result = await client.submitAndWait(signed.tx_blob);

  if (!isTypedTransactionSuccessful(result)) {
    const err = handleTransactionError(result, "authorizeDeposit");
    throw new Error(err.message);
  }

  return {
    message: `DepositPreauth set for ${authorizedAddress} to deposit to ${wallet.classicAddress}`,
  };
}
