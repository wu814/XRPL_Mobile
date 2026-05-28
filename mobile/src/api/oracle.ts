import { apiClient } from "../lib/api/client";

export async function setOracle(input: {
  walletAddress: string;
  oracleDocumentId: number;
  provider: string;
  assetClass: string;
  baseAsset: string;
  quoteAsset: string;
  price: number;
  scale: number;
  uri?: string;
}) {
  const { data } = await apiClient.post<{ hash: string }>("/oracle", input);
  return data;
}

export async function deleteOracle(input: {
  walletAddress: string;
  oracleDocumentId: number;
}) {
  const { data } = await apiClient.delete<{ hash: string }>("/oracle", { data: input });
  return data;
}
