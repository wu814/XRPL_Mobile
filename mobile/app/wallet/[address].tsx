import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams } from "expo-router";
import { useWalletInfo, useWalletLines } from "@/src/hooks/useWallets";
import { decodeCurrency, dropsToXrp, formatXrp, shortAddress } from "@/src/lib/formatters";

export default function WalletDetail() {
  const { address } = useLocalSearchParams<{ address: string }>();
  const info = useWalletInfo(address);
  const lines = useWalletLines(address);

  return (
    <SafeAreaView className="flex-1 bg-black">
      <Stack.Screen options={{ title: "Wallet", headerStyle: { backgroundColor: "#000" }, headerTintColor: "#fff" }} />
      <ScrollView contentContainerClassName="px-6 py-6">
        <Text className="mb-1 text-xs uppercase tracking-wider text-white/50">Address</Text>
        <Text className="mb-6 font-mono text-sm text-white">{shortAddress(address ?? "", 14, 8)}</Text>

        <View className="mb-6 rounded-2xl border border-white/10 p-5">
          <Text className="mb-1 text-sm uppercase tracking-wider text-white/50">Balance</Text>
          {info.isLoading ? (
            <ActivityIndicator />
          ) : info.error ? (
            <Text className="text-danger">{(info.error as Error).message}</Text>
          ) : (
            <Text className="text-2xl font-semibold text-white">
              {info.data?.Balance ? `${formatXrp(dropsToXrp(info.data.Balance))} XRP` : "-"}
            </Text>
          )}
        </View>

        <Text className="mb-3 text-lg font-semibold text-white">Trustlines</Text>
        {lines.isLoading ? (
          <ActivityIndicator />
        ) : lines.error ? (
          <Text className="text-danger">{(lines.error as Error).message}</Text>
        ) : lines.data && lines.data.length > 0 ? (
          lines.data.map((l: any, idx: number) => (
            <View key={idx} className="mb-3 rounded-2xl border border-white/10 p-4">
              <Text className="mb-1 text-base text-white">
                {decodeCurrency(l.currency)} - {l.balance}
              </Text>
              <Text className="text-xs text-white/50">Issuer: {shortAddress(l.account)}</Text>
            </View>
          ))
        ) : (
          <Text className="text-white/50">No trustlines</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
