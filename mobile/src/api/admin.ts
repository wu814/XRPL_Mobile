import { apiClient } from "../lib/api/client";

export interface AdminWalletRow {
  id: string;
  classic_address: string;
  wallet_type: "user" | "issuer" | "treasury" | "pathfind";
  user_id: string | null;
  created_at: string;
}

export async function adminWallets() {
  const { data } = await apiClient.get<AdminWalletRow[]>("/admin/wallets");
  return data;
}
