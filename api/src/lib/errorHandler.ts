import type { TxResponse, SubmittableTransaction } from "xrpl";

/**
 * Generic transaction result checker with type safety.
 * Ported from xrpl_mvp.
 */
export function getTypedTransactionResult<T extends SubmittableTransaction>(
  response: TxResponse<T>,
): string {
  if (typeof response.result.meta === "string") {
    return "UNKNOWN_ERROR";
  }
  return response.result.meta?.TransactionResult || "UNKNOWN_ERROR";
}

export function isTypedTransactionSuccessful<T extends SubmittableTransaction>(
  response: TxResponse<T>,
): boolean {
  return getTypedTransactionResult(response) === "tesSUCCESS";
}

export function handleTransactionError<T extends SubmittableTransaction>(
  response: TxResponse<T>,
  operation: string,
): { code: string; message: string } {
  const transactionResult = getTypedTransactionResult(response);
  return {
    code: transactionResult,
    message: `${operation} failed with Code: ${transactionResult}`,
  };
}

/**
 * Map common XRPL transaction codes to user-facing strings.
 * Used by the API to send something humane in route responses.
 */
export function humanizeXrplCode(code: string): string {
  if (code === "tesSUCCESS") return "Success";
  if (code === "tecPATH_DRY") return "No liquidity available for this path";
  if (code === "tecPATH_PARTIAL") return "Partial path - try lowering the amount or adjusting slippage";
  if (code === "tecUNFUNDED_PAYMENT") return "Sender does not have enough funds";
  if (code === "tecUNFUNDED_OFFER") return "Insufficient balance to fund the offer";
  if (code === "tecNO_LINE") return "Trustline missing - the recipient must trust the issuer first";
  if (code === "tecNO_AUTH") return "Trustline is not authorized by the issuer";
  if (code === "tecINSUF_RESERVE_LINE") return "Insufficient XRP reserve to add another trustline";
  if (code === "tecINSUF_RESERVE_OFFER") return "Insufficient XRP reserve to place this offer";
  if (code === "temBAD_AMOUNT") return "Invalid amount";
  if (code === "temBAD_CURRENCY") return "Invalid currency code";
  if (code === "temREDUNDANT") return "Redundant transaction (no-op)";
  if (code === "terNO_ACCOUNT") return "Account does not exist on the ledger yet";
  if (code === "terPRE_SEQ") return "Transaction is ahead of current sequence";
  return code;
}
