import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useWallets } from "@/src/hooks/useWallets";
import { useAccountTransactions } from "@/src/hooks/useTransactions";
import { TransactionRow } from "@/src/features/shared/TransactionRow";
import { shortAddress } from "@/src/lib/formatters";
import { useAuthStore } from "@/src/stores/auth";
import type { WalletSummary } from "@/src/api/wallets";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

const ADMIN_WALLET_ORDER: Record<string, number> = { issuer: 0, treasury: 1, pathfind: 2 };

function sortAdminWallets(wallets: WalletSummary[]) {
  return [...wallets].sort(
    (a, b) =>
      (ADMIN_WALLET_ORDER[a.wallet_type] ?? 99) - (ADMIN_WALLET_ORDER[b.wallet_type] ?? 99),
  );
}

export default function TransactionsScreen() {
  const isAdmin = useAuthStore((s) => s.profile?.role) === "ADMIN";
  const wallets = useWallets();
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [showWalletDropdown, setShowWalletDropdown] = useState(false);

  const selectableWallets = useMemo(() => {
    const data = wallets.data ?? [];
    if (isAdmin) {
      return sortAdminWallets(
        data.filter(
          (w) =>
            w.wallet_type === "issuer" ||
            w.wallet_type === "treasury" ||
            w.wallet_type === "pathfind",
        ),
      );
    }
    const userWallet = data.find((w) => w.wallet_type === "user");
    return userWallet ? [userWallet] : data.slice(0, 1);
  }, [wallets.data, isAdmin]);

  useEffect(() => {
    if (selectableWallets.length === 0) {
      setSelectedAddress(null);
      return;
    }
    const stillValid = selectableWallets.some((w) => w.classic_address === selectedAddress);
    if (!selectedAddress || !stillValid) {
      setSelectedAddress(selectableWallets[0].classic_address);
    }
  }, [selectableWallets, selectedAddress]);

  const selectedWallet =
    selectableWallets.find((w) => w.classic_address === selectedAddress) ?? selectableWallets[0];
  const address = selectedWallet?.classic_address;
  const txs = useAccountTransactions(address);
  const showDropdown = isAdmin && selectableWallets.length > 1;

  const onWalletChange = (wallet: WalletSummary) => {
    setSelectedAddress(wallet.classic_address);
    setShowWalletDropdown(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="border-b border-white/10 px-6 py-5">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-2xl font-bold text-white">Transaction History</Text>

            {showDropdown ? (
              <View className="relative mt-2">
                <TouchableOpacity
                  onPress={() => setShowWalletDropdown((open) => !open)}
                  className="flex-row items-center justify-between rounded-xl border border-white/15 bg-white/5 px-3 py-2"
                >
                  <Text className="text-sm font-semibold uppercase text-primary">
                    {selectedWallet?.wallet_type ?? "Wallet"}
                  </Text>
                  <MaterialIcons
                    name={showWalletDropdown ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                    size={20}
                    color="#9ca3af"
                  />
                </TouchableOpacity>

                {showWalletDropdown ? (
                  <View className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-white/15 bg-neutral-900">
                    {selectableWallets.map((wallet) => {
                      const isSelected = wallet.classic_address === selectedWallet?.classic_address;
                      return (
                        <TouchableOpacity
                          key={wallet.id}
                          onPress={() => onWalletChange(wallet)}
                          className={`px-3 py-2.5 ${isSelected ? "bg-white/10" : ""}`}
                        >
                          <Text
                            className={`text-sm font-semibold uppercase ${isSelected ? "text-primary" : "text-white/80"}`}
                          >
                            {wallet.wallet_type}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            ) : address ? (
              <Text className="mt-1 font-mono text-xs text-white/60">
                {shortAddress(address, 12, 8)}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={() => txs.refetch()}
            disabled={txs.isFetching}
            className="ml-3 rounded-full bg-primary/15 px-4 py-2"
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
