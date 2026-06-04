import { useState } from "react";
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import type { AmmInfo, WithdrawMode } from "@/src/api/amm";
import { useWithdrawLiquidity } from "@/src/hooks/useAmm";
import { decodeCurrency } from "@/src/lib/formatters";

const WITHDRAW_MODES: { value: WithdrawMode; label: string }[] = [
  { value: "twoAsset", label: "Two asset" },
  { value: "lpToken", label: "LP token" },
  { value: "all", label: "Withdraw all" },
  { value: "singleAsset", label: "Single asset" },
  { value: "singleAssetAll", label: "Single asset (all)" },
  { value: "singleAssetLp", label: "Single asset + LP" },
];

interface Props {
  ammInfo: AmmInfo;
  walletAddress: string;
  disabled?: boolean;
}

export function AmmWithdrawPanel({ ammInfo, walletAddress, disabled }: Props) {
  const withdrawMut = useWithdrawLiquidity();
  const [mode, setMode] = useState<WithdrawMode>("lpToken");
  const [v1, setV1] = useState("");
  const [v2, setV2] = useState("");
  const [lp, setLp] = useState("");
  const [singleCurrency, setSingleCurrency] = useState(ammInfo.formattedAmount1.currency);
  const [singleValue, setSingleValue] = useState("");

  const c1 = decodeCurrency(ammInfo.formattedAmount1.currency);
  const c2 = decodeCurrency(ammInfo.formattedAmount2.currency);

  const onSubmit = async () => {
    if (!walletAddress) return;
    try {
      let result: { poolDeleted: boolean };
      const base = { account: ammInfo.account };

      switch (mode) {
        case "twoAsset":
          if (!v1 || !v2) {
            Alert.alert("Withdraw", "Enter both asset amounts.");
            return;
          }
          result = await withdrawMut.mutateAsync({
            ...base,
            body: { mode, walletAddress, withdrawValue1: v1, withdrawValue2: v2 },
          });
          setV1("");
          setV2("");
          break;
        case "lpToken":
          if (!lp) {
            Alert.alert("Withdraw", "Enter LP token amount.");
            return;
          }
          result = await withdrawMut.mutateAsync({
            ...base,
            body: { mode, walletAddress, lpTokenValue: lp },
          });
          setLp("");
          break;
        case "all":
          result = await withdrawMut.mutateAsync({ ...base, body: { mode: "all", walletAddress } });
          break;
        case "singleAsset":
          if (!singleValue) {
            Alert.alert("Withdraw", "Enter withdraw amount.");
            return;
          }
          result = await withdrawMut.mutateAsync({
            ...base,
            body: {
              mode,
              walletAddress,
              singleWithdrawCurrency: singleCurrency,
              singleWithdrawValue: singleValue,
            },
          });
          setSingleValue("");
          break;
        case "singleAssetAll":
          result = await withdrawMut.mutateAsync({
            ...base,
            body: { mode, walletAddress, singleWithdrawCurrency: singleCurrency },
          });
          break;
        case "singleAssetLp":
          if (!lp) {
            Alert.alert("Withdraw", "Enter LP token amount.");
            return;
          }
          result = await withdrawMut.mutateAsync({
            ...base,
            body: {
              mode,
              walletAddress,
              singleWithdrawCurrency: singleCurrency,
              lpTokenValue: lp,
            },
          });
          setLp("");
          break;
      }

      if (result.poolDeleted) {
        Alert.alert(
          "Liquidity withdrawn",
          "Pool is empty and has been removed.",
          [{ text: "OK", onPress: () => router.back() }],
        );
      } else {
        Alert.alert("Liquidity withdrawn");
      }
    } catch (err) {
      Alert.alert("Withdraw failed", (err as Error).message);
    }
  };

  const needsSinglePicker = mode.includes("singleAsset");
  const needsLp = mode === "lpToken" || mode === "singleAssetLp";

  return (
    <View className="rounded-2xl border border-white/10 p-5">
      <Text className="mb-2 text-xs uppercase tracking-wider text-white/50">Withdraw mode</Text>
      <View className="mb-3 flex-row flex-wrap gap-2">
        {WITHDRAW_MODES.map((m) => (
          <TouchableOpacity
            key={m.value}
            onPress={() => setMode(m.value)}
            className={`rounded-full px-3 py-1 ${mode === m.value ? "bg-primary" : "bg-white/10"}`}
          >
            <Text className={`text-xs ${mode === m.value ? "text-black" : "text-white/80"}`}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {mode === "twoAsset" ? (
        <>
          <TextInput
            value={v1}
            onChangeText={setV1}
            placeholder={`Desired ${c1}`}
            placeholderTextColor="#666"
            keyboardType="decimal-pad"
            className="mb-3 rounded-xl border border-white/15 px-3 py-2 text-white"
          />
          <TextInput
            value={v2}
            onChangeText={setV2}
            placeholder={`Desired ${c2}`}
            placeholderTextColor="#666"
            keyboardType="decimal-pad"
            className="mb-3 rounded-xl border border-white/15 px-3 py-2 text-white"
          />
        </>
      ) : null}

      {needsSinglePicker ? (
        <View className="mb-3 flex-row gap-2">
          {[ammInfo.formattedAmount1.currency, ammInfo.formattedAmount2.currency].map((cur) => (
            <TouchableOpacity
              key={cur}
              onPress={() => setSingleCurrency(cur)}
              className={`rounded-full px-3 py-1 ${singleCurrency === cur ? "bg-primary" : "bg-white/10"}`}
            >
              <Text className={`text-xs ${singleCurrency === cur ? "text-black" : "text-white/80"}`}>
                {decodeCurrency(cur)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {mode === "singleAsset" ? (
        <TextInput
          value={singleValue}
          onChangeText={setSingleValue}
          placeholder="Withdraw amount"
          placeholderTextColor="#666"
          keyboardType="decimal-pad"
          className="mb-3 rounded-xl border border-white/15 px-3 py-2 text-white"
        />
      ) : null}

      {needsLp ? (
        <TextInput
          value={lp}
          onChangeText={setLp}
          placeholder="LP tokens to redeem"
          placeholderTextColor="#666"
          keyboardType="decimal-pad"
          className="mb-3 rounded-xl border border-white/15 px-3 py-2 text-white"
        />
      ) : null}

      <TouchableOpacity
        onPress={onSubmit}
        disabled={disabled || withdrawMut.isPending}
        className="items-center rounded-2xl bg-primary py-3"
      >
        {withdrawMut.isPending ? (
          <ActivityIndicator />
        ) : (
          <Text className="text-base font-semibold text-black">Withdraw</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
