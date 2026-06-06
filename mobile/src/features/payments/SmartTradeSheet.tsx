import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useMutation } from "@tanstack/react-query";
import { ammSwap, getAmmInfoByCurrencies, type AmmInfo } from "@/src/api/amm";
import { poolIssuerAddress } from "@/src/lib/estimateDepositAmount";
import { availableCurrencies } from "@/src/lib/currencyIcon";
import { AppSheet } from "@/src/components/ui/AppSheet";
import { IconSymbol } from "@/src/components/ui/icon-symbol";
import { CurrencyIconImage } from "@/src/features/shared/CurrencyIconImage";
import { calculateEstimateOutput, calculateExactAMMInput } from "@/src/lib/ammCalculations";
import { formatBalanceForCurrency } from "@/src/lib/prices";
import { CurrencySelectorList } from "@/src/features/payments/CurrencySelectorSheet";

interface SmartTradeSheetProps {
  visible: boolean;
  onClose: () => void;
  walletAddress: string | null;
  balances: Record<string, number>;
}

type ActiveInput = "sell" | "buy";

export function SmartTradeSheet({
  visible,
  onClose,
  walletAddress,
  balances,
}: SmartTradeSheetProps) {
  const [sellCurrency, setSellCurrency] = useState("USD");
  const [buyCurrency, setBuyCurrency] = useState("XRP");
  const [sellAmount, setSellAmount] = useState<string>("");
  const [buyAmount, setBuyAmount] = useState<string>("");
  const [activeInput, setActiveInput] = useState<ActiveInput>("sell");
  const [slippage] = useState(0);

  const [ammInfo, setAmmInfo] = useState<AmmInfo | null>(null);
  const [loadingAmm, setLoadingAmm] = useState(false);
  const [ammError, setAmmError] = useState<string | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);

  const [pickerFor, setPickerFor] = useState<"sell" | "buy" | null>(null);

  useEffect(() => {
    if (!visible) setPickerFor(null);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    if (sellCurrency === buyCurrency) {
      setAmmInfo(null);
      setAmmError(null);
      return;
    }
    let cancelled = false;
    setLoadingAmm(true);
    setAmmError(null);
    setAmmInfo(null);
    getAmmInfoByCurrencies({ sellCurrency, buyCurrency })
      .then((data) => {
        if (!cancelled) setAmmInfo(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setAmmError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingAmm(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, sellCurrency, buyCurrency]);

  useEffect(() => {
    if (!ammInfo) {
      if (activeInput === "sell") setBuyAmount("");
      else setSellAmount("");
      return;
    }
    setCalcError(null);

    const poolPair = getPoolPair(ammInfo, sellCurrency);
    if (!poolPair) {
      setCalcError("Currency not in pool");
      return;
    }
    const { poolIn, poolOut } = poolPair;
    const fee = (ammInfo.tradingFee || 0) / 100000;

    if (activeInput === "sell") {
      const n = Number(sellAmount);
      if (!Number.isFinite(n) || n <= 0) {
        setBuyAmount("");
        return;
      }
      const r = calculateEstimateOutput(poolIn, poolOut, n, fee);
      if (r.success && r.estimatedOutput !== undefined) {
        setBuyAmount(r.estimatedOutput.toFixed(6));
      } else {
        setCalcError(r.error || "Calculation failed");
        setBuyAmount("");
      }
    } else {
      const n = Number(buyAmount);
      if (!Number.isFinite(n) || n <= 0) {
        setSellAmount("");
        return;
      }
      const r = calculateExactAMMInput(poolIn, poolOut, n, slippage / 100, fee);
      if (r.success && r.inputWithSlippage !== undefined) {
        setSellAmount(r.inputWithSlippage.toFixed(6));
      } else {
        setCalcError(r.error || "Calculation failed");
        setSellAmount("");
      }
    }
  }, [sellAmount, buyAmount, activeInput, ammInfo, sellCurrency, slippage]);

  const swapMut = useMutation({
    mutationFn: ({
      account,
      body,
    }: {
      account: string;
      body: Parameters<typeof ammSwap>[1];
    }) => ammSwap(account, body),
  });

  const onMax = useCallback(() => {
    const b = balances[sellCurrency] ?? 0;
    setActiveInput("sell");
    setSellAmount(b.toFixed(2));
  }, [balances, sellCurrency]);

  const onSwap = () => {
    const tmp = sellCurrency;
    setSellCurrency(buyCurrency);
    setBuyCurrency(tmp);
    setSellAmount(buyAmount);
    setBuyAmount(sellAmount);
    setActiveInput("sell");
  };

  const canTrade =
    !!walletAddress &&
    !!ammInfo &&
    sellCurrency !== buyCurrency &&
    (Number(sellAmount) > 0 || Number(buyAmount) > 0);

  const onExecute = async () => {
    if (!walletAddress || !ammInfo) return;
    const sellAmt = Number(sellAmount);
    const buyAmt = Number(buyAmount);
    if (!Number.isFinite(sellAmt) || !Number.isFinite(buyAmt) || sellAmt <= 0 || buyAmt <= 0) {
      Alert.alert("Invalid amount", "Enter an amount to trade.");
      return;
    }
    try {
      const issuer = poolIssuerAddress(ammInfo);
      if (!issuer) {
        Alert.alert("Trade failed", "Could not determine issuer for this pool.");
        return;
      }
      const paymentType = activeInput === "sell" ? "exact_input" : "exact_output";
      await swapMut.mutateAsync({
        account: ammInfo.account,
        body: {
          walletAddress,
          sendCurrency: sellCurrency,
          receiveCurrency: buyCurrency,
          issuerAddress: issuer,
          paymentType,
          sendAmount: sellAmt,
          exactOutputAmount: paymentType === "exact_output" ? buyAmt : undefined,
          slippagePercent: slippage,
        },
      });
      Alert.alert("Smart Trade executed");
      setSellAmount("");
      setBuyAmount("");
      onClose();
    } catch (err) {
      Alert.alert("Trade failed", (err as Error).message);
    }
  };

  const pickerOpen = pickerFor !== null;
  const dismissPicker = () => setPickerFor(null);
  const pickerExclude = pickerFor === "sell" ? buyCurrency : sellCurrency;
  const pickerSelected = pickerFor === "sell" ? sellCurrency : buyCurrency;

  const onPickerSelect = (c: string) => {
    if (pickerFor === "sell") setSellCurrency(c);
    else if (pickerFor === "buy") setBuyCurrency(c);
    setPickerFor(null);
  };

  return (
    <AppSheet
      visible={visible}
      onClose={pickerOpen ? dismissPicker : onClose}
      title={pickerOpen ? "Select Currency" : "Smart Trade / Payment"}
      keyboardAvoiding={!pickerOpen}
      headerExtra={
        pickerOpen ? undefined : (
          <View className="mt-4 flex-row rounded-full bg-white/10 p-1">
            <View className="flex-1 items-center rounded-full bg-primary/20 py-2">
              <Text className="text-sm font-semibold text-primary">Convert</Text>
            </View>
          </View>
        )
      }
    >
      {pickerOpen ? (
        <CurrencySelectorList
          onSelect={onPickerSelect}
          exclude={pickerExclude}
          selected={pickerSelected}
        />
      ) : (
        <>
            {loadingAmm ? (
              <View className="mb-4 flex-row items-center rounded-full border border-blue-500/40 bg-blue-900/20 px-3 py-2">
                <ActivityIndicator color="#60a5fa" />
                <Text className="ml-2 text-sm text-blue-400">Loading AMM pool data…</Text>
              </View>
            ) : null}

            {ammError ? (
              <View className="mb-4 rounded-full border border-red-500/40 bg-red-900/20 px-3 py-2">
                <Text className="text-sm text-red-400">{ammError}</Text>
              </View>
            ) : null}

            {ammInfo && !loadingAmm ? (
              <View className="mb-4 rounded-full border border-green-500/40 bg-green-900/20 px-3 py-2">
                <Text className="text-sm text-green-400">
                  AMM Pool: {ammInfo.formattedAmount1.currency}/{ammInfo.formattedAmount2.currency} ({(ammInfo.tradingFee / 1000).toFixed(3)}% fee)
                </Text>
              </View>
            ) : null}

            {calcError ? (
              <View className="mb-4 rounded-full border border-red-500/40 bg-red-900/20 px-3 py-2">
                <Text className="text-sm text-red-400">Calc: {calcError}</Text>
              </View>
            ) : null}

            <View className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <Text className="mb-2 text-xs text-white/60">Sell</Text>
              <View className="flex-row items-center justify-between">
                <CurrencyButton currency={sellCurrency} onPress={() => setPickerFor("sell")} />
                <TextInput
                  value={sellAmount}
                  onChangeText={(t) => {
                    setActiveInput("sell");
                    setSellAmount(t);
                  }}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="#666"
                  className="flex-1 text-right text-3xl font-light text-white"
                />
              </View>
              <View className="mt-2 flex-row items-center justify-between">
                <Text className="text-xs text-white/60">
                  Balance: {formatBalanceForCurrency(balances[sellCurrency] ?? 0, sellCurrency)}{" "}
                  {sellCurrency}
                </Text>
                <TouchableOpacity
                  onPress={onMax}
                  className="rounded-full bg-primary/15 px-3 py-1"
                >
                  <Text className="text-xs font-semibold text-primary">Max</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View className="-my-3 z-10 items-center">
              <TouchableOpacity
                onPress={onSwap}
                className="h-12 w-12 items-center justify-center rounded-full border-2 border-black bg-white/15"
              >
                <IconSymbol name="arrow.up.arrow.down" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <View className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <Text className="mb-2 text-xs text-white/60">Buy</Text>
              <View className="flex-row items-center justify-between">
                <CurrencyButton currency={buyCurrency} onPress={() => setPickerFor("buy")} />
                <TextInput
                  value={buyAmount}
                  onChangeText={(t) => {
                    setActiveInput("buy");
                    setBuyAmount(t);
                  }}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="#666"
                  className="flex-1 text-right text-3xl font-light text-white"
                />
              </View>
            </View>

            <TouchableOpacity
              onPress={onExecute}
              disabled={!canTrade || swapMut.isPending}
              className={`mt-6 items-center rounded-2xl py-4 ${canTrade ? "bg-primary" : "bg-white/15"}`}
            >
              {swapMut.isPending ? (
                <ActivityIndicator />
              ) : (
                <Text className={`text-base font-semibold ${canTrade ? "text-black" : "text-white/40"}`}>
                  Execute Smart Trade
                </Text>
              )}
            </TouchableOpacity>
        </>
      )}
    </AppSheet>
  );
}

function CurrencyButton({
  currency,
  onPress,
}: {
  currency: string;
  onPress: () => void;
}) {
  const meta = availableCurrencies.find((c) => c.id === currency);
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center rounded-full bg-white/10 px-3 py-2"
    >
      <CurrencyIconImage currency={currency} size={24} />
      <Text className="ml-2 mr-1 text-base font-semibold text-white">{meta?.id ?? currency}</Text>
      <Text className="text-white/60">▾</Text>
    </TouchableOpacity>
  );
}

function getPoolPair(amm: AmmInfo, sellCurrency: string): { poolIn: number; poolOut: number } | null {
  const a1 = amm.formattedAmount1;
  const a2 = amm.formattedAmount2;
  if (a1.currency === sellCurrency) {
    return { poolIn: parseFloat(a1.value), poolOut: parseFloat(a2.value) };
  }
  if (a2.currency === sellCurrency) {
    return { poolIn: parseFloat(a2.value), poolOut: parseFloat(a1.value) };
  }
  return null;
}
