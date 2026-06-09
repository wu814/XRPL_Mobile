import { apiClient } from "../lib/api/client";

export type OfferExecution = "gtc" | "ioc" | "fok";

export interface OfferFlags {
  execution: OfferExecution;
  passive?: boolean;
  sell?: boolean;
}

export interface XrpAmount {
  /** Drops as decimal string */
  drops: string;
}
export interface IouAmount {
  currency: string;
  issuer: string;
  value: string;
}
export type Amount = string | IouAmount;

export interface CreateOfferRequest {
  walletAddress: string;
  takerPays: Amount;
  takerGets: Amount;
  execution?: OfferExecution;
  passive?: boolean;
  sell?: boolean;
}

export async function createOffer(req: CreateOfferRequest) {
  const { data } = await apiClient.post("/dex/offers", req);
  return data as { hash: string; offerSequence?: number; ledgerIndex: number };
}

export async function cancelOffer(walletAddress: string, sequence: number) {
  const { data } = await apiClient.delete(`/dex/offers/${sequence}`, { data: { walletAddress } });
  return data as { hash: string; ledgerIndex: number };
}

export async function userOffers(address: string) {
  const { data } = await apiClient.get(`/dex/offers/user/${address}`);
  return data as Array<Record<string, unknown>>;
}

export async function bookOffers(params: {
  takerGetsCurrency: string;
  takerGetsIssuer?: string;
  takerPaysCurrency: string;
  takerPaysIssuer?: string;
}) {
  const { data } = await apiClient.get("/dex/offers/book", { params });
  return data as Array<Record<string, unknown>>;
}

export type PastDexOfferStatus = "filled" | "cancelled";

export interface PastDexOffer {
  hash: string;
  date: number;
  status: PastDexOfferStatus;
  takerGets: unknown;
  takerPays: unknown;
  flags?: number;
}

export async function completedOffers(address: string) {
  const { data } = await apiClient.get(`/dex/offers/completed/${address}`);
  return data as PastDexOffer[];
}
