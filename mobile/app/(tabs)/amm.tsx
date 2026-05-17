import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAmms } from "@/src/hooks/useAmm";
import { decodeCurrency, shortAddress } from "@/src/lib/formatters";

export default function AmmListScreen() {
  const router = useRouter();
  const amms = useAmms();

  return (
    <SafeAreaView className="flex-1 bg-black">
      <ScrollView contentContainerClassName="px-6 py-6">
        <Text className="mb-1 text-3xl font-bold text-white">AMM</Text>
        <Text className="mb-6 text-white/60">Liquidity pools on Testnet</Text>

        {amms.isLoading ? (
          <ActivityIndicator />
        ) : amms.data && amms.data.length > 0 ? (
          amms.data.map((a) => (
            <TouchableOpacity
              key={a.id}
              onPress={() => router.push(`/amm/${a.account}` as any)}
              className="mb-3 rounded-2xl border border-white/10 p-4"
            >
              <Text className="mb-1 text-base text-white">
                {decodeCurrency(a.currency1)} / {decodeCurrency(a.currency2)}
              </Text>
              <Text className="text-xs text-white/60">{shortAddress(a.account, 10, 6)}</Text>
            </TouchableOpacity>
          ))
        ) : (
          <View className="rounded-2xl border border-white/10 p-6">
            <Text className="text-white/60">
              No AMMs yet. An admin can create one from the Admin tab.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
