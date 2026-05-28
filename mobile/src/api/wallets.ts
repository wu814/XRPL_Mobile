import { apiClient } from "../lib/api/client";

export type WalletType = "user" | "issuer" | "treasury" | "pathfind";

export interface WalletSummary {
  id: string;
  classic_address: string;
  wallet_type: WalletType;
  created_at: string;
  balanceXrp?: number;
}

export async function listWallets(): Promise<WalletSummary[]> {
  const { data } = await apiClient.get<WalletSummary[]>("/wallets");
  return data;
}

export async function createWallet(walletType: WalletType = "user"): Promise<WalletSummary> {
  const { data } = await apiClient.post<WalletSummary>("/wallets", { walletType });
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

export interface WalletByUsername {
  username: string;
  classic_address: string;
  wallet_type: string;
}

export interface IssuerWallet {
  classic_address: string;
  wallet_type: string;
}

export async function getIssuerWallets(): Promise<IssuerWallet[]> {
  const { data } = await apiClient.get<IssuerWallet[]>("/wallets/issuers");
  return data;
}

export async function getWalletByUsername(username: string): Promise<WalletByUsername> {
  const { data } = await apiClient.get<WalletByUsername>(
    `/wallets/by-username/${encodeURIComponent(username)}`,
  );
  return data;
}

export async function authorizeDeposit(input: {
  walletAddress: string;
  authorizedAddress: string;
}): Promise<{ message: string }> {
  const { data } = await apiClient.post<{ message: string }>(
    `/wallets/${input.walletAddress}/authorize-deposit`,
    { authorizedAddress: input.authorizedAddress },
  );
  return data;
}
