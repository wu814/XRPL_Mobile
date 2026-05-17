import { apiClient } from "../lib/api/client";

export interface WalletSummary {
  id: string;
  classic_address: string;
  wallet_type: "user" | "issuer" | "treasury";
  created_at: string;
  balanceXrp?: number;
}

export async function listWallets(): Promise<WalletSummary[]> {
  const { data } = await apiClient.get<WalletSummary[]>("/wallets");
  return data;
}

export async function createWallet(): Promise<WalletSummary> {
  const { data } = await apiClient.post<WalletSummary>("/wallets", { walletType: "user" });
  return data;
}

export async function deleteWallet(address: string): Promise<void> {
  await apiClient.delete(`/wallets/${address}`);
}

export async function getWalletInfo(address: string) {
  const { data } = await apiClient.get(`/wallets/${address}/info`);
  return data;
}

export async function getWalletLines(address: string) {
  const { data } = await apiClient.get(`/wallets/${address}/lines`);
  return data;
}
