import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import type { AmmInfo } from "@/src/api/amm";
import { useAddLiquidity } from "@/src/hooks/useAmm";
import { decodeCurrency } from "@/src/lib/formatters";
import { estimateDepositAmounts } from "@/src/lib/estimateDepositAmount";
import { AmmSlippageControl } from "./AmmSlippageControl";

type DepositUiMode = "quantity" | "lp";
type PayWith = "both" | string;

interface Props {
  ammInfo: AmmInfo;
  walletAddress: string;
  disabled?: boolean;
}

export function AmmDepositPanel({ ammInfo, walletAddress, disabled }: Props) {
  const addMut = useAddLiquidity();
  const [uiMode, setUiMode] = useState<DepositUiMode>("quantity");
  const [v1, setV1] = useState("");
  const [v2, setV2] = useState("");
  const [lpDesired, setLpDesired] = useState("");
  const [payWith, setPayWith] = useState<PayWith>("both");
  const [slippage, setSlippage] = useState(0);

  const c1 = decodeCurrency(ammInfo.formattedAmount1.currency);
  const c2 = decodeCurrency(ammInfo.formattedAmount2.currency);

  const estimates = useMemo(() => {
    const lp = Number(lpDesired);
    if (!lp || lp <= 0) return null;
    return estimateDepositAmounts(ammInfo, lp, payWith, slippage);
  }, [ammInfo, lpDesired, payWith, slippage]);

  const onSubmit = async () => {
    if (!walletAddress) return;
    try {
      if (uiMode === "quantity") {
        if (v1 && v2) {
          await addMut.mutateAsync({
            account: ammInfo.account,
            body: {
              depositType: "twoAsset",
              walletAddress,
              addValue1: v1,
              addValue2: v2,
            },
          });
        } else if (v1) {
          await addMut.mutateAsync({
            account: ammInfo.account,
            body: {
              depositType: "oneAsset",
              walletAddress,
              addValue1: v1,
              selectedCurrency: ammInfo.formattedAmount1.currency,
            },
          });
        } else if (v2) {
          await addMut.mutateAsync({
            account: ammInfo.account,
            body: {
              depositType: "oneAsset",
              walletAddress,
              addValue1: v2,
              selectedCurrency: ammInfo.formattedAmount2.currency,
            },
          });
        } else {
          Alert.alert("Deposit", "Enter at least one amount greater than zero.");
          return;
        }
        setV1("");
        setV2("");
      } else {
        const lp = lpDesired.trim();
        if (!lp) {
          Alert.alert("Deposit", "Enter desired LP token amount.");
          return;
        }
        if (payWith === "both") {
          if (!estimates?.amount1?.value || !estimates.amount2?.value) {
            Alert.alert("Deposit", "Could not estimate deposit amounts.");
            return;
          }
          await addMut.mutateAsync({
            account: ammInfo.account,
            body: {
              depositType: "twoAssetLPToken",
              walletAddress,
              addValue1: estimates.amount1.value,
              addValue2: estimates.amount2.value,
              lpTokenValue: lp,
            },
          });
        } else {
          const one = estimates?.maxSingleAmount;
          if (!one?.value) {
            Alert.alert("Deposit", "Could not estimate single-asset deposit.");
            return;
          }
          await addMut.mutateAsync({
            account: ammInfo.account,
            body: {
              depositType: "oneAssetLPToken",
              walletAddress,
              addValue1: one.value,
              selectedCurrency: payWith,
              lpTokenValue: lp,
            },
          });
        }
        setLpDesired("");
      }
      Alert.alert("Liquidity added");
    } catch (err) {
      Alert.alert("Deposit failed", (err as Error).message);
    }
  };

  return (
    <View className="rounded-2xl border border-white/10 p-5">
      <View className="mb-3 flex-row rounded-full border border-white/10 p-1">
        {(["quantity", "lp"] as DepositUiMode[]).map((m) => (
          <TouchableOpacity
            key={m}
            onPress={() => setUiMode(m)}
            className={`flex-1 items-center rounded-full py-2 ${uiMode === m ? "bg-primary" : ""}`}
          >
            <Text className={`text-xs ${uiMode === m ? "text-black" : "text-white/70"}`}>
              {m === "quantity" ? "Quantity" : "LP Token"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {uiMode === "lp" ? <AmmSlippageControl slippage={slippage} onChange={setSlippage} /> : null}

      {uiMode === "quantity" ? (
        <>
          <TextInput
            value={v1}
            onChangeText={setV1}
            placeholder={`${c1} amount`}
            placeholderTextColor="#666"
            keyboardType="decimal-pad"
            className="mb-3 rounded-xl border border-white/15 px-3 py-2 text-white"
          />
          <TextInput
            value={v2}
            onChangeText={setV2}
            placeholder={`${c2} amount`}
            placeholderTextColor="#666"
            keyboardType="decimal-pad"
            className="mb-3 rounded-xl border border-white/15 px-3 py-2 text-white"
          />
          <Text className="mb-3 text-xs text-white/50">
            Enter both amounts for two-asset deposit, or one amount for single-asset deposit.
          </Text>
        </>
      ) : (
        <>
          <TextInput
            value={lpDesired}
            onChangeText={setLpDesired}
            placeholder="Desired LP tokens"
            placeholderTextColor="#666"
            keyboardType="decimal-pad"
            className="mb-3 rounded-xl border border-white/15 px-3 py-2 text-white"
          />
          {estimates && lpDesired ? (
            <Text className="mb-3 text-xs text-white/50">
              {payWith === "both"
                ? `Est. cost: ${estimates.amount1?.value} ${c1} + ${estimates.amount2?.value} ${c2}`
                : `Est. cost: ${estimates.singleAmount?.value} ${payWith} · Max (${slippage}% slip): ${estimates.maxSingleAmount?.value}`}
            </Text>
          ) : null}
          <Text className="mb-2 text-xs uppercase tracking-wider text-white/50">Pay with</Text>
          <View className="mb-3 flex-row flex-wrap gap-2">
            {(["both", ammInfo.formattedAmount1.currency, ammInfo.formattedAmount2.currency] as PayWith[]).map(
              (opt) => (
                <TouchableOpacity
                  key={String(opt)}
                  onPress={() => setPayWith(opt)}
                  className={`rounded-full px-3 py-1 ${payWith === opt ? "bg-primary" : "bg-white/10"}`}
                >
                  <Text className={`text-xs ${payWith === opt ? "text-black" : "text-white/80"}`}>
                    {opt === "both" ? "Both" : decodeCurrency(String(opt))}
                  </Text>
                </TouchableOpacity>
              ),
            )}
          </View>
        </>
      )}

      <TouchableOpacity
        onPress={onSubmit}
        disabled={disabled || addMut.isPending}
        className="items-center rounded-2xl bg-primary py-3"
      >
        {addMut.isPending ? (
          <ActivityIndicator />
        ) : (
          <Text className="text-base font-semibold text-black">Add liquidity</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
