import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { AppScrollView } from "@/src/components/ui/AppScrollView";
import { Screen } from "@/src/components/ui/Screen";
import { useCreateWallet, useWallets } from "@/src/hooks/useWallets";
import { useWalletAssets } from "@/src/hooks/useWalletAssets";
import {
  NoWalletCard,
  WalletSummaryCard,
} from "@/src/features/wallet/WalletSummaryCard";
import { AssetTable } from "@/src/features/shared/AssetTable";
import { SmartTradeSheet } from "@/src/features/payments/SmartTradeSheet";
import { SendSheet } from "@/src/features/payments/SendSheet";
import { formatUsd } from "@/src/lib/prices";
import { StickyActions } from "./StickyActions";

export function UserHome() {
  const wallets = useWallets();
  const createMutation = useCreateWallet();
  const wallet = wallets.data?.[0];
  const address = wallet?.classic_address;
  const assetsState = useWalletAssets(address);

  const [showSmartTrade, setShowSmartTrade] = useState(false);
  const [showSend, setShowSend] = useState(false);

  const onCreate = async () => {
    try {
      await createMutation.mutateAsync("user");
    } catch (err) {
      Alert.alert("Create wallet failed", (err as Error).message);
    }
  };

  const onRefresh = async () => {
    await Promise.all([wallets.refetch(), assetsState.refetch()]);
  };

  const refreshing = wallets.isFetching || assetsState.isFetching;

  return (
    <Screen>
      <AppScrollView
        contentContainerClassName="px-6 pt-6 pb-32"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
        }
      >
        <Text className="text-base font-semibold text-white/70">Total Balance</Text>
        <Text className="mb-8 mt-1 text-5xl font-bold text-white">
          ${formatUsd(assetsState.totalUsd)}
        </Text>

        <Text className="mb-3 text-xl font-bold text-white">My Wallet</Text>
        {wallets.isLoading ? (
          <View className="items-center py-8">
            <ActivityIndicator color="#fff" />
          </View>
        ) : wallets.error ? (
          <Text className="text-danger">{(wallets.error as Error).message}</Text>
        ) : wallet ? (
          <WalletSummaryCard
            wallet={wallet}
            balance={assetsState.summary}
            isLoading={assetsState.isLoading}
            onTransfer={() => setShowSend(true)}
          />
        ) : (
          <NoWalletCard onCreate={onCreate} isCreating={createMutation.isPending} />
        )}

        <Text className="mb-3 mt-8 text-xl font-bold text-white">Portfolio</Text>
        <AssetTable assets={assetsState.assets} loading={assetsState.isLoading} />
      </AppScrollView>

      <StickyActions
        canAct={!!address}
        onSmartTrade={() => setShowSmartTrade(true)}
        onSend={() => setShowSend(true)}
      />

      <SmartTradeSheet
        visible={showSmartTrade}
        onClose={() => setShowSmartTrade(false)}
        walletAddress={address ?? null}
        balances={assetsState.balanceByCurrency}
      />
      <SendSheet
        visible={showSend}
        onClose={() => setShowSend(false)}
        walletAddress={address ?? null}
      />
    </Screen>
  );
}
