import type { AMMDeposit, Amount, Client, Wallet } from "xrpl";
import { handleTransactionError, isTypedTransactionSuccessful } from "../../../lib/errorHandler.js";

interface AssetSpec {
  currency: string;
  issuer: string;
  value: string;
}

function toAmount(a: AssetSpec): Amount {
  if (a.currency === "XRP") return Math.floor(Number(a.value) * 1_000_000).toString();
  return { currency: a.currency, issuer: a.issuer, value: a.value };
}

function toCurrency(a: AssetSpec) {
  return a.currency === "XRP" ? { currency: "XRP" } : { currency: a.currency, issuer: a.issuer };
}

export async function addLiquidityTwoAsset(
  client: Client,
  wallet: Wallet,
  amount1: AssetSpec,
  amount2: AssetSpec,
): Promise<{ hash: string }> {
  if (!client.isConnected()) await client.connect();

  const tx: AMMDeposit = {
    TransactionType: "AMMDeposit",
    Account: wallet.classicAddress,
    Flags: 0x00100000, // tfTwoAsset
    Amount: toAmount(amount1),
    Amount2: toAmount(amount2),
    Asset: toCurrency(amount1) as never,
    Asset2: toCurrency(amount2) as never,
  };
  const prepared = await client.autofill(tx);
  const signed = wallet.sign(prepared);
  const result = await client.submitAndWait<AMMDeposit>(signed.tx_blob);
  if (!isTypedTransactionSuccessful(result)) {
    const err = handleTransactionError(result, "addLiquidityTwoAsset");
    throw new Error(err.message);
  }
  return { hash: result.result.hash };
}
