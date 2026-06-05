import { type Client, type OracleSet, type Wallet } from "xrpl";
import { handleTransactionError, isTypedTransactionSuccessful } from "../../../lib/errorHandler.js";
import { fetchCoinGeckoPrices } from "./coinGecko.js";

interface PriceData {
  baseAsset: string;
  quoteAsset: string;
  assetPrice: number;
  scale: number;
}

function currentUnixTime(): number {
  return Math.floor(Date.now() / 1000);
}

function formatAsset(asset: string): string {
  if (asset.length <= 3) return asset;
  return Buffer.from(asset, "utf8").toString("hex").toUpperCase().padEnd(40, "0");
}

async function oracleSetMultiAsset(
  client: Client,
  ownerWallet: Wallet,
  oracleDocumentId: number,
  provider: string,
  assetClass: string,
  priceDataArray: PriceData[],
): Promise<{ hash: string; assetCount: number }> {
  if (!client.isConnected()) await client.connect();

  const providerHex = Buffer.from(provider, "utf8").toString("hex").toUpperCase();
  const assetClassHex = Buffer.from(assetClass, "utf8").toString("hex").toUpperCase();

  const priceDataSeries = priceDataArray.map((priceData) => ({
    PriceData: {
      BaseAsset: formatAsset(priceData.baseAsset),
      QuoteAsset: formatAsset(priceData.quoteAsset),
      AssetPrice: priceData.assetPrice,
      Scale: priceData.scale,
    },
  }));

  const tx: OracleSet = {
    TransactionType: "OracleSet",
    Account: ownerWallet.classicAddress,
    OracleDocumentID: oracleDocumentId,
    Provider: providerHex,
    AssetClass: assetClassHex,
    LastUpdateTime: currentUnixTime(),
    PriceDataSeries: priceDataSeries,
  };

  const prepared = await client.autofill(tx);
  const signed = ownerWallet.sign(prepared);
  const result = await client.submitAndWait<OracleSet>(signed.tx_blob);
  if (!isTypedTransactionSuccessful(result)) {
    const err = handleTransactionError(result, "setOracle");
    throw new Error(err.message);
  }

  return { hash: result.result.hash, assetCount: priceDataSeries.length };
}

/**
 * Create or update a multi-asset crypto oracle with live CoinGecko prices.
 * Mirrors xrpl_mvp createLiveCryptoOracle.
 */
export async function createLiveCryptoOracle(
  client: Client,
  ownerWallet: Wallet,
  oracleDocumentId: number,
  coinGeckoIds: string[],
  vsCurrency = "usd",
): Promise<{ hash: string; assetCount: number }> {
  const livePrices = await fetchCoinGeckoPrices(coinGeckoIds, vsCurrency);

  const scale = 2;
  const priceDataArray: PriceData[] = livePrices.map((crypto) => ({
    baseAsset: crypto.symbol,
    quoteAsset: crypto.quoteAsset,
    assetPrice: Math.round(crypto.price * Math.pow(10, scale)),
    scale,
  }));

  return oracleSetMultiAsset(
    client,
    ownerWallet,
    oracleDocumentId,
    "CoinGecko",
    "cryptocurrency",
    priceDataArray,
  );
}
