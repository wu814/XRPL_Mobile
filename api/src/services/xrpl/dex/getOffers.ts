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

export async function getCompletedOffers(client: Client, address: string, limit = 100) {
  if (!client.isConnected()) await client.connect();
  const response = await client.request({
    command: "account_tx",
    account: address,
    binary: false,
    limit,
    forward: false,
  });
  const txs = response.result.transactions ?? [];
  return txs.filter((t) => {
    const tj = (t as { tx_json?: { TransactionType?: string } }).tx_json;
    return tj?.TransactionType === "OfferCreate" || tj?.TransactionType === "OfferCancel";
  });
}
