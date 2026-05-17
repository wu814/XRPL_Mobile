import {
  type Amount,
  type Client,
  type NFTokenAcceptOffer,
  type NFTokenCreateOffer,
  type NFTokenMint,
  type Wallet,
} from "xrpl";
import { handleTransactionError, isTypedTransactionSuccessful } from "../../../lib/errorHandler.js";

const RECEIPT_TAXON = 1001;
const NFT_FLAGS = {
  tfBurnable: 0x00000001,
  tfTransferable: 0x00000008,
};

function extractNFTokenID(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") return null;
  const m = meta as { nftoken_id?: string; AffectedNodes?: unknown[] };
  if (typeof m.nftoken_id === "string") return m.nftoken_id;
  if (!Array.isArray(m.AffectedNodes)) return null;
  for (const node of m.AffectedNodes as Array<Record<string, unknown>>) {
    const created = (node as { CreatedNode?: { LedgerEntryType?: string; NewFields?: { NFTokenID?: string } } })
      .CreatedNode;
    if (created?.LedgerEntryType === "NFToken" && created.NewFields?.NFTokenID) {
      return created.NewFields.NFTokenID;
    }
  }
  return null;
}

function extractOfferID(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") return null;
  const m = meta as { AffectedNodes?: unknown[] };
  if (!Array.isArray(m.AffectedNodes)) return null;
  for (const node of m.AffectedNodes as Array<Record<string, unknown>>) {
    const created = (node as { CreatedNode?: { LedgerEntryType?: string; LedgerIndex?: string } })
      .CreatedNode;
    if (created?.LedgerEntryType === "NFTokenOffer" && created.LedgerIndex) {
      return created.LedgerIndex;
    }
  }
  return null;
}

export async function mintNFT(
  client: Client,
  wallet: Wallet,
  uri: string,
  taxon: number = RECEIPT_TAXON,
): Promise<{ nftTokenID: string; hash: string }> {
  if (!client.isConnected()) await client.connect();
  if (!uri) throw new Error("URI is required");

  const uriHex = Buffer.from(uri, "utf8").toString("hex").toUpperCase();
  const tx: NFTokenMint = {
    TransactionType: "NFTokenMint",
    Account: wallet.classicAddress,
    URI: uriHex,
    Flags: NFT_FLAGS.tfBurnable | NFT_FLAGS.tfTransferable,
    NFTokenTaxon: taxon,
  };
  const result = await client.submitAndWait<NFTokenMint>(tx, { autofill: true, wallet });
  if (!isTypedTransactionSuccessful(result)) {
    const err = handleTransactionError(result, "mintNFT");
    throw new Error(err.message);
  }
  const id = extractNFTokenID(result.result.meta);
  if (!id) throw new Error("NFTokenID not found in metadata");
  return { nftTokenID: id, hash: result.result.hash };
}

export async function createNFTSellOffer(
  client: Client,
  wallet: Wallet,
  nftTokenID: string,
  amount: Amount,
  destination?: string,
): Promise<{ offerID: string; hash: string }> {
  if (!client.isConnected()) await client.connect();

  const tx: NFTokenCreateOffer = {
    TransactionType: "NFTokenCreateOffer",
    Account: wallet.classicAddress,
    NFTokenID: nftTokenID,
    Amount: amount,
    Flags: 1, // tfSellNFToken
  };
  if (destination) tx.Destination = destination;

  const result = await client.submitAndWait<NFTokenCreateOffer>(tx, { autofill: true, wallet });
  if (!isTypedTransactionSuccessful(result)) {
    const err = handleTransactionError(result, "createNFTSellOffer");
    throw new Error(err.message);
  }
  const id = extractOfferID(result.result.meta);
  if (!id) throw new Error("Offer ID not found in metadata");
  return { offerID: id, hash: result.result.hash };
}

export async function acceptNFTSellOffer(
  client: Client,
  wallet: Wallet,
  offerID: string,
): Promise<{ hash: string }> {
  if (!client.isConnected()) await client.connect();
  const tx: NFTokenAcceptOffer = {
    TransactionType: "NFTokenAcceptOffer",
    Account: wallet.classicAddress,
    NFTokenSellOffer: offerID,
  };
  const result = await client.submitAndWait<NFTokenAcceptOffer>(tx, { autofill: true, wallet });
  if (!isTypedTransactionSuccessful(result)) {
    const err = handleTransactionError(result, "acceptNFTSellOffer");
    throw new Error(err.message);
  }
  return { hash: result.result.hash };
}

export async function getAccountNFTs(client: Client, address: string) {
  if (!client.isConnected()) await client.connect();
  const response = await client.request({
    command: "account_nfts",
    account: address,
    ledger_index: "validated",
  });
  return response.result.account_nfts ?? [];
}
