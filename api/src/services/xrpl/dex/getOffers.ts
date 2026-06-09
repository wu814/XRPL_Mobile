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
    FinalFields?: Record<string, unknown>;
  };
  ModifiedNode?: {
    LedgerEntryType?: string;
    FinalFields?: { Account?: string };
    PreviousFields?: { TakerGets?: unknown; TakerPays?: unknown };
  };
};

type AccountTxEntry = {
  hash?: string;
  date?: number;
  tx_json?: Record<string, unknown>;
  tx?: Record<string, unknown>;
  meta?: string | { TransactionResult?: string; AffectedNodes?: AffectedNode[] };
};

export type PastDexOfferStatus = "filled" | "cancelled";

export interface PastDexOffer {
  hash: string;
  date: number;
  status: PastDexOfferStatus;
  takerGets: unknown;
  takerPays: unknown;
  flags?: number;
}

function getAccountTxFields(entry: unknown): {
  tx: Record<string, unknown>;
  meta: { TransactionResult?: string; AffectedNodes?: AffectedNode[] };
  hash: string;
  date: number;
} | null {
  const e = entry as AccountTxEntry;
  const tx = e.tx_json ?? e.tx;
  const meta = e.meta;
  if (!tx || !meta || typeof meta === "string") return null;
  return {
    tx,
    meta,
    hash: String(e.hash ?? tx.hash ?? ""),
    date: Number(e.date ?? tx.date ?? 0),
  };
}

function extractOfferLegs(fields: Record<string, unknown>) {
  return {
    takerGets: fields.TakerGets ?? fields.taker_gets,
    takerPays: fields.TakerPays ?? fields.taker_pays,
    flags: Number(fields.Flags ?? fields.flags ?? 0) || undefined,
  };
}

function findDeletedOwnOffer(
  nodes: AffectedNode[] | undefined,
  account: string,
  sequence?: number,
): Record<string, unknown> | null {
  for (const wrapper of nodes ?? []) {
    const deleted = wrapper.DeletedNode;
    if (deleted?.LedgerEntryType !== "Offer") continue;
    const fields = deleted.FinalFields;
    if (!fields || fields.Account !== account) continue;
    if (sequence != null && Number(fields.Sequence) !== sequence) continue;
    return fields;
  }
  return null;
}

/** OfferCreate that matched at least partially (excludes unfilled book placement). */
export function isFulfilledOfferCreate(txEntry: unknown, account: string): boolean {
  const parsed = getAccountTxFields(txEntry);
  if (!parsed) return false;
  const { tx, meta } = parsed;
  if (tx.TransactionType !== "OfferCreate") return false;
  if (tx.Account && tx.Account !== account) return false;
  if (meta.TransactionResult !== "tesSUCCESS") return false;

  const nodes = meta.AffectedNodes ?? [];
  let placedUnfilledOffer = false;
  let ownOfferTraded = false;
  let tradedOnBook = false;

  for (const wrapper of nodes) {
    const node = wrapper as AffectedNode;

    if (node.CreatedNode?.LedgerEntryType === "Offer") {
      if (node.CreatedNode.NewFields?.Account === account) placedUnfilledOffer = true;
    }

    if (node.DeletedNode?.LedgerEntryType === "Offer") {
      const owner = node.DeletedNode.FinalFields?.Account;
      if (owner === account) {
        ownOfferTraded = true;
      } else if (owner) {
        tradedOnBook = true;
      }
    }

    if (node.ModifiedNode?.LedgerEntryType === "Offer") {
      const owner = node.ModifiedNode.FinalFields?.Account;
      const prev = node.ModifiedNode.PreviousFields;
      const offerChanged =
        prev?.TakerGets !== undefined || prev?.TakerPays !== undefined;
      if (!offerChanged) continue;
      if (owner === account) {
        ownOfferTraded = true;
      } else if (owner) {
        tradedOnBook = true;
      }
    }
  }

  if (ownOfferTraded || tradedOnBook) return true;
  if (placedUnfilledOffer) return false;
  return false;
}

function classifyPastDexOrder(txEntry: unknown, account: string): PastDexOffer | null {
  const parsed = getAccountTxFields(txEntry);
  if (!parsed) return null;
  const { tx, meta, hash, date } = parsed;
  if (meta.TransactionResult !== "tesSUCCESS") return null;

  if (tx.TransactionType === "OfferCancel" && tx.Account === account) {
    const sequence = Number(tx.OfferSequence);
    const deleted = findDeletedOwnOffer(meta.AffectedNodes, account, sequence);
    if (!deleted) return null;
    const legs = extractOfferLegs(deleted);
    return { hash, date, status: "cancelled", ...legs };
  }

  if (tx.TransactionType === "OfferCreate" && tx.Account === account) {
    if (!isFulfilledOfferCreate(txEntry, account)) return null;
    return {
      hash,
      date,
      status: "filled",
      takerGets: tx.TakerGets ?? tx.taker_gets,
      takerPays: tx.TakerPays ?? tx.taker_pays,
      flags: Number(tx.Flags ?? tx.flags ?? 0) || undefined,
    };
  }

  const deleted = findDeletedOwnOffer(meta.AffectedNodes, account);
  if (deleted) {
    const legs = extractOfferLegs(deleted);
    return { hash, date, status: "filled", ...legs };
  }

  return null;
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
  const seen = new Set<string>();
  const past: PastDexOffer[] = [];

  for (const txEntry of txs) {
    const order = classifyPastDexOrder(txEntry, address);
    if (!order || !order.hash || seen.has(order.hash)) continue;
    seen.add(order.hash);
    past.push(order);
    if (past.length >= limit) break;
  }

  return past;
}
