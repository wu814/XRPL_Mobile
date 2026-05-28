import { apiClient } from "../lib/api/client";

export interface ProcessedTransaction {
  hash: string;
  ledger_index: number | null;
  date: string | null;
  type: string;
  direction: string;
  counterparty: string | null;
  amount: string | number | null;
  currency: string;
  fee: string | null;
  validated: boolean;
  result: string;
}

export interface AccountTransactionsResponse {
  transactions: ProcessedTransaction[];
  marker: string | null;
  message?: string;
}

export async function getAccountTransactions(
  address: string,
  opts?: { limit?: number; marker?: string | null },
): Promise<AccountTransactionsResponse> {
  const { data } = await apiClient.get<AccountTransactionsResponse>(
    `/transactions/${address}/history`,
    {
      params: {
        limit: opts?.limit ?? 30,
        ...(opts?.marker ? { marker: opts.marker } : {}),
      },
    },
  );
  return data;
}

export async function sendXrp(input: {
  walletAddress: string;
  destination?: string;
  destinationUsername?: string;
  xrpAmount: number;
  destinationTag?: number;
}) {
  const { data } = await apiClient.post("/transactions/xrp", input);
  return data as { hash: string };
}

export async function sendIou(input: {
  walletAddress: string;
  destination?: string;
  destinationUsername?: string;
  currency: string;
  issuer: string;
  value: string;
}) {
  const { data } = await apiClient.post("/transactions/iou", input);
  return data as { hash: string };
}

export async function clawback(input: {
  issuerAddress: string;
  currency: string;
  holderAddress: string;
  value: string;
}) {
  const { data } = await apiClient.post("/transactions/clawback", input);
  return data as { hash: string };
}

export type CrossCurrencyMode = "exact_input" | "exact_output";

export async function sendCrossCurrency(input: {
  walletAddress: string;
  destination?: string;
  destinationUsername?: string;
  sendCurrency: string;
  receiveCurrency: string;
  issuerAddress: string;
  mode: CrossCurrencyMode;
  sendAmount?: number;
  exactOutputAmount?: number;
  slippagePercent?: number;
  destinationTag?: number;
}) {
  const { data } = await apiClient.post("/transactions/cross-currency", input);
  return data as { hash: string };
}
