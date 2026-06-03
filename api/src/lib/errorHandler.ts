import type { TxResponse, SubmittableTransaction } from "xrpl";

/**
 * Generic transaction result checker with type safety.
 * Ported from xrpl_mvp.
 */
function getTypedTransactionResult<T extends SubmittableTransaction>(
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
