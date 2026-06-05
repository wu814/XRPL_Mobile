import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import type { AmmInfo } from "@/src/api/amm";
import { IconSymbol } from "@/src/components/ui/icon-symbol";
import { useAmmSwap } from "@/src/hooks/useAmm";
import { calculateEstimateOutput, calculateExactAMMInput } from "@/src/lib/ammCalculations";
import { decodeCurrency } from "@/src/lib/formatters";
import { poolIssuerAddress } from "@/src/lib/estimateDepositAmount";
import { AmmSlippageControl } from "./AmmSlippageControl";

type ActiveInput = "sell" | "buy";

interface Props {
  ammInfo: AmmInfo;
  walletAddress: string;
  disabled?: boolean;
}

export function AmmSwapPanel({ ammInfo, walletAddress, disabled }: Props) {
  const swapMut = useAmmSwap();
  const [sellCurrency, setSellCurrency] = useState(ammInfo.formattedAmount1.currency);
  const [buyCurrency, setBuyCurrency] = useState(ammInfo.formattedAmount2.currency);
  const [sellAmount, setSellAmount] = useState("");
  const [buyAmount, setBuyAmount] = useState("");
  const [activeInput, setActiveInput] = useState<ActiveInput>("sell");
  const [slippage, setSlippage] = useState(0);
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);

  const feeDecimal = (ammInfo.tradingFee || 0) / 100_000;

  const poolBalances = () => {
    if (ammInfo.formattedAmount1.currency === sellCurrency) {
      return {
        poolSell: Number(ammInfo.formattedAmount1.value),
        poolBuy: Number(ammInfo.formattedAmount2.value),
      };
    }
    return {
      poolSell: Number(ammInfo.formattedAmount2.value),
      poolBuy: Number(ammInfo.formattedAmount1.value),
    };
  };

  useEffect(() => {
    if (
      !sellAmount ||
      Number(sellAmount) <= 0 ||
      sellCurrency === buyCurrency ||
      activeInput !== "sell"
    ) {
      return;
    }
    const { poolSell, poolBuy } = poolBalances();
    setCalculating(true);
    setCalcError(null);
    const r = calculateEstimateOutput(poolSell, poolBuy, Number(sellAmount), feeDecimal);
    if (r.success && r.estimatedOutput !== undefined) {
      setBuyAmount(r.estimatedOutput.toFixed(6));
    } else {
      setCalcError(r.error ?? "Calculation failed");
      setBuyAmount("");
    }
    setCalculating(false);
  }, [sellAmount, sellCurrency, buyCurrency, activeInput, ammInfo]);

  useEffect(() => {
    if (
      !buyAmount ||
      Number(buyAmount) <= 0 ||
      sellCurrency === buyCurrency ||
      activeInput !== "buy"
    ) {
      return;
    }
    const { poolSell, poolBuy } = poolBalances();
    setCalculating(true);
    setCalcError(null);
    const r = calculateExactAMMInput(
      poolSell,
      poolBuy,
      Number(buyAmount),
      slippage / 100,
      feeDecimal,
    );
    if (r.success && r.inputWithSlippage !== undefined) {
      setSellAmount(r.inputWithSlippage.toFixed(6));
    } else {
      setCalcError(r.error ?? "Calculation failed");
      setSellAmount("");
    }
    setCalculating(false);
  }, [buyAmount, sellCurrency, buyCurrency, activeInput, slippage, ammInfo]);

  const flipCurrencies = () => {
    setSellCurrency(buyCurrency);
    setBuyCurrency(sellCurrency);
    setSellAmount(buyAmount);
    setBuyAmount(sellAmount);
    setActiveInput("sell");
    setCalcError(null);
  };

  const onSubmit = async () => {
    if (!walletAddress) return;
    const issuer = poolIssuerAddress(ammInfo);
    if (!issuer) {
      Alert.alert("Swap", "Could not determine issuer for this pool.");
      return;
    }
    try {
      const paymentType = activeInput === "sell" ? "exact_input" : "exact_output";
      await swapMut.mutateAsync({
        account: ammInfo.account,
        body: {
          walletAddress,
          sendCurrency: sellCurrency,
          receiveCurrency: buyCurrency,
          issuerAddress: issuer,
          paymentType,
          sendAmount: paymentType === "exact_input" ? Number(sellAmount) : Number(sellAmount) || undefined,
          exactOutputAmount: paymentType === "exact_output" ? Number(buyAmount) : undefined,
          slippagePercent: slippage,
        },
      });
      setSellAmount("");
      setBuyAmount("");
      Alert.alert("Swap submitted");
    } catch (err) {
      Alert.alert("Swap failed", (err as Error).message);
    }
  };

  const canSwap =
    sellCurrency &&
    buyCurrency &&
    sellCurrency !== buyCurrency &&
    ((sellAmount && Number(sellAmount) > 0) || (buyAmount && Number(buyAmount) > 0));

  return (
    <View className="rounded-2xl border border-white/10 p-5">
      <AmmSlippageControl slippage={slippage} onChange={setSlippage} />

      {calcError ? <Text className="mb-2 text-xs text-red-400">{calcError}</Text> : null}

      <Text className="mb-1 text-xs text-white/50">Sell ({decodeCurrency(sellCurrency)})</Text>
      <TextInput
        value={sellAmount}
        onChangeText={(t) => {
          setActiveInput("sell");
          setSellAmount(t);
          setBuyAmount("");
        }}
        placeholder="0.00"
        placeholderTextColor="#666"
        keyboardType="decimal-pad"
        editable={!(activeInput === "buy" && !!buyAmount) && !calculating}
        className="mb-3 rounded-xl border border-white/15 px-3 py-2 text-white"
      />

      <TouchableOpacity
        onPress={flipCurrencies}
        className="mb-3 self-center rounded-full bg-white/10 p-2"
      >
        <IconSymbol name="arrow.up.arrow.down" size={20} color="#fff" />
      </TouchableOpacity>

      <Text className="mb-1 text-xs text-white/50">Buy ({decodeCurrency(buyCurrency)})</Text>
      <TextInput
        value={buyAmount}
        onChangeText={(t) => {
          setActiveInput("buy");
          setBuyAmount(t);
          setSellAmount("");
        }}
        placeholder="0.00"
        placeholderTextColor="#666"
        keyboardType="decimal-pad"
        editable={!(activeInput === "sell" && !!sellAmount) && !calculating}
        className="mb-3 rounded-xl border border-white/15 px-3 py-2 text-white"
      />

      <TouchableOpacity
        onPress={onSubmit}
        disabled={disabled || !canSwap || swapMut.isPending || calculating}
        className="items-center rounded-2xl bg-primary py-3"
      >
        {swapMut.isPending || calculating ? (
          <ActivityIndicator />
        ) : (
          <Text className="text-base font-semibold text-black">Swap</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
