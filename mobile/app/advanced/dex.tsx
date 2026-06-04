import { useMemo, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { AppScrollView } from "@/src/components/ui/AppScrollView";
import { Screen } from "@/src/components/ui/Screen";
import { Stack } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useWallets } from "@/src/hooks/useWallets";
import { useDexOrderBook } from "@/src/hooks/useDex";
import { getIssuerWallets } from "@/src/api/wallets";
import type { DexCurrencyPair } from "@/src/lib/dex";
import { DEFAULT_DEX_PAIR } from "@/src/lib/dex";
import { missingDexWalletMessage, resolveDexWallet } from "@/src/lib/featureWallet";
import { useAuthStore } from "@/src/stores/auth";
import { DexPlaceOrder } from "@/src/features/dex/DexPlaceOrder";
import { DexOrderBook } from "@/src/features/dex/DexOrderBook";
import { DexOrdersPanel } from "@/src/features/dex/DexOrdersPanel";

export default function DexScreen() {
  const isAdmin = useAuthStore((s) => s.profile?.role) === "ADMIN";
  const wallets = useWallets();
  const issuers = useQuery({ queryKey: ["wallets", "issuers"], queryFn: getIssuerWallets });

  const dexWallet = useMemo(
    () => resolveDexWallet(wallets.data, isAdmin),
    [wallets.data, isAdmin],
  );

  const [baseCurrency, setBaseCurrency] = useState(DEFAULT_DEX_PAIR.base);
  const [quoteCurrency, setQuoteCurrency] = useState(DEFAULT_DEX_PAIR.quote);

  const issuerAddress = issuers.data?.[0]?.classic_address ?? "";

  const pair: DexCurrencyPair | null = useMemo(() => {
    if (!issuerAddress || baseCurrency === quoteCurrency) return null;
    return { base: baseCurrency, quote: quoteCurrency, issuerAddress };
  }, [baseCurrency, quoteCurrency, issuerAddress]);

  const book = useDexOrderBook(pair);

  const onPairChange = (base: string, quote: string) => {
    setBaseCurrency(base);
    setQuoteCurrency(quote);
  };

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: "DEX",
          headerStyle: { backgroundColor: "#000" },
          headerTintColor: "#fff",
        }}
      />

      <AppScrollView contentContainerClassName="px-4 pb-8 pt-4">
        <View className="mb-1 flex-row items-baseline justify-between">
          <Text className="text-2xl font-bold text-white">
            {baseCurrency}-{quoteCurrency}
          </Text>
          {book.sellOffers.length + book.buyOffers.length > 0 && !book.isLoading && (
            <Text className="text-xs text-white/50">Testnet order book</Text>
          )}
        </View>
        <Text className="mb-4 text-sm text-white/55">Limit orders on the XRPL DEX</Text>

        {!issuerAddress && !issuers.isLoading && isAdmin && (
          <View className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
            <Text className="text-xs text-amber-200">
              Create an issuer wallet (admin Home → Create Wallet) before trading IOU pairs.
            </Text>
          </View>
        )}

        {!dexWallet.address && !wallets.isLoading && (
          <View className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
            <Text className="text-xs text-amber-200">{missingDexWalletMessage(isAdmin)}</Text>
          </View>
        )}

        {isAdmin && dexWallet.address && dexWallet.wallet ? (
          <>
            <Text className="mb-2 text-xs uppercase tracking-wider text-white/50">Wallet</Text>
            <View className="mb-4 self-start rounded-full bg-primary px-4 py-2">
              <Text className="text-xs font-semibold uppercase text-black">
                {dexWallet.wallet.wallet_type}
              </Text>
            </View>
          </>
        ) : null}

        <View className="mb-2 min-h-[340px] flex-row gap-2">
          <DexPlaceOrder
            walletAddress={dexWallet.address}
            isAdmin={isAdmin}
            pair={pair}
            onPairChange={onPairChange}
          />
          {issuers.isLoading ? (
            <View className="flex-1 items-center justify-center rounded-2xl border border-white/10">
              <ActivityIndicator color="#8EDFE2" />
            </View>
          ) : (
            <DexOrderBook
              baseCurrency={baseCurrency}
              quoteCurrency={quoteCurrency}
              sellOffers={book.sellOffers}
              buyOffers={book.buyOffers}
              isLoading={book.isLoading}
              isRefreshing={book.isRefreshing}
              onRefresh={book.refetch}
            />
          )}
        </View>

        <DexOrdersPanel walletAddress={dexWallet.address} />
      </AppScrollView>
    </Screen>
  );
}
