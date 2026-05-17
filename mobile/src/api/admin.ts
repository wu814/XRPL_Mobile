import { apiClient } from "../lib/api/client";

export interface AdminWalletRow {
  id: string;
  classic_address: string;
  wallet_type: "user" | "issuer" | "treasury";
  user_id: string | null;
  created_at: string;
}

export async function adminWallets() {
  const { data } = await apiClient.get<AdminWalletRow[]>("/admin/wallets");
  return data;
}

export async function adminBootstrap() {
  const { data } = await apiClient.post<{ issuer: string; treasury: string }>("/admin/bootstrap");
  return data;
}

export async function adminIssue(input: {
  treasuryAddress: string;
  destinationAddress: string;
  currency: string;
  issuerAddress: string;
  value: string;
}) {
  const { data } = await apiClient.post("/admin/issue", input);
  return data as { hash: string };
}

export async function adminFundWallet(walletAddress?: string) {
  const { data } = await apiClient.post("/admin/fund-wallet", walletAddress ? { walletAddress } : {});
  return data as { address: string; balanceXrp: number; ephemeral?: boolean };
}

export async function adminPromote(email: string) {
  const { data } = await apiClient.post("/admin/promote", { email });
  return data;
}
