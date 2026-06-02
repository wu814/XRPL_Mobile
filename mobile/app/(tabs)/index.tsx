import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCreateWallet, useWallets } from "@/src/hooks/useWallets";
import { useWalletAssets } from "@/src/hooks/useWalletAssets";
import { useAllWalletAssets } from "@/src/hooks/useAllWalletAssets";
import {
  CreateAdminWalletCard,
  NoWalletCard,
  WalletSummaryCard,
} from "@/src/components/WalletSummaryCard";
import { WalletCardContainer } from "@/src/components/WalletCardContainer";
import { CreateAdminWalletModal } from "@/src/components/CreateAdminWalletModal";
import { AssetTable } from "@/src/components/AssetTable";
import { SmartTradeSheet } from "@/src/components/SmartTradeSheet";
import { SendSheet } from "@/src/components/SendSheet";
import { useAuthStore } from "@/src/stores/auth";
import { formatUsd } from "@/src/lib/prices";
import type { WalletSummary } from "@/src/api/wallets";

export default function HomeScreen() {
  const role = useAuthStore((s) => s.profile?.role);
  const isAdmin = role === "ADMIN";

  return isAdmin ? <AdminHome /> : <UserHome />;
}

function UserHome() {
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

  const refreshing = wallets.isFetching || assetsState.isLoading;

  return (
    <SafeAreaView className="flex-1 bg-black">
      <ScrollView
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
      </ScrollView>

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
    </SafeAreaView>
  );
}

function AdminHome() {
  const wallets = useWallets();
  const createMutation = useCreateWallet();

  const adminWallets = useMemo<WalletSummary[]>(() => {
    const data = wallets.data ?? [];
    // Display order: ISSUER → TREASURY → PATHFIND → others.
    const order: Record<string, number> = { issuer: 0, treasury: 1, pathfind: 2 };
    return [...data].sort(
      (a, b) => (order[a.wallet_type] ?? 99) - (order[b.wallet_type] ?? 99),
    );
  }, [wallets.data]);

  const addresses = useMemo(
    () => adminWallets.map((w) => w.classic_address),
    [adminWallets],
  );
  const aggregate = useAllWalletAssets(addresses);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSmartTrade, setShowSmartTrade] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [sendingFrom, setSendingFrom] = useState<WalletSummary | null>(null);

  const portfolioWallets = useMemo(
    () =>
      adminWallets.filter(
        (w) =>
          w.wallet_type === "issuer" ||
          w.wallet_type === "treasury" ||
          w.wallet_type === "pathfind",
      ),
    [adminWallets],
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

  const treasury = adminWallets.find((w) => w.wallet_type === "treasury");
  const defaultSendWallet = sendingFrom ?? treasury ?? adminWallets[0] ?? null;

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
            {adminWallets.map((w) => (
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

function StickyActions({
  canAct,
  onSmartTrade,
  onSend,
}: {
  canAct: boolean;
  onSmartTrade: () => void;
  onSend: () => void;
}) {
  return (
    <View className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-black/95 px-6 pb-6 pt-3">
      <View className="flex-row">
        <TouchableOpacity
          onPress={onSmartTrade}
          disabled={!canAct}
          className={`mr-2 flex-1 items-center rounded-2xl py-3 ${canAct ? "bg-primary" : "bg-white/10"}`}
        >
          <Text className={`text-base font-semibold ${canAct ? "text-black" : "text-white/40"}`}>
            Smart Trade
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onSend}
          disabled={!canAct}
          className={`ml-2 flex-1 items-center rounded-2xl py-3 ${canAct ? "bg-accent" : "bg-white/10"}`}
        >
          <Text className={`text-base font-semibold ${canAct ? "text-black" : "text-white/40"}`}>
            Send
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
