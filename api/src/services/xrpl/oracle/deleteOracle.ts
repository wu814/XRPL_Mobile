import { type Client, type OracleDelete, type Wallet } from "xrpl";
import { handleTransactionError, isTypedTransactionSuccessful } from "../../../lib/errorHandler.js";

export async function deleteOracle(
  client: Client,
  wallet: Wallet,
  oracleDocumentId: number,
): Promise<{ hash: string }> {
  if (!client.isConnected()) await client.connect();

  const tx: OracleDelete = {
    TransactionType: "OracleDelete",
    Account: wallet.classicAddress,
    OracleDocumentID: oracleDocumentId,
  };
  const prepared = await client.autofill(tx);
  const signed = wallet.sign(prepared);
  const result = await client.submitAndWait<OracleDelete>(signed.tx_blob);
  if (!isTypedTransactionSuccessful(result)) {
    const err = handleTransactionError(result, "deleteOracle");
    throw new Error(err.message);
  }
  return { hash: result.result.hash };
}
