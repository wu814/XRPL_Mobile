import type { AccountSet, Client, Wallet } from "xrpl";
import { handleTransactionError, isTypedTransactionSuccessful } from "../../../lib/errorHandler.js";

interface FlagConfig {
  name: string;
  flag: number;
  offset: number;
}

interface SetFlagsResult {
  success: boolean;
  errorCode?: string;
  message?: string;
}

async function applyFlags(
  client: Client,
  wallet: Wallet,
  flags: FlagConfig[],
  operation: string,
): Promise<SetFlagsResult> {
  if (!wallet?.classicAddress) {
    throw new Error("Wallet is missing or has no classicAddress");
  }

  if (!client.isConnected()) await client.connect();

  if (flags.length === 0) return { success: true };

  const accountInfo = await client.request({
    command: "account_info",
    account: wallet.classicAddress,
    ledger_index: "validated",
  });
  if (!accountInfo.result.account_data) throw new Error("Account not found on XRPL");

  const baseSequence = accountInfo.result.account_data.Sequence;
  const latestLedgerSequence = accountInfo.result.ledger_index ?? 0;

  for (let i = 0; i < flags.length; i++) {
    const { flag, offset } = flags[i]!;
    const tx: AccountSet = {
      TransactionType: "AccountSet",
      Account: wallet.classicAddress,
      SetFlag: flag,
      LastLedgerSequence: latestLedgerSequence + offset,
      Sequence: baseSequence + i,
    };
    const prepared = await client.autofill(tx);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);
    if (!isTypedTransactionSuccessful(result)) {
      const err = handleTransactionError(result, operation);
      return { success: false, errorCode: err.code, message: err.message };
    }
  }

  return { success: true };
}

export async function setIssuerWalletFlags(client: Client, wallet: Wallet): Promise<SetFlagsResult> {
  return applyFlags(
    client,
    wallet,
    [
      { name: "asfDisallowXRP", flag: 3, offset: 20 },
      { name: "asfDefaultRipple", flag: 8, offset: 40 },
      { name: "asfAllowTrustLineClawback", flag: 16, offset: 60 },
      { name: "asfDepositAuth", flag: 9, offset: 80 },
      { name: "asfRequireAuth", flag: 2, offset: 100 },
    ],
    "setIssuerWalletFlags",
  );
}

export async function setTreasuryWalletFlags(client: Client, wallet: Wallet): Promise<SetFlagsResult> {
  return applyFlags(
    client,
    wallet,
    [{ name: "asfDepositAuth", flag: 9, offset: 20 }],
    "setTreasuryWalletFlags",
  );
}
