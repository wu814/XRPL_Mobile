import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation } from "@tanstack/react-query";
import { ammSwap, getAmmInfoByCurrencies, type AmmInfo } from "@/src/api/amm";
import { availableCurrencies } from "@/src/lib/currencyIcon";
import { CurrencyIconImage } from "@/src/components/CurrencyIconImage";
import { calculateEstimateOutput, calculateExactAMMInput } from "@/src/lib/ammCalculations";
import { formatBalance } from "@/src/lib/prices";
import { CurrencySelectorSheet } from "@/src/components/CurrencySelectorSheet";

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
    mutationFn: ammSwap,
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
      const sendMax = buildAmount(sellCurrency, sellAmt, ammInfo);
      const destinationAmount = buildAmount(buyCurrency, buyAmt, ammInfo);
      await swapMut.mutateAsync({
        account: ammInfo.account,
        walletAddress,
        sendMax,
        destinationAmount,
      });
      Alert.alert("Smart Trade executed");
      setSellAmount("");
      setBuyAmount("");
      onClose();
    } catch (err) {
      Alert.alert("Trade failed", (err as Error).message);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <SafeAreaView className="flex-1 bg-black">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
        >
          <View className="border-b border-white/10 px-6 py-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-xl font-bold text-white">Smart Trade / Payment</Text>
              <TouchableOpacity onPress={onClose}>
                <Text className="text-white/60">Close</Text>
              </TouchableOpacity>
            </View>
            <View className="mt-4 flex-row rounded-full bg-white/10 p-1">
              <View className="flex-1 items-center rounded-full bg-primary/20 py-2">
                <Text className="text-sm font-semibold text-primary">Convert</Text>
              </View>
            </View>
          </View>

          <ScrollView contentContainerClassName="px-6 py-5">
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
                  Balance: {formatBalance(balances[sellCurrency] ?? 0, 2)} {sellCurrency}
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
                <Text className="text-lg text-white">↕</Text>
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
          </ScrollView>
        </KeyboardAvoidingView>

        <CurrencySelectorSheet
          visible={pickerFor !== null}
          onClose={() => setPickerFor(null)}
          exclude={pickerFor === "sell" ? buyCurrency : sellCurrency}
          onSelect={(c) => {
            if (pickerFor === "sell") setSellCurrency(c);
            else if (pickerFor === "buy") setBuyCurrency(c);
            setPickerFor(null);
          }}
        />
      </SafeAreaView>
    </Modal>
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

function buildAmount(currency: string, amount: number, amm: AmmInfo): string | { currency: string; issuer: string; value: string } {
  if (currency === "XRP") {
    return Math.floor(amount * 1_000_000).toString();
  }
  const issuer =
    amm.formattedAmount1.currency === currency
      ? amm.formattedAmount1.issuer
      : amm.formattedAmount2.issuer;
  return {
    currency,
    issuer,
    value: amount.toString(),
  };
}
