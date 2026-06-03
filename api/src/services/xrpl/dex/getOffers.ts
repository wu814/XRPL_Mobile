import type {
  AccountOffersResponse,
  BookOffer,
  BookOfferCurrency,
  BookOffersResponse,
  Client,
} from "xrpl";

export async function getUserOffers(client: Client, address: string) {
  if (!client.isConnected()) await client.connect();
  const response: AccountOffersResponse = await client.request({
    command: "account_offers",
    account: address,
    ledger_index: "validated",
  });
  return response.result.offers ?? [];
}

export async function getBookOffers(
  client: Client,
  takerGets: BookOfferCurrency,
  takerPays: BookOfferCurrency,
  limit = 50,
): Promise<BookOffer[]> {
  if (!client.isConnected()) await client.connect();
  const response: BookOffersResponse = await client.request({
    command: "book_offers",
    taker_gets: takerGets,
    taker_pays: takerPays,
    ledger_index: "validated",
    limit,
  });
  return response.result.offers ?? [];
}

type AffectedNode = {
  CreatedNode?: {
    LedgerEntryType?: string;
    NewFields?: { Account?: string };
  };
  DeletedNode?: {
    LedgerEntryType?: string;
    FinalFields?: { Account?: string };
  };
  ModifiedNode?: {
    LedgerEntryType?: string;
    FinalFields?: { Account?: string };
    PreviousFields?: { TakerGets?: unknown; TakerPays?: unknown };
  };
};

type AccountTxEntry = {
  tx_json?: { TransactionType?: string; Account?: string };
  meta?: string | { TransactionResult?: string; AffectedNodes?: AffectedNode[] };
};

/** OfferCreate that matched at least partially (excludes unfilled book placement and OfferCancel). */
export function isFulfilledOfferCreate(txEntry: unknown, account: string): boolean {
  const entry = txEntry as AccountTxEntry;
  const tx = entry.tx_json;
  if (tx?.TransactionType !== "OfferCreate") return false;
  if (tx.Account && tx.Account !== account) return false;

  const meta = entry.meta;
  if (!meta || typeof meta === "string") return false;
  if (meta.TransactionResult !== "tesSUCCESS") return false;

  const nodes = meta.AffectedNodes ?? [];
  let placedUnfilledOffer = false;
  let ownOfferTraded = false;

  for (const wrapper of nodes) {
    const node = wrapper as AffectedNode;

    if (node.CreatedNode?.LedgerEntryType === "Offer") {
      if (node.CreatedNode.NewFields?.Account === account) placedUnfilledOffer = true;
    }

    if (node.DeletedNode?.LedgerEntryType === "Offer") {
      if (node.DeletedNode.FinalFields?.Account === account) ownOfferTraded = true;
    }

    if (node.ModifiedNode?.LedgerEntryType === "Offer") {
      if (node.ModifiedNode.FinalFields?.Account === account) {
        const prev = node.ModifiedNode.PreviousFields;
        if (prev?.TakerGets !== undefined || prev?.TakerPays !== undefined) {
          ownOfferTraded = true;
        }
      }
    }
  }

  if (ownOfferTraded) return true;
  if (placedUnfilledOffer) return false;
  return false;
}

export async function getCompletedOffers(client: Client, address: string, limit = 50) {
  if (!client.isConnected()) await client.connect();
  const response = await client.request({
    command: "account_tx",
    account: address,
    binary: false,
    limit: 400,
    forward: false,
  });
  const txs = response.result.transactions ?? [];
  return txs
    .filter((t) => isFulfilledOfferCreate(t, address))
    .slice(0, limit);
}
