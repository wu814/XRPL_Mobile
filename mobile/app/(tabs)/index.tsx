import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "@/src/stores/auth";
import { useCreateWallet, useDeleteWallet, useWallets } from "@/src/hooks/useWallets";
import { WalletCard } from "@/src/components/WalletCard";

export default function HomeScreen() {
  const profile = useAuthStore((s) => s.profile);
  const wallets = useWallets();
  const createMutation = useCreateWallet();
  const deleteMutation = useDeleteWallet();

  const onCreate = async () => {
    try {
      await createMutation.mutateAsync();
    } catch (err) {
      Alert.alert("Create wallet failed", (err as Error).message);
    }
  };

  const onDelete = async (address: string) => {
    try {
      await deleteMutation.mutateAsync(address);
    } catch (err) {
      Alert.alert("Remove wallet failed", (err as Error).message);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <ScrollView contentContainerClassName="px-6 py-6">
        <Text className="mb-1 text-3xl font-bold text-white">
          {profile?.username ? `Hi, ${profile.username}` : "Welcome"}
        </Text>
        <Text className="mb-6 text-white/60">XRPL Testnet custodial demo</Text>

        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-lg font-semibold text-white">Wallets</Text>
          <TouchableOpacity
            onPress={onCreate}
            disabled={createMutation.isPending}
            className="rounded-full bg-primary px-4 py-2"
          >
            {createMutation.isPending ? (
              <ActivityIndicator />
            ) : (
              <Text className="text-sm font-semibold text-black">+ New wallet</Text>
            )}
          </TouchableOpacity>
        </View>

        {wallets.isLoading ? (
          <View className="items-center py-8">
            <ActivityIndicator />
          </View>
        ) : wallets.error ? (
          <Text className="text-danger">{(wallets.error as Error).message}</Text>
        ) : wallets.data && wallets.data.length > 0 ? (
          wallets.data.map((w) => (
            <WalletCard key={w.id} wallet={w} onDelete={onDelete} />
          ))
        ) : (
          <View className="items-center rounded-2xl border border-white/10 p-8">
            <Text className="mb-2 text-base text-white/80">No wallets yet</Text>
            <Text className="text-center text-sm text-white/50">
              Create one - it's funded automatically by the XRPL Testnet faucet.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
