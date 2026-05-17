import {
  type Amount,
  type Client,
  type OfferCreate,
  type OfferCreateFlags,
  type Wallet,
} from "xrpl";
import { handleTransactionError, isTypedTransactionSuccessful } from "../../../lib/errorHandler.js";

export type OfferKind = "limit" | "ioc" | "fok" | "passive" | "sell";

const KIND_TO_FLAGS: Record<OfferKind, number> = {
  // tfImmediateOrCancel = 0x00020000, tfFillOrKill = 0x00040000, tfPassive = 0x00010000, tfSell = 0x00080000
  limit: 0,
  ioc: 0x00020000,
  fok: 0x00040000,
  passive: 0x00010000,
  sell: 0x00080000,
};

export interface CreateOfferResult {
  hash: string;
  offerSequence?: number;
  ledgerIndex: number;
}

export async function createOffer(
  client: Client,
  wallet: Wallet,
  takerPays: Amount,
  takerGets: Amount,
  kind: OfferKind = "limit",
): Promise<CreateOfferResult> {
  if (!client.isConnected()) await client.connect();

  const tx: OfferCreate = {
    TransactionType: "OfferCreate",
    Account: wallet.classicAddress,
    TakerPays: takerPays,
    TakerGets: takerGets,
    Flags: KIND_TO_FLAGS[kind] as OfferCreateFlags,
  };

  const prepared = await tx; // placeholder typing
  const autofilled = await client.autofill(prepared);
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
