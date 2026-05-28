/**
 * Client-safe AMM calculation utilities (ported from xrpl_mvp).
 * Uses native Number arithmetic to avoid pulling in BigNumber.
 */

export interface AMMCalcResult {
  success: boolean;
  estimatedOutput?: number;
  inputWithSlippage?: number;
  error?: string;
}

/**
 * Estimate output from input using constant-product formula.
 * tradingFeeDecimal is the fee as a decimal (e.g. 0.005 = 0.5%).
 */
export function calculateEstimateOutput(
  poolX: number,
  poolY: number,
  input: number,
  tradingFeeDecimal: number = 0,
): AMMCalcResult {
  try {
    if (poolX <= 0 || poolY <= 0) throw new Error("Pool balances must be positive");
    if (input <= 0) throw new Error("Input must be positive");

    const k = poolX * poolY;
    const newPoolX = poolX + input;
    const newPoolY = k / newPoolX;
    const grossOutput = poolY - newPoolY;
    const netOutput = grossOutput * (1 - tradingFeeDecimal);

    return { success: true, estimatedOutput: netOutput };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Calculate exact input needed for desired output (constant-product).
 */
export function calculateExactAMMInput(
  poolX: number,
  poolY: number,
  desiredOutput: number,
  slippageDecimal: number = 0,
  tradingFeeDecimal: number = 0,
): AMMCalcResult {
  try {
    if (poolX <= 0 || poolY <= 0) throw new Error("Pool balances must be positive");
    if (desiredOutput <= 0) throw new Error("Desired output must be positive");
    if (desiredOutput >= poolY) throw new Error("Desired output exceeds liquidity");

    let adjusted = desiredOutput;
    if (tradingFeeDecimal > 0) {
      adjusted = desiredOutput / (1 - tradingFeeDecimal);
    }
    const k = poolX * poolY;
    const newPoolY = poolY - adjusted;
    if (newPoolY <= 0) throw new Error("Insufficient liquidity");
    const newPoolX = k / newPoolY;
    const exactInput = newPoolX - poolX;
    if (exactInput <= 0) throw new Error("Invalid calculated input");
    const inputWithSlippage = exactInput * (1 + slippageDecimal);
    return { success: true, inputWithSlippage };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
