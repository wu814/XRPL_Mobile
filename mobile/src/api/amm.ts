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

export type DepositType = "twoAsset" | "twoAssetLPToken" | "oneAsset" | "oneAssetLPToken";
export type WithdrawMode =
  | "twoAsset"
  | "lpToken"
  | "all"
  | "singleAsset"
  | "singleAssetAll"
  | "singleAssetLp";
export type SwapPaymentType = "exact_input" | "exact_output";

export async function listAmms() {
  const { data } = await apiClient.get<AmmRow[]>("/amm");
  return data;
}

export async function getAmm(account: string) {
  const { data } = await apiClient.get<AmmInfo>(`/amm/${account}`);
  return data;
}

export interface CreateAmmInput {
  treasuryAddress: string;
  issuerAddress: string;
  currency1: string;
  value1: number;
  currency2: string;
  value2: number;
  tradingFee?: number;
}

export async function createAmm(input: CreateAmmInput) {
  const { data } = await apiClient.post("/amm", input);
  return data as { account: string; currency1: string; currency2: string };
}

export async function getAmmInfoByCurrencies(input: {
  sellCurrency: string;
  buyCurrency: string;
}): Promise<AmmInfo> {
  const { data } = await apiClient.post<AmmInfo>("/amm/info-by-currencies", input);
  return data;
}

export type AddLiquidityBody =
  | {
      depositType: "twoAsset";
      walletAddress: string;
      addValue1: string;
      addValue2: string;
    }
  | {
      depositType: "twoAssetLPToken";
      walletAddress: string;
      addValue1: string;
      addValue2: string;
      lpTokenValue: string;
    }
  | {
      depositType: "oneAsset";
      walletAddress: string;
      addValue1: string;
      selectedCurrency: string;
    }
  | {
      depositType: "oneAssetLPToken";
      walletAddress: string;
      addValue1: string;
      selectedCurrency: string;
      lpTokenValue: string;
    };

export async function addLiquidity(account: string, body: AddLiquidityBody) {
  const { data } = await apiClient.post(`/amm/${account}/liquidity`, body);
  return data as { hash: string };
}

export type WithdrawLiquidityBody =
  | {
      mode: "twoAsset";
      walletAddress: string;
      withdrawValue1: string;
      withdrawValue2: string;
    }
  | { mode: "lpToken"; walletAddress: string; lpTokenValue: string }
  | { mode: "all"; walletAddress: string }
  | {
      mode: "singleAsset";
      walletAddress: string;
      singleWithdrawCurrency: string;
      singleWithdrawValue: string;
    }
  | { mode: "singleAssetAll"; walletAddress: string; singleWithdrawCurrency: string }
  | {
      mode: "singleAssetLp";
      walletAddress: string;
      singleWithdrawCurrency: string;
      lpTokenValue: string;
    };

export async function withdrawLiquidity(account: string, body: WithdrawLiquidityBody) {
  const { data } = await apiClient.delete(`/amm/${account}/liquidity`, { data: body });
  return data as { hash: string; poolDeleted: boolean };
}

export async function ammSwap(
  account: string,
  body: {
    walletAddress: string;
    sendCurrency: string;
    receiveCurrency: string;
    issuerAddress: string;
    paymentType: SwapPaymentType;
    sendAmount?: number;
    exactOutputAmount?: number;
    slippagePercent?: number;
  },
) {
  const { data } = await apiClient.post(`/amm/${account}/swap`, body);
  return data as { hash: string };
}
