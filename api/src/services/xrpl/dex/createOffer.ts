import {
  type Amount,
  type Client,
  type OfferCreate,
  type OfferCreateFlags,
  type Wallet,
} from "xrpl";
import { handleTransactionError, isTypedTransactionSuccessful } from "../../../lib/errorHandler.js";

export type OfferExecution = "gtc" | "ioc" | "fok";

export interface OfferFlags {
  execution: OfferExecution;
  passive?: boolean;
  sell?: boolean;
}

const TF_PASSIVE = 0x00010000;
const TF_IOC = 0x00020000;
const TF_FOK = 0x00040000;
const TF_SELL = 0x00080000;

export function validateOfferFlags(flags: OfferFlags): void {
  if (flags.passive && flags.execution !== "gtc") {
    throw new Error("Post-only (passive) is only available for GTC limit orders");
  }
}

export function offerFlagsToNumber(flags: OfferFlags): number {
  validateOfferFlags(flags);
  let n = 0;
  if (flags.execution === "ioc") n |= TF_IOC;
  if (flags.execution === "fok") n |= TF_FOK;
  if (flags.passive) n |= TF_PASSIVE;
  if (flags.sell) n |= TF_SELL;
  return n;
}

interface CreateOfferResult {
  hash: string;
  offerSequence?: number;
  ledgerIndex: number;
}

export async function createOffer(
  client: Client,
  wallet: Wallet,
  takerPays: Amount,
  takerGets: Amount,
  flags: OfferFlags = { execution: "gtc" },
): Promise<CreateOfferResult> {
  if (!client.isConnected()) await client.connect();

  const tx: OfferCreate = {
    TransactionType: "OfferCreate",
    Account: wallet.classicAddress,
    TakerPays: takerPays,
    TakerGets: takerGets,
    Flags: offerFlagsToNumber(flags) as OfferCreateFlags,
  };

  const autofilled = await client.autofill(tx);
  const ledger = await client.request({ command: "ledger_current" });
  autofilled.LastLedgerSequence = ledger.result.ledger_current_index + 20;

  const signed = wallet.sign(autofilled);
  const response = await client.submitAndWait(signed.tx_blob);

  if (!isTypedTransactionSuccessful(response)) {
    const err = handleTransactionError(response, "createOffer");
    throw new Error(err.message);
  }

  let offerSequence: number | undefined;
  const meta = response.result.meta as { AffectedNodes?: unknown[] } | undefined;
  if (meta && Array.isArray(meta.AffectedNodes)) {
    for (const node of meta.AffectedNodes as Array<Record<string, unknown>>) {
      const created = (node as { CreatedNode?: { LedgerEntryType?: string; NewFields?: { Sequence?: number } } })
        .CreatedNode;
      if (created?.LedgerEntryType === "Offer" && typeof created.NewFields?.Sequence === "number") {
        offerSequence = created.NewFields.Sequence;
        break;
      }
    }
  }

  return {
    hash: response.result.hash,
    offerSequence,
    ledgerIndex: response.result.ledger_index ?? 0,
  };
}
