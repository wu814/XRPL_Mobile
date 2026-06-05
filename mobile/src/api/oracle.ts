import { apiClient } from "../lib/api/client";
import type { PriceInfo, PriceSource } from "@/src/lib/prices";

export interface LivePricesResponse {
  prices: PriceInfo[];
  oracleAvailable: boolean;
  dataSource: PriceSource;
  lastUpdateTime: number | null;
}

export async function getLivePrices() {
  const { data } = await apiClient.get<LivePricesResponse>("/oracle/prices");
  return data;
}

export async function setOracle(input: {
  walletAddress: string;
  oracleDocumentId: number;
}) {
  const { data } = await apiClient.post<{ hash: string; assetCount: number }>("/oracle", input);
  return data;
}

export async function deleteOracle(input: {
  walletAddress: string;
  oracleDocumentId: number;
}) {
  const { data } = await apiClient.delete<{ hash: string }>("/oracle", { data: input });
  return data;
}
