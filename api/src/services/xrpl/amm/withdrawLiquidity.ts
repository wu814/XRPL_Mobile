import type { AMMWithdraw, Client, Wallet } from "xrpl";
import { handleTransactionError, isTypedTransactionSuccessful } from "../../../lib/errorHandler.js";
import { type PoolAsset, pickPoolAssets, toAmount, toCurrency, zeroAmount } from "./assetSpec.js";

export interface AmmPoolAssets {
  formattedAmount1: PoolAsset;
  formattedAmount2: PoolAsset;
  lpToken: { currency: string; issuer: string };
}

async function submitWithdraw(client: Client, wallet: Wallet, tx: AMMWithdraw): Promise<{ hash: string }> {
  if (!client.isConnected()) await client.connect();
  const prepared = await client.autofill(tx);
  const signed = wallet.sign(prepared);
  const result = await client.submitAndWait<AMMWithdraw>(signed.tx_blob);
  if (!isTypedTransactionSuccessful(result)) {
    const err = handleTransactionError(result, "AMMWithdraw");
    throw new Error(err.message);
  }
  return { hash: result.result.hash };
}

export async function withdrawLiquidityTwoAsset(
  client: Client,
  wallet: Wallet,
  pool: AmmPoolAssets,
  value1: string,
  value2: string,
): Promise<{ hash: string }> {
  return submitWithdraw(client, wallet, {
    TransactionType: "AMMWithdraw",
    Account: wallet.classicAddress,
    Asset: toCurrency(pool.formattedAmount1) as never,
    Asset2: toCurrency(pool.formattedAmount2) as never,
    Amount: toAmount({ ...pool.formattedAmount1, value: value1 }),
    Amount2: toAmount({ ...pool.formattedAmount2, value: value2 }),
    Flags: 0x00100000, // tfTwoAsset
  });
}

export async function withdrawWithLPToken(
  client: Client,
  wallet: Wallet,
  pool: AmmPoolAssets,
  lpTokenValue: string,
): Promise<{ hash: string }> {
  return submitWithdraw(client, wallet, {
    TransactionType: "AMMWithdraw",
    Account: wallet.classicAddress,
    Asset: toCurrency(pool.formattedAmount1) as never,
    Asset2: toCurrency(pool.formattedAmount2) as never,
    LPTokenIn: { currency: pool.lpToken.currency, issuer: pool.lpToken.issuer, value: lpTokenValue },
    Flags: 0x00010000, // tfLPToken
  });
}

export async function withdrawAllLiquidity(
  client: Client,
  wallet: Wallet,
  pool: AmmPoolAssets,
): Promise<{ hash: string }> {
  return submitWithdraw(client, wallet, {
    TransactionType: "AMMWithdraw",
    Account: wallet.classicAddress,
    Asset: toCurrency(pool.formattedAmount1) as never,
    Asset2: toCurrency(pool.formattedAmount2) as never,
    Flags: 0x00020000, // tfWithdrawAll
  });
}

export async function withdrawSingleAsset(
  client: Client,
  wallet: Wallet,
  pool: AmmPoolAssets,
  withdrawCurrency: string,
  withdrawValue: string,
): Promise<{ hash: string }> {
  const { deposit, other } = pickPoolAssets(pool.formattedAmount1, pool.formattedAmount2, withdrawCurrency);
  return submitWithdraw(client, wallet, {
    TransactionType: "AMMWithdraw",
    Account: wallet.classicAddress,
    Asset: toCurrency(deposit) as never,
    Asset2: toCurrency(other) as never,
    Amount: toAmount({ ...deposit, value: withdrawValue }),
    Flags: 0x00080000, // tfSingleAsset
  });
}

export async function withdrawAllSingleAsset(
  client: Client,
  wallet: Wallet,
  pool: AmmPoolAssets,
  withdrawCurrency: string,
): Promise<{ hash: string }> {
  const { deposit, other } = pickPoolAssets(pool.formattedAmount1, pool.formattedAmount2, withdrawCurrency);
  return submitWithdraw(client, wallet, {
    TransactionType: "AMMWithdraw",
    Account: wallet.classicAddress,
    Asset: toCurrency(deposit) as never,
    Asset2: toCurrency(other) as never,
    Amount: zeroAmount(deposit),
    Flags: 0x00040000, // tfWithdrawAllSingleAsset
  });
}

export async function withdrawSingleAssetWithLPToken(
  client: Client,
  wallet: Wallet,
  pool: AmmPoolAssets,
  withdrawCurrency: string,
  lpTokenValue: string,
): Promise<{ hash: string }> {
  const { deposit, other } = pickPoolAssets(pool.formattedAmount1, pool.formattedAmount2, withdrawCurrency);
  return submitWithdraw(client, wallet, {
    TransactionType: "AMMWithdraw",
    Account: wallet.classicAddress,
    Asset: toCurrency(deposit) as never,
    Asset2: toCurrency(other) as never,
    Amount: zeroAmount(deposit),
    LPTokenIn: { currency: pool.lpToken.currency, issuer: pool.lpToken.issuer, value: lpTokenValue },
    Flags: 0x00200000, // tfOneAssetLPToken
  });
}
