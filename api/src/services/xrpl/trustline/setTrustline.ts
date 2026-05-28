import type {
  AccountInfoResponse,
  AccountLinesResponse,
  Client,
  TrustSet,
  Wallet,
} from "xrpl";
import { handleTransactionError, isTypedTransactionSuccessful } from "../../../lib/errorHandler.js";

const LSF_REQUIRE_AUTH = 0x00040000;

async function accountLines(
  client: Client,
  account: string,
  peer: string,
): Promise<AccountLinesResponse> {
  return client.request({
    command: "account_lines",
    account,
    peer,
    ledger_index: "validated",
  });
}

/**
 * Whether `account` already has a trustline to `issuer` for `currency`.
 * Used to award the welcome bonus only the first time a trustline is set.
 */
export async function trustlineExists(
  client: Client,
  account: string,
  issuer: string,
  currency: string,
): Promise<boolean> {
  if (!client.isConnected()) await client.connect();
  const lines = await accountLines(client, account, issuer);
  return lines.result.lines.some((line) => line.currency === currency);
}

/**
 * Whether a holder's trustline is ready to send/receive an IOU.
 * Mirrors xrpl_mvp: if the issuer has RequireAuth, the issuer must also have
 * authorized the holder's trustline (reciprocal line with tfSetAuth).
 */
export async function checkTrustline(
  client: Client,
  holderAddress: string,
  issuerAddress: string,
  currency: string,
): Promise<boolean> {
  if (!client.isConnected()) await client.connect();

  const holderLines = await accountLines(client, holderAddress, issuerAddress);
  const holderHasLine = holderLines.result.lines.some((line) => line.currency === currency);
  if (!holderHasLine) return false;

  const issuerInfo: AccountInfoResponse = await client.request({
    command: "account_info",
    account: issuerAddress,
    ledger_index: "validated",
  });
  const issuerFlags = Number(issuerInfo.result.account_data.Flags ?? 0);
  if ((issuerFlags & LSF_REQUIRE_AUTH) === 0) return true;

  const issuerLines = await accountLines(client, issuerAddress, holderAddress);
  return issuerLines.result.lines.some((line) => line.currency === currency);
}

export async function setTrustline(
  client: Client,
  wallet: Wallet,
  currency: string,
  issuer: string,
  limit: string,
): Promise<{ hash: string }> {
  if (!client.isConnected()) await client.connect();

  const tx: TrustSet = {
    TransactionType: "TrustSet",
    Account: wallet.classicAddress,
    LimitAmount: { currency, issuer, value: limit },
  };
  const prepared = await client.autofill(tx);
  const signed = wallet.sign(prepared);
  const result = await client.submitAndWait<TrustSet>(signed.tx_blob);
  if (!isTypedTransactionSuccessful(result)) {
    const err = handleTransactionError(result, "setTrustline");
    throw new Error(err.message);
  }
  return { hash: result.result.hash };
}
