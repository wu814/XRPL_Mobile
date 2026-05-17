import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams } from "expo-router";
import { decodeCurrency, shortAddress, xrpToDrops } from "@/src/lib/formatters";
import { useAmm, useAddLiquidity, useAmmSwap, useWithdrawLiquidity } from "@/src/hooks/useAmm";
import { useWallets } from "@/src/hooks/useWallets";

type Tab = "deposit" | "withdraw" | "swap";

export default function AmmDetailScreen() {
  const { account } = useLocalSearchParams<{ account: string }>();
  const amm = useAmm(account);
  const wallets = useWallets();
  const [tab, setTab] = useState<Tab>("deposit");
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const selectedWallet = walletAddress ?? wallets.data?.[0]?.classic_address ?? null;

  const addMut = useAddLiquidity();
  const withdrawMut = useWithdrawLiquidity();
  const swapMut = useAmmSwap();

  const [v1, setV1] = useState("");
  const [v2, setV2] = useState("");
  const [lp, setLp] = useState("");
  const [swapIn, setSwapIn] = useState("");
  const [swapOut, setSwapOut] = useState("");

  const onDeposit = async () => {
    if (!amm.data || !selectedWallet) return;
    try {
      await addMut.mutateAsync({
        account: amm.data.account,
        walletAddress: selectedWallet,
        amount1: { ...amm.data.formattedAmount1, value: v1 },
        amount2: { ...amm.data.formattedAmount2, value: v2 },
      });
      setV1("");
      setV2("");
      Alert.alert("Liquidity added");
    } catch (err) {
      Alert.alert("Deposit failed", (err as Error).message);
    }
  };

  const onWithdraw = async () => {
    if (!amm.data || !selectedWallet || !lp) return;
    try {
      await withdrawMut.mutateAsync({
        account: amm.data.account,
        walletAddress: selectedWallet,
        asset1: amm.data.formattedAmount1,
        asset2: amm.data.formattedAmount2,
        lpToken: { ...amm.data.lpToken, value: lp },
      });
      setLp("");
      Alert.alert("Liquidity withdrawn");
    } catch (err) {
      Alert.alert("Withdraw failed", (err as Error).message);
    }
  };

  const onSwap = async () => {
    if (!amm.data || !selectedWallet || !swapIn || !swapOut) return;
    try {
      await swapMut.mutateAsync({
        account: amm.data.account,
        walletAddress: selectedWallet,
        sendMax:
          amm.data.formattedAmount1.currency === "XRP"
            ? xrpToDrops(Number(swapIn))
            : { ...amm.data.formattedAmount1, value: swapIn },
        destinationAmount:
          amm.data.formattedAmount2.currency === "XRP"
            ? xrpToDrops(Number(swapOut))
            : { ...amm.data.formattedAmount2, value: swapOut },
      });
      setSwapIn("");
      setSwapOut("");
      Alert.alert("Swap submitted");
    } catch (err) {
      Alert.alert("Swap failed", (err as Error).message);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <Stack.Screen options={{ title: "Pool", headerStyle: { backgroundColor: "#000" }, headerTintColor: "#fff" }} />
      <ScrollView contentContainerClassName="px-6 py-6">
        {amm.isLoading || !amm.data ? (
          <ActivityIndicator />
        ) : (
          <>
            <Text className="mb-1 text-3xl font-bold text-white">
              {decodeCurrency(amm.data.formattedAmount1.currency)} / {decodeCurrency(amm.data.formattedAmount2.currency)}
            </Text>
            <Text className="mb-6 text-white/60">{shortAddress(amm.data.account, 12, 6)}</Text>

            <View className="mb-5 rounded-2xl border border-white/10 p-5">
              <Text className="mb-3 text-sm uppercase tracking-wider text-white/50">Pool</Text>
              <Text className="mb-1 text-white">
                {amm.data.formattedAmount1.value} {decodeCurrency(amm.data.formattedAmount1.currency)}
              </Text>
              <Text className="mb-1 text-white">
                {amm.data.formattedAmount2.value} {decodeCurrency(amm.data.formattedAmount2.currency)}
              </Text>
              <Text className="text-xs text-white/50">
                LP: {amm.data.lpToken.value} | Fee: {amm.data.tradingFee / 1000}%
              </Text>
            </View>

            <View className="mb-5 flex-row rounded-full border border-white/10 p-1">
              {(["deposit", "withdraw", "swap"] as Tab[]).map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setTab(t)}
                  className={`flex-1 items-center rounded-full py-2 ${tab === t ? "bg-primary" : ""}`}
                >
                  <Text className={`text-xs ${tab === t ? "text-black" : "text-white/70"}`}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="mb-2 text-xs uppercase tracking-wider text-white/50">Wallet</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              {(wallets.data ?? []).map((w) => {
                const isSel = selectedWallet === w.classic_address;
                return (
                  <TouchableOpacity
                    key={w.id}
                    onPress={() => setWalletAddress(w.classic_address)}
                    className={`mr-2 rounded-full px-3 py-2 ${isSel ? "bg-primary" : "border border-white/20"}`}
                  >
                    <Text className={`text-xs ${isSel ? "text-black" : "text-white"}`}>
                      {shortAddress(w.classic_address)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {tab === "deposit" && (
              <View className="rounded-2xl border border-white/10 p-5">
                <TextInput
                  value={v1}
                  onChangeText={setV1}
                  placeholder={`${decodeCurrency(amm.data.formattedAmount1.currency)} amount`}
                  placeholderTextColor="#666"
                  keyboardType="decimal-pad"
                  className="mb-3 rounded-xl border border-white/15 px-3 py-2 text-white"
                />
                <TextInput
                  value={v2}
                  onChangeText={setV2}
                  placeholder={`${decodeCurrency(amm.data.formattedAmount2.currency)} amount`}
                  placeholderTextColor="#666"
                  keyboardType="decimal-pad"
                  className="mb-3 rounded-xl border border-white/15 px-3 py-2 text-white"
                />
                <TouchableOpacity
                  onPress={onDeposit}
                  disabled={addMut.isPending}
                  className="items-center rounded-2xl bg-primary py-3"
                >
                  {addMut.isPending ? (
                    <ActivityIndicator />
                  ) : (
                    <Text className="text-base font-semibold text-black">Add liquidity</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {tab === "withdraw" && (
              <View className="rounded-2xl border border-white/10 p-5">
                <TextInput
                  value={lp}
                  onChangeText={setLp}
                  placeholder="LP tokens to redeem"
                  placeholderTextColor="#666"
                  keyboardType="decimal-pad"
                  className="mb-3 rounded-xl border border-white/15 px-3 py-2 text-white"
                />
                <TouchableOpacity
                  onPress={onWithdraw}
                  disabled={withdrawMut.isPending}
                  className="items-center rounded-2xl bg-primary py-3"
                >
                  {withdrawMut.isPending ? (
                    <ActivityIndicator />
                  ) : (
                    <Text className="text-base font-semibold text-black">Withdraw</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {tab === "swap" && (
              <View className="rounded-2xl border border-white/10 p-5">
                <TextInput
                  value={swapIn}
                  onChangeText={setSwapIn}
                  placeholder={`Send max ${decodeCurrency(amm.data.formattedAmount1.currency)}`}
                  placeholderTextColor="#666"
                  keyboardType="decimal-pad"
                  className="mb-3 rounded-xl border border-white/15 px-3 py-2 text-white"
                />
                <TextInput
                  value={swapOut}
                  onChangeText={setSwapOut}
                  placeholder={`Receive ${decodeCurrency(amm.data.formattedAmount2.currency)}`}
                  placeholderTextColor="#666"
                  keyboardType="decimal-pad"
                  className="mb-3 rounded-xl border border-white/15 px-3 py-2 text-white"
                />
                <TouchableOpacity
                  onPress={onSwap}
                  disabled={swapMut.isPending}
                  className="items-center rounded-2xl bg-primary py-3"
                >
                  {swapMut.isPending ? (
                    <ActivityIndicator />
                  ) : (
                    <Text className="text-base font-semibold text-black">Swap</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
