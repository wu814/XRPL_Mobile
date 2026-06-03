import { convertStringToHex, type Client, type OracleDelete, type OracleSet, type Wallet } from "xrpl";
import { handleTransactionError, isTypedTransactionSuccessful } from "../../../lib/errorHandler.js";

interface SetOracleInput {
  oracleDocumentId: number;
  provider: string;
  assetClass: string;
  baseAsset: string;
  quoteAsset: string;
  price: number;
  scale: number;
  uri?: string;
}

// XRPL OracleSet uses an epoch offset of 946684800 seconds (2000-01-01) for
// LastUpdateTime, but the protocol accepts a standard Unix timestamp here.
function currentUnixTime(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Create or update a Price Oracle entry owned by the given wallet.
 *
 * Provider / assetClass / uri are hex-encoded per the XRPL spec. AssetPrice is
 * the price scaled by 10^scale, encoded as a hex integer.
 */
export async function setOracle(
  client: Client,
  wallet: Wallet,
  input: SetOracleInput,
): Promise<{ hash: string }> {
  if (!client.isConnected()) await client.connect();

  const scaledPrice = Math.round(input.price * 10 ** input.scale);
  if (!Number.isFinite(scaledPrice) || scaledPrice < 0) {
    throw new Error("Invalid oracle price");
  }

  const tx: OracleSet = {
    TransactionType: "OracleSet",
    Account: wallet.classicAddress,
    OracleDocumentID: input.oracleDocumentId,
    Provider: convertStringToHex(input.provider),
    AssetClass: convertStringToHex(input.assetClass),
    LastUpdateTime: currentUnixTime(),
    PriceDataSeries: [
      {
        PriceData: {
          BaseAsset: input.baseAsset,
          QuoteAsset: input.quoteAsset,
          AssetPrice: scaledPrice.toString(16),
          Scale: input.scale,
        },
      },
    ],
    ...(input.uri ? { URI: convertStringToHex(input.uri) } : {}),
  };

  const prepared = await client.autofill(tx);
  const signed = wallet.sign(prepared);
  const result = await client.submitAndWait<OracleSet>(signed.tx_blob);
  if (!isTypedTransactionSuccessful(result)) {
    const err = handleTransactionError(result, "setOracle");
    throw new Error(err.message);
  }
  return { hash: result.result.hash };
}

export async function deleteOracle(
  client: Client,
  wallet: Wallet,
  oracleDocumentId: number,
): Promise<{ hash: string }> {
  if (!client.isConnected()) await client.connect();

  const tx: OracleDelete = {
    TransactionType: "OracleDelete",
    Account: wallet.classicAddress,
    OracleDocumentID: oracleDocumentId,
  };
  const prepared = await client.autofill(tx);
  const signed = wallet.sign(prepared);
  const result = await client.submitAndWait<OracleDelete>(signed.tx_blob);
  if (!isTypedTransactionSuccessful(result)) {
    const err = handleTransactionError(result, "deleteOracle");
    throw new Error(err.message);
  }
  return { hash: result.result.hash };
}
