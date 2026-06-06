import { ActivityIndicator, Text, View } from "react-native";
import { AppScrollView } from "@/src/components/ui/AppScrollView";
import { Screen } from "@/src/components/ui/Screen";
import { Stack, useLocalSearchParams } from "expo-router";
import { useWalletInfo, useWalletLines } from "@/src/hooks/useWallets";
import { dropsToXrp } from "@/src/lib/formatters";
import { formatBalanceForCurrency } from "@/src/lib/prices";
import { TrustlineRowCard } from "@/src/features/wallet/TrustlineRowCard";
import type { TrustlineRow } from "@/src/lib/walletAssets";

export default function WalletDetail() {
  const { address } = useLocalSearchParams<{ address: string }>();
  const info = useWalletInfo(address);
  const lines = useWalletLines(address);

  return (
    <Screen>
      <Stack.Screen options={{ title: "Wallet", headerStyle: { backgroundColor: "#000" }, headerTintColor: "#fff" }} />
      <AppScrollView contentContainerClassName="px-6 py-6">
        <Text className="mb-1 text-xs uppercase tracking-wider text-white/50">Address</Text>
        <Text className="mb-6 font-mono text-sm text-white">{address ?? ""}</Text>

        <View className="mb-6 rounded-2xl border border-white/10 p-5">
          <Text className="mb-1 text-sm uppercase tracking-wider text-white/50">Balance</Text>
          {info.isLoading ? (
            <ActivityIndicator />
          ) : info.error ? (
            <Text className="text-danger">{(info.error as Error).message}</Text>
          ) : (
            <Text className="text-2xl font-semibold text-white">
              {info.data?.Balance
                ? `${formatBalanceForCurrency(dropsToXrp(info.data.Balance), "XRP")} XRP`
                : "-"}
            </Text>
          )}
        </View>

        <Text className="mb-3 text-lg font-semibold text-white">Trustlines</Text>
        {lines.isLoading ? (
          <ActivityIndicator />
        ) : lines.error ? (
          <Text className="text-danger">{(lines.error as Error).message}</Text>
        ) : lines.data && lines.data.length > 0 ? (
          lines.data.map((l: TrustlineRow, idx: number) => (
            <TrustlineRowCard key={`${l.currency}-${l.account}-${idx}`} line={l} />
          ))
        ) : (
          <Text className="text-white/50">No trustlines</Text>
        )}
      </AppScrollView>
    </Screen>
  );
}
