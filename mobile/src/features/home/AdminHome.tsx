import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { AppScrollView } from "@/src/components/ui/AppScrollView";
import { Screen } from "@/src/components/ui/Screen";
import { useCreateWallet, useWalletObligations, useWallets } from "@/src/hooks/useWallets";
import { useAllWalletAssets } from "@/src/hooks/useAllWalletAssets";
import { useLivePrices } from "@/src/hooks/useLivePrices";
import { CreateAdminWalletCard } from "@/src/features/wallet/WalletSummaryCard";
import { WalletCardContainer } from "@/src/features/wallet/WalletCardContainer";
import { CreateAdminWalletModal } from "@/src/features/wallet/CreateAdminWalletModal";
import { AssetTable } from "@/src/features/shared/AssetTable";
import { SmartTradeSheet } from "@/src/features/payments/SmartTradeSheet";
import { SendSheet } from "@/src/features/payments/SendSheet";
import { formatUsdDisplay } from "@/src/lib/prices";
import { buildIssuerWalletAssets, totalUsdForAssets } from "@/src/lib/walletAssets";
import type { WalletSummary } from "@/src/api/wallets";
import { StickyActions } from "./StickyActions";

export function AdminHome() {
  const wallets = useWallets();
  const createMutation = useCreateWallet();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSmartTrade, setShowSmartTrade] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [sendingFrom, setSendingFrom] = useState<WalletSummary | null>(null);

  const sortedWallets = useMemo<WalletSummary[]>(() => {
    const data = wallets.data ?? [];
    const order: Record<string, number> = { issuer: 0, treasury: 1, pathfind: 2 };
    return [...data].sort(
      (a, b) => (order[a.wallet_type] ?? 99) - (order[b.wallet_type] ?? 99),
    );
  }, [wallets.data]);

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

  const issuerWallet = useMemo(
    () => portfolioWallets.find((w) => w.wallet_type === "issuer") ?? null,
    [portfolioWallets],
  );

  const nonIssuerAddresses = useMemo(
    () =>
      portfolioWallets
        .filter((w) => w.wallet_type !== "issuer")
        .map((w) => w.classic_address),
    [portfolioWallets],
  );

  const livePrices = useLivePrices();
  const aggregate = useAllWalletAssets(nonIssuerAddresses);
  const issuerObligations = useWalletObligations(issuerWallet?.classic_address);

  const issuerAssets = useMemo(
    () =>
      buildIssuerWalletAssets({
        address: issuerWallet?.classic_address ?? "",
        obligations: issuerObligations.data?.obligations,
        prices: livePrices.prices,
      }),
    [issuerWallet?.classic_address, issuerObligations.data?.obligations, livePrices.prices],
  );

  const totalUsd = useMemo(() => totalUsdForAssets(issuerAssets), [issuerAssets]);

  const portfolioLoading =
    livePrices.isLoading ||
    aggregate.isLoading ||
    (!!issuerWallet && issuerObligations.isLoading);

  const treasuryWallet = useMemo(
    () => sortedWallets.find((w) => w.wallet_type === "treasury") ?? null,
    [sortedWallets],
  );

  const defaultSendWallet = sendingFrom ?? treasuryWallet ?? sortedWallets[0] ?? null;

  const assetsByWallet = useMemo(() => {
    const map = new Map<string, typeof aggregate.assets>();
    for (const wallet of portfolioWallets) {
      if (wallet.wallet_type === "issuer") {
        map.set(wallet.classic_address, issuerAssets);
      } else {
        map.set(
          wallet.classic_address,
          aggregate.assets.filter((a) => a.walletAddress === wallet.classic_address),
        );
      }
    }
    return map;
  }, [portfolioWallets, issuerAssets, aggregate.assets]);

  const onRefresh = async () => {
    await Promise.all([
      wallets.refetch(),
      livePrices.refetch(),
      aggregate.refetch(),
      issuerObligations.refetch(),
    ]);
  };

  return (
    <Screen>
      <AppScrollView
        contentContainerClassName="px-6 pt-6 pb-32"
        refreshControl={
          <RefreshControl
            refreshing={wallets.isFetching || aggregate.isFetching || livePrices.isFetching}
            onRefresh={onRefresh}
            tintColor="#fff"
          />
        }
      >
        <Text className="text-base font-semibold text-white/70">Total Balance</Text>
        <Text className="mb-1 mt-1 text-5xl font-bold text-white">
          {formatUsdDisplay(totalUsd)}
        </Text>
        <Text className="mb-8 text-xs text-white/45">
          Issued token liability (USD)
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
            {portfolioWallets.map((w) => (
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
          <AssetTable assets={[]} loading={portfolioLoading} />
        ) : (
          portfolioWallets.map((wallet) => (
            <View key={wallet.id} className="mb-6">
              <AssetTable
                title={wallet.wallet_type.toUpperCase()}
                assets={assetsByWallet.get(wallet.classic_address) ?? []}
                loading={portfolioLoading}
              />
            </View>
          ))
        )}
      </AppScrollView>

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
    </Screen>
  );
}
