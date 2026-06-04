import type { AMMDeposit, Client, Wallet } from "xrpl";
import { handleTransactionError, isTypedTransactionSuccessful } from "../../../lib/errorHandler.js";
import { type PoolAsset, pickPoolAssets, toAmount, toCurrency } from "./assetSpec.js";

export interface AmmPoolAssets {
  formattedAmount1: PoolAsset;
  formattedAmount2: PoolAsset;
  lpToken: { currency: string; issuer: string };
}

async function submitDeposit(client: Client, wallet: Wallet, tx: AMMDeposit): Promise<{ hash: string }> {
  if (!client.isConnected()) await client.connect();
  const prepared = await client.autofill(tx);
  const signed = wallet.sign(prepared);
  const result = await client.submitAndWait<AMMDeposit>(signed.tx_blob);
  if (!isTypedTransactionSuccessful(result)) {
    const err = handleTransactionError(result, "AMMDeposit");
    throw new Error(err.message);
  }
  return { hash: result.result.hash };
}

export async function addLiquidityTwoAsset(
  client: Client,
  wallet: Wallet,
  pool: AmmPoolAssets,
  value1: string,
  value2: string,
): Promise<{ hash: string }> {
  const amount1 = { ...pool.formattedAmount1, value: value1 };
  const amount2 = { ...pool.formattedAmount2, value: value2 };
  return submitDeposit(client, wallet, {
    TransactionType: "AMMDeposit",
    Account: wallet.classicAddress,
    Flags: 0x00100000, // tfTwoAsset
    Amount: toAmount(amount1),
    Amount2: toAmount(amount2),
    Asset: toCurrency(pool.formattedAmount1) as never,
    Asset2: toCurrency(pool.formattedAmount2) as never,
  });
}

export async function addLiquidityTwoAssetLPToken(
  client: Client,
  wallet: Wallet,
  pool: AmmPoolAssets,
  _value1: string,
  _value2: string,
  lpTokenValue: string,
): Promise<{ hash: string }> {
  void _value1;
  void _value2;
  return submitDeposit(client, wallet, {
    TransactionType: "AMMDeposit",
    Account: wallet.classicAddress,
    Flags: 0x00010000, // tfLPToken
    Asset: toCurrency(pool.formattedAmount1) as never,
    Asset2: toCurrency(pool.formattedAmount2) as never,
    LPTokenOut: { currency: pool.lpToken.currency, issuer: pool.lpToken.issuer, value: lpTokenValue },
  });
}

export async function addLiquiditySingleAsset(
  client: Client,
  wallet: Wallet,
  pool: AmmPoolAssets,
  value: string,
  selectedCurrency: string,
): Promise<{ hash: string }> {
  const { deposit, other } = pickPoolAssets(pool.formattedAmount1, pool.formattedAmount2, selectedCurrency);
  return submitDeposit(client, wallet, {
    TransactionType: "AMMDeposit",
    Account: wallet.classicAddress,
    Flags: 0x00080000, // tfSingleAsset
    Asset: toCurrency(deposit) as never,
    Asset2: toCurrency(other) as never,
    Amount: toAmount({ ...deposit, value }),
  });
}

export async function addLiquidityOneAssetLPToken(
  client: Client,
  wallet: Wallet,
  pool: AmmPoolAssets,
  value: string,
  selectedCurrency: string,
  lpTokenValue: string,
): Promise<{ hash: string }> {
  const { deposit, other } = pickPoolAssets(pool.formattedAmount1, pool.formattedAmount2, selectedCurrency);
  return submitDeposit(client, wallet, {
    TransactionType: "AMMDeposit",
    Account: wallet.classicAddress,
    Flags: 0x00200000, // tfOneAssetLPToken
    Asset: toCurrency(deposit) as never,
    Asset2: toCurrency(other) as never,
    Amount: toAmount({ ...deposit, value }),
    LPTokenOut: { currency: pool.lpToken.currency, issuer: pool.lpToken.issuer, value: lpTokenValue },
  });
}
