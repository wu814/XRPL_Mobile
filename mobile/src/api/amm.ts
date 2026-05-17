import { apiClient } from "../lib/api/client";

export interface AmmRow {
  id: string;
  account: string;
  currency1: string;
  currency2: string;
  issuer_address: string;
  treasury_address: string;
  created_at: string;
}

export interface AmmInfo {
  account: string;
  formattedAmount1: { currency: string; issuer: string; value: string };
  formattedAmount2: { currency: string; issuer: string; value: string };
  lpToken: { currency: string; issuer: string; value: string };
  tradingFee: number;
}

export interface AssetSpec {
  currency: string;
  issuer: string;
  value: string;
}

export async function listAmms() {
  const { data } = await apiClient.get<AmmRow[]>("/amm");
  return data;
}

export async function getAmm(account: string) {
  const { data } = await apiClient.get<AmmInfo>(`/amm/${account}`);
  return data;
}

export async function addLiquidity(input: {
  account: string;
  walletAddress: string;
  amount1: AssetSpec;
  amount2: AssetSpec;
}) {
  const { data } = await apiClient.post(`/amm/${input.account}/liquidity`, {
    walletAddress: input.walletAddress,
    amount1: input.amount1,
    amount2: input.amount2,
  });
  return data as { hash: string };
}

export async function withdrawLiquidity(input: {
  account: string;
  walletAddress: string;
  asset1: { currency: string; issuer: string };
  asset2: { currency: string; issuer: string };
  lpToken: { currency: string; issuer: string; value: string };
}) {
  const { data } = await apiClient.delete(`/amm/${input.account}/liquidity`, {
    data: input,
  });
  return data as { hash: string };
}

export async function ammSwap(input: {
  account: string;
  walletAddress: string;
  sendMax: string | AssetSpec;
  destinationAmount: string | AssetSpec;
}) {
  const { data } = await apiClient.post(`/amm/${input.account}/swap`, input);
  return data as { hash: string };
}
