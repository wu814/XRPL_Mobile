import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useWallets } from "@/src/hooks/useWallets";
import { useAccountTransactions } from "@/src/hooks/useTransactions";
import { TransactionRow } from "@/src/components/TransactionRow";
import { shortAddress } from "@/src/lib/formatters";

export default function TransactionsScreen() {
  const wallets = useWallets();
  const primary = wallets.data?.[0];
  const address = primary?.classic_address;
  const txs = useAccountTransactions(address);

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="border-b border-white/10 px-6 py-5">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-2xl font-bold text-white">Transaction History</Text>
            {address ? (
              <Text className="mt-1 font-mono text-xs text-white/60">{shortAddress(address, 12, 8)}</Text>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={() => txs.refetch()}
            disabled={txs.isFetching}
            className="rounded-full bg-primary/15 px-4 py-2"
          >
            <Text className="text-sm font-semibold text-primary">
              {txs.isFetching ? "Refreshing…" : "Refresh"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerClassName="pb-12"
        refreshControl={
          <RefreshControl
            refreshing={txs.isFetching}
            onRefresh={() => txs.refetch()}
            tintColor="#fff"
          />
        }
      >
        {!address ? (
          <View className="items-center px-6 py-16">
            <Text className="mb-2 text-base text-white/80">No wallet found</Text>
            <Text className="text-center text-sm text-white/50">
              Create a wallet on the Home tab to view your transactions.
            </Text>
          </View>
        ) : txs.isLoading ? (
          <View className="items-center py-16">
            <ActivityIndicator color="#fff" />
          </View>
        ) : txs.error ? (
          <View className="items-center px-6 py-16">
            <Text className="text-danger">{(txs.error as Error).message}</Text>
          </View>
        ) : txs.data && txs.data.transactions.length > 0 ? (
          txs.data.transactions.map((tx, idx) => (
            <TransactionRow key={`${tx.hash}-${idx}`} tx={tx} />
          ))
        ) : (
          <View className="items-center px-6 py-16">
            <Text className="text-base text-white/60">No transactions yet</Text>
            <Text className="mt-2 text-center text-sm text-white/40">
              Your transaction history will appear here once you start using your wallet.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
