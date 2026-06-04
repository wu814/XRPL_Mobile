import { useMemo, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { AppScrollView } from "@/src/components/ui/AppScrollView";
import { Screen } from "@/src/components/ui/Screen";
import { Stack, useLocalSearchParams } from "expo-router";
import { decodeCurrency } from "@/src/lib/formatters";
import { AmmCompositionBar } from "@/src/features/amm/AmmCompositionBar";
import { AmmDepositPanel } from "@/src/features/amm/AmmDepositPanel";
import { AmmWithdrawPanel } from "@/src/features/amm/AmmWithdrawPanel";
import { AmmSwapPanel } from "@/src/features/amm/AmmSwapPanel";
import { useAmm } from "@/src/hooks/useAmm";
import { useWallets } from "@/src/hooks/useWallets";
import { missingAmmWalletMessage, resolveAmmWallet } from "@/src/lib/featureWallet";
import { useAuthStore } from "@/src/stores/auth";

type Tab = "deposit" | "withdraw" | "swap";

export default function AmmDetailScreen() {
  const { account } = useLocalSearchParams<{ account: string }>();
  const amm = useAmm(account);
  const isAdmin = useAuthStore((s) => s.profile?.role) === "ADMIN";
  const wallets = useWallets();
  const [tab, setTab] = useState<Tab>("deposit");

  const ammWallet = useMemo(
    () => resolveAmmWallet(wallets.data, isAdmin),
    [wallets.data, isAdmin],
  );
  const ammWalletAddress = ammWallet.address;
  const panelDisabled = !ammWalletAddress;

  return (
    <Screen>
      <Stack.Screen options={{ title: "Pool", headerStyle: { backgroundColor: "#000" }, headerTintColor: "#fff" }} />
      <AppScrollView contentContainerClassName="px-6 py-6">
        {amm.isLoading || !amm.data ? (
          <ActivityIndicator />
        ) : (
          <>
            <Text className="mb-1 text-3xl font-bold text-white">
              {decodeCurrency(amm.data.formattedAmount1.currency)} /{" "}
              {decodeCurrency(amm.data.formattedAmount2.currency)}
            </Text>
            <Text className="mb-6 font-mono text-xs text-white/60">{amm.data.account}</Text>

            <View className="mb-5 rounded-2xl border border-white/10 p-5">
              <Text className="mb-1 text-sm uppercase tracking-wider text-white/50">Pool composition</Text>
              <AmmCompositionBar
                amount1={amm.data.formattedAmount1}
                amount2={amm.data.formattedAmount2}
              />
              <Text className="mt-3 text-xs text-white/50">
                LP: {amm.data.lpToken.value} · Fee: {(amm.data.tradingFee / 1000).toFixed(3)}%
              </Text>
            </View>

            <View className="mb-5 flex-row rounded-full border border-white/10 p-1">
              {(["deposit", "withdraw", "swap"] as Tab[]).map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setTab(t)}
                  className={`flex-1 items-center rounded-full py-2 ${tab === t ? "bg-primary" : ""}`}
                >
                  <Text className={`text-xs capitalize ${tab === t ? "text-black" : "text-white/70"}`}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {!ammWalletAddress && !wallets.isLoading ? (
              <View className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
                <Text className="text-xs text-amber-200">{missingAmmWalletMessage(isAdmin)}</Text>
              </View>
            ) : null}

            {isAdmin && ammWalletAddress && ammWallet.wallet ? (
              <>
                <Text className="mb-2 text-xs uppercase tracking-wider text-white/50">Wallet</Text>
                <View className="mb-4 self-start rounded-full bg-primary px-4 py-2">
                  <Text className="text-xs font-semibold uppercase text-black">
                    {ammWallet.wallet.wallet_type}
                  </Text>
                </View>
              </>
            ) : null}

            {tab === "deposit" && (
              <AmmDepositPanel
                ammInfo={amm.data}
                walletAddress={ammWalletAddress ?? ""}
                disabled={panelDisabled}
              />
            )}
            {tab === "withdraw" && (
              <AmmWithdrawPanel
                ammInfo={amm.data}
                walletAddress={ammWalletAddress ?? ""}
                disabled={panelDisabled}
              />
            )}
            {tab === "swap" && (
              <AmmSwapPanel
                ammInfo={amm.data}
                walletAddress={ammWalletAddress ?? ""}
                disabled={panelDisabled}
              />
            )}
          </>
        )}
      </AppScrollView>
    </Screen>
  );
}
