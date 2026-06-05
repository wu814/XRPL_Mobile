import type { Client, LedgerEntryRequest, LedgerIndex } from "xrpl";

interface PriceDataSeries {
  PriceData: {
    BaseAsset: string;
    QuoteAsset: string;
    AssetPrice: string | number;
    Scale: number;
    AssetPriceDecimal?: number;
  };
}

interface OracleNode {
  Provider: string;
  AssetClass: string;
  LastUpdateTime?: number;
  PriceDataSeries?: PriceDataSeries[];
  [key: string]: unknown;
}

export interface DecodedOracle {
  Provider: string;
  AssetClass: string;
  LastUpdateTime?: number;
  PriceDataSeries?: PriceDataSeries[];
}

export interface OracleDataResult {
  oracle: DecodedOracle;
  ledgerIndex: string | number;
}

function hexToString(hex: string): string {
  try {
    if (!hex) return "";
    const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
    const buffer = Buffer.from(cleanHex, "hex");
    return buffer.toString("utf8").replace(/\0/g, "");
  } catch {
    return hex;
  }
}

export function decodeAssetPrice(assetPrice: string | number, scale: number): number {
  let raw: number;
  if (typeof assetPrice === "string") {
    const hex = assetPrice.startsWith("0x") ? assetPrice : `0x${assetPrice}`;
    raw = parseInt(hex, 16);
  } else {
    raw = assetPrice;
  }
  if (!Number.isFinite(raw)) return 0;
  return raw / Math.pow(10, scale || 0);
}

export async function getOracleData(
  client: Client,
  account: string,
  oracleDocumentId: number,
  ledgerIndex: LedgerIndex = "validated",
): Promise<OracleDataResult> {
  if (!client.isConnected()) await client.connect();

  const request: LedgerEntryRequest = {
    command: "ledger_entry",
    oracle: {
      account,
      oracle_document_id: oracleDocumentId,
    },
    ledger_index: ledgerIndex,
  };

  const response = await client.request(request);
  const node = (response.result as { node?: OracleNode; ledger_index?: string | number }).node;
  if (!node) {
    throw new Error(`Oracle not found: Account ${account}, ID ${oracleDocumentId}`);
  }

  const decodedOracle: DecodedOracle = {
    ...node,
    Provider: hexToString(node.Provider),
    AssetClass: hexToString(node.AssetClass),
    PriceDataSeries: node.PriceDataSeries?.map((series) => ({
      ...series,
      PriceData: {
        ...series.PriceData,
        AssetPriceDecimal: decodeAssetPrice(series.PriceData.AssetPrice, series.PriceData.Scale),
      },
    })),
  };

  return {
    oracle: decodedOracle,
    ledgerIndex: (response.result as { ledger_index?: string | number }).ledger_index ?? ledgerIndex,
  };
}
