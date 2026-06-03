import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCreateWallet, useWallets } from "@/src/hooks/useWallets";
import { useAllWalletAssets } from "@/src/hooks/useAllWalletAssets";
import { CreateAdminWalletCard } from "@/src/features/wallet/WalletSummaryCard";
import { WalletCardContainer } from "@/src/features/wallet/WalletCardContainer";
import { CreateAdminWalletModal } from "@/src/features/wallet/CreateAdminWalletModal";
import { AssetTable } from "@/src/features/shared/AssetTable";
import { SmartTradeSheet } from "@/src/features/payments/SmartTradeSheet";
import { SendSheet } from "@/src/features/payments/SendSheet";
import { formatUsd } from "@/src/lib/prices";
import type { WalletSummary } from "@/src/api/wallets";
import { StickyActions } from "./StickyActions";

export function AdminHome() {
  const wallets = useWallets();
  const createMutation = useCreateWallet();

  const sortedWallets = useMemo<WalletSummary[]>(() => {
    const data = wallets.data ?? [];
    const order: Record<string, number> = { issuer: 0, treasury: 1, pathfind: 2 };
    return [...data].sort(
      (a, b) => (order[a.wallet_type] ?? 99) - (order[b.wallet_type] ?? 99),
    );
  }, [wallets.data]);

  const addresses = useMemo(
    () => sortedWallets.map((w) => w.classic_address),
    [sortedWallets],
  );
  const aggregate = useAllWalletAssets(addresses);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSmartTrade, setShowSmartTrade] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [sendingFrom, setSendingFrom] = useState<WalletSummary | null>(null);

  const portfolioWallets = useMemo(
    () =>
      sortedWallets.filter(
        (w) =>
          w.wallet_type === "issuer" ||
          w.wallet_type === "treasury" ||
          w.wallet_type === "pathfind",
      ),
    [sortedWallets],
  );

  const assetsByWallet = useMemo(() => {
    const map = new Map<string, typeof aggregate.assets>();
    for (const wallet of portfolioWallets) {
      map.set(
        wallet.classic_address,
        aggregate.assets.filter((a) => a.walletAddress === wallet.classic_address),
      );
    }
    return map;
  }, [portfolioWallets, aggregate.assets]);

  const treasury = sortedWallets.find((w) => w.wallet_type === "treasury");
  const defaultSendWallet = sendingFrom ?? treasury ?? sortedWallets[0] ?? null;

  const onRefresh = async () => {
    await Promise.all([wallets.refetch(), aggregate.refetch()]);
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <ScrollView
        contentContainerClassName="px-6 pt-6 pb-32"
        refreshControl={
          <RefreshControl
            refreshing={wallets.isFetching || aggregate.isLoading}
            onRefresh={onRefresh}
            tintColor="#fff"
          />
        }
      >
        <Text className="text-base font-semibold text-white/70">Total Balance</Text>
        <Text className="mb-8 mt-1 text-5xl font-bold text-white">
          ${formatUsd(aggregate.totalUsd)}
        </Text>

        <Text className="mb-3 text-xl font-bold text-white">My Wallets</Text>
        {wallets.isLoading ? (
          <View className="items-center py-8">
            <ActivityIndicator color="#fff" />
          </View>
        ) : wallets.error ? (
          <Text className="text-danger">{(wallets.error as Error).message}</Text>
        ) : (
          <>
            {sortedWallets.map((w) => (
              <WalletCardContainer
                key={w.id}
                wallet={w}
                onTransfer={(wallet) => {
                  setSendingFrom(wallet);
                  setShowSend(true);
                }}
              />
            ))}
            <CreateAdminWalletCard
              onPress={() => setShowCreateModal(true)}
              isCreating={createMutation.isPending}
            />
          </>
        )}

        <Text className="mb-3 mt-8 text-xl font-bold text-white">Portfolio</Text>
        {portfolioWallets.length === 0 ? (
          <AssetTable assets={[]} loading={aggregate.isLoading} />
        ) : (
          portfolioWallets.map((wallet) => (
            <View key={wallet.id} className="mb-6">
              <AssetTable
                title={wallet.wallet_type.toUpperCase()}
                assets={assetsByWallet.get(wallet.classic_address) ?? []}
                loading={aggregate.isLoading}
              />
            </View>
          ))
        )}
      </ScrollView>

      <StickyActions
        canAct={!!defaultSendWallet}
        onSmartTrade={() => setShowSmartTrade(true)}
        onSend={() => {
          setSendingFrom(null);
          setShowSend(true);
        }}
      />

      <CreateAdminWalletModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        isCreating={createMutation.isPending}
        onCreate={async (type) => {
          await createMutation.mutateAsync(type);
        }}
      />

      <SmartTradeSheet
        visible={showSmartTrade}
        onClose={() => setShowSmartTrade(false)}
        walletAddress={defaultSendWallet?.classic_address ?? null}
        balances={aggregate.balanceByCurrency}
      />
      <SendSheet
        visible={showSend}
        onClose={() => {
          setShowSend(false);
          setSendingFrom(null);
        }}
        walletAddress={defaultSendWallet?.classic_address ?? null}
      />
    </SafeAreaView>
  );
}
