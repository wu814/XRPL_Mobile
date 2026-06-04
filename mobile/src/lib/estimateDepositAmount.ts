import type { AmmInfo } from "@/src/api/amm";

export interface EstimateDepositAmountsResult {
  amount1: { currency: string; issuer: string; value: string } | null;
  amount2: { currency: string; issuer: string; value: string } | null;
  singleAmount: { currency: string; issuer: string; value: string } | null;
  maxSingleAmount: { currency: string; issuer: string; value: string } | null;
}

function computeLPFromSingleAsset(B: number, P: number, T: number, F: number, W: number): number {
  const feeComponent = F * (1 - W) * B;
  const adjustedAmount = B - feeComponent;
  const ratio = adjustedAmount / P;
  const base = 1 + ratio;
  const power = W === 0.5 ? Math.sqrt(base) : Math.pow(base, W);
  return T * (power - 1);
}

function solveDepositAmount(P: number, T: number, F: number, W: number, desiredL: number): number {
  let low = 0;
  let high = P * (desiredL / T) * 10;
  const epsilon = 1e-8;

  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    const result = computeLPFromSingleAsset(mid, P, T, F, W);
    const diff = result - desiredL;
    if (Math.abs(diff) < epsilon) return mid;
    if (diff < 0) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

/** Mirrors xrpl_mvp estimateDepositAmounts for LP-token deposit mode. */
export function estimateDepositAmounts(
  ammInfo: AmmInfo,
  lpTokenValue: number,
  payWith: string,
  slippagePercentage: number,
): EstimateDepositAmountsResult {
  const totalLP = Number(ammInfo.lpToken.value) || 0;
  const poolA = Number(ammInfo.formattedAmount1.value) || 0;
  const poolB = Number(ammInfo.formattedAmount2.value) || 0;
  const desiredLP = lpTokenValue;
  const feeDecimal = (ammInfo.tradingFee || 0) / 1_000_000;
  const weight = 0.5;
  const slippageMultiplier = 1 + slippagePercentage / 100;

  if (!desiredLP || !totalLP || desiredLP <= 0 || totalLP <= 0) {
    return { amount1: null, amount2: null, singleAmount: null, maxSingleAmount: null };
  }

  const ratio = desiredLP / totalLP;
  const amount1 = {
    currency: ammInfo.formattedAmount1.currency,
    issuer: ammInfo.formattedAmount1.issuer,
    value: (ratio * poolA).toFixed(6),
  };
  const amount2 = {
    currency: ammInfo.formattedAmount2.currency,
    issuer: ammInfo.formattedAmount2.issuer,
    value: (ratio * poolB).toFixed(6),
  };

  let singleAmount: EstimateDepositAmountsResult["singleAmount"] = null;
  let maxSingleAmount: EstimateDepositAmountsResult["maxSingleAmount"] = null;

  if (payWith === ammInfo.formattedAmount1.currency) {
    const value = solveDepositAmount(poolA, totalLP, feeDecimal, weight, desiredLP);
    const roundedUp = Math.ceil(value * 1e6) / 1e6;
    singleAmount = {
      currency: ammInfo.formattedAmount1.currency,
      issuer: ammInfo.formattedAmount1.issuer,
      value: roundedUp.toFixed(6),
    };
    maxSingleAmount = {
      ...singleAmount,
      value: (roundedUp * slippageMultiplier).toFixed(6),
    };
  } else if (payWith === ammInfo.formattedAmount2.currency) {
    const value = solveDepositAmount(poolB, totalLP, feeDecimal, weight, desiredLP);
    const roundedUp = Math.ceil(value * 1e6) / 1e6;
    singleAmount = {
      currency: ammInfo.formattedAmount2.currency,
      issuer: ammInfo.formattedAmount2.issuer,
      value: roundedUp.toFixed(6),
    };
    maxSingleAmount = {
      ...singleAmount,
      value: (roundedUp * slippageMultiplier).toFixed(6),
    };
  }

  return { amount1, amount2, singleAmount, maxSingleAmount };
}

export function poolIssuerAddress(ammInfo: AmmInfo): string {
  return ammInfo.formattedAmount1.issuer || ammInfo.formattedAmount2.issuer;
}
