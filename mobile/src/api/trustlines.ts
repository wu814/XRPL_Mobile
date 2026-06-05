import { apiClient } from "../lib/api/client";

export type FreezeMode = "freeze" | "deep_freeze" | "unfreeze";

export interface WelcomeBonusInfo {
  currency: string;
  amount: string;
  usdValue: number;
  pricePerUnitUSD: number;
  skipped: boolean;
  skipReason?: string;
  transactionHash?: string;
}

export interface SetTrustlineResult {
  hash: string;
  trustlineAlreadyExisted?: boolean;
  message?: string;
  /** Bonus is being issued asynchronously after trustline + authorize complete. */
  welcomeBonusPending?: boolean;
  welcomeBonus?: WelcomeBonusInfo;
}

export async function setTrustline(input: {
  walletAddress: string;
  currency: string;
  issuer: string;
  limit: string;
}) {
  const { data } = await apiClient.post<SetTrustlineResult>("/trustlines", input);
  return data;
}

export async function authorizeTrustline(input: {
  issuerAddress: string;
  currency: string;
  holderAddress: string;
}) {
  const { data } = await apiClient.post<{ hash: string }>("/trustlines/authorize", input);
  return data;
}

export async function freezeTrustline(input: {
  issuerAddress: string;
  currency: string;
  holderAddress: string;
  mode: FreezeMode;
}) {
  const { data } = await apiClient.post<{ hash: string }>("/trustlines/freeze", input);
  return data;
}
