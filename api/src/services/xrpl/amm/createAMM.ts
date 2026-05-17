import type { AMMCreate, Amount, Client, TransactionMetadataBase, Wallet } from "xrpl";
import { handleTransactionError, isTypedTransactionSuccessful } from "../../../lib/errorHandler.js";

export interface CreateAMMInput {
  client: Client;
  treasuryWallet: Wallet;
  issuerAddress: string;
  currency1: string;
  value1: number;
  currency2: string;
  value2: number;
  tradingFee: number;
}

export interface CreateAMMResult {
  account: string;
  currency1: string;
  currency2: string;
  hash: string;
}

function buildAmount(currency: string, issuer: string, value: number): Amount {
  if (currency === "XRP") return Math.floor(value * 1_000_000).toString();
  return { currency, issuer, value: value.toString() };
}

export async function createAMM(input: CreateAMMInput): Promise<CreateAMMResult> {
  const { client, treasuryWallet, issuerAddress, tradingFee } = input;
  if (!client.isConnected()) await client.connect();

  if (input.value1 <= 0 || input.value2 <= 0) {
    throw new Error("Both pool amounts must be positive");
  }

  const sortedFirst = input.currency1 < input.currency2;
  const c1 = sortedFirst ? input.currency1 : input.currency2;
  const c2 = sortedFirst ? input.currency2 : input.currency1;
  const v1 = sortedFirst ? input.value1 : input.value2;
  const v2 = sortedFirst ? input.value2 : input.value1;

  const tx: AMMCreate = {
    TransactionType: "AMMCreate",
    Account: treasuryWallet.classicAddress,
    TradingFee: tradingFee,
    Amount: buildAmount(c1, issuerAddress, v1),
    Amount2: buildAmount(c2, issuerAddress, v2),
    Fee: "2000000",
    Flags: 0,
  };

  const prepared = await client.autofill(tx);
  prepared.LastLedgerSequence = (prepared.LastLedgerSequence ?? 0) + 50;
  const signed = treasuryWallet.sign(prepared);
  const submission = await client.submitAndWait<AMMCreate>(signed.tx_blob);

  if (!isTypedTransactionSuccessful(submission)) {
    const err = handleTransactionError(submission, "createAMM");
    throw new Error(err.message);
  }

  const meta = submission.result.meta as TransactionMetadataBase | undefined;
  let ammAccount: string | undefined;
  if (meta?.AffectedNodes) {
    for (const node of meta.AffectedNodes) {
      if ("CreatedNode" in node && node.CreatedNode?.LedgerEntryType === "AMM") {
        ammAccount = (node.CreatedNode.NewFields as { Account?: string }).Account;
        break;
      }
    }
  }
  if (!ammAccount) throw new Error("AMMCreate succeeded but AMM account could not be located");

  return { account: ammAccount, currency1: c1, currency2: c2, hash: submission.result.hash };
}
