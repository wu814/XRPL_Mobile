import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useWallets } from "@/src/hooks/useWallets";
import { useDexOrderBook } from "@/src/hooks/useDex";
import { getIssuerWallets } from "@/src/api/wallets";
import { shortAddress } from "@/src/lib/formatters";
import type { DexCurrencyPair } from "@/src/lib/dex";
import { DEFAULT_DEX_PAIR } from "@/src/lib/dex";
import { DexPlaceOrder } from "@/src/features/dex/DexPlaceOrder";
import { DexOrderBook } from "@/src/features/dex/DexOrderBook";
import { DexOrdersPanel } from "@/src/features/dex/DexOrdersPanel";
import { useAuthStore } from "@/src/stores/auth";

export default function DexScreen() {
  const isAdmin = useAuthStore((s) => s.profile?.role) === "ADMIN";
  const wallets = useWallets();
  const issuers = useQuery({ queryKey: ["wallets", "issuers"], queryFn: getIssuerWallets });

  const [selected, setSelected] = useState<string | null>(null);

  const tradeWallets = useMemo(
    () =>
      (wallets.data ?? []).filter(
        (w) => w.wallet_type === "user" || w.wallet_type === "pathfind",
      ),
    [wallets.data],
  );

  const walletOptions = tradeWallets.length ? tradeWallets : wallets.data ?? [];

  const defaultWalletAddress = useMemo(() => {
    if (isAdmin) {
      const pathfind = walletOptions.find((w) => w.wallet_type === "pathfind");
      if (pathfind) return pathfind.classic_address;
    }
    return walletOptions[0]?.classic_address ?? null;
  }, [isAdmin, walletOptions]);

  useEffect(() => {
    if (!defaultWalletAddress) {
      setSelected(null);
      return;
    }
    const stillValid =
      selected != null && walletOptions.some((w) => w.classic_address === selected);
    if (!stillValid) setSelected(defaultWalletAddress);
  }, [defaultWalletAddress, selected, walletOptions]);

  const walletAddress = selected ?? defaultWalletAddress;

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
    <SafeAreaView className="flex-1 bg-black">
      <Stack.Screen
        options={{
          title: "DEX",
          headerStyle: { backgroundColor: "#000" },
          headerTintColor: "#fff",
        }}
      />

      <ScrollView contentContainerClassName="px-4 pb-8 pt-4" keyboardShouldPersistTaps="handled">
        <View className="mb-1 flex-row items-baseline justify-between">
          <Text className="text-2xl font-bold text-white">
            {baseCurrency}-{quoteCurrency}
          </Text>
          {book.sellOffers.length + book.buyOffers.length > 0 && !book.isLoading && (
            <Text className="text-xs text-white/50">Testnet order book</Text>
          )}
        </View>
        <Text className="mb-4 text-sm text-white/55">Limit orders on the XRPL DEX</Text>

        {!issuerAddress && !issuers.isLoading && (
          <View className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
            <Text className="text-xs text-amber-200">
              Create an issuer wallet (admin Home → Create Wallet) before trading IOU pairs.
            </Text>
          </View>
        )}

        <Text className="mb-2 text-xs uppercase tracking-wider text-white/50">Wallet</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
          {walletOptions.map((w) => {
            const isSelected = walletAddress === w.classic_address;
            return (
              <TouchableOpacity
                key={w.id}
                onPress={() => setSelected(w.classic_address)}
                className={`mr-2 rounded-full px-4 py-2 ${isSelected ? "bg-primary" : "border border-white/20"}`}
              >
                <Text className={`text-xs ${isSelected ? "text-black" : "text-white"}`}>
                  {shortAddress(w.classic_address)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Trade row: place order (left) + order book (right) — matches xrpl_mvp / screenshot layout */}
        <View className="mb-2 min-h-[340px] flex-row gap-2">
          <DexPlaceOrder
            walletAddress={walletAddress}
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

        <DexOrdersPanel walletAddress={walletAddress} />
      </ScrollView>
    </SafeAreaView>
  );
}
