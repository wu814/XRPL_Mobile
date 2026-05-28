import { useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { CurrencyIconImage, LpTokenIcon } from "./CurrencyIconImage";
import { formatBalance, formatUsd } from "@/src/lib/prices";
import { shortAddress } from "@/src/lib/formatters";
import type { WalletAsset } from "@/src/hooks/useWalletAssets";

interface AssetTableProps {
  assets: WalletAsset[];
  loading?: boolean;
}

function isLpToken(asset: WalletAsset): boolean {
  return !!asset.currency && asset.currency.length === 40;
}

function displayName(asset: WalletAsset): string {
  if (isLpToken(asset)) {
    return `LP Token (${asset.currency.substring(0, 8)}…)`;
  }
  return asset.currency;
}

export function AssetTable({ assets, loading }: AssetTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <View className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <View className="flex-row items-center justify-between border-b border-white/10 px-4 py-3">
        <Text className="text-base font-bold text-white">Assets</Text>
        <Text className="text-base font-bold text-white">USD Values</Text>
      </View>

      {loading ? (
        <View className="items-center py-10">
          <ActivityIndicator color="#fff" />
        </View>
      ) : assets.length === 0 ? (
        <View className="items-center py-10">
          <Text className="text-white/60">No assets yet</Text>
          <Text className="mt-1 text-xs text-white/40">
            Your balances will appear here once you have assets.
          </Text>
        </View>
      ) : (
        assets.map((asset) => {
          const isExp = expanded.has(asset.id);
          const change = parseFloat(asset.change24h) || 0;
          const positive = change >= 0;
          const lp = isLpToken(asset);
          return (
            <View key={asset.id}>
              <TouchableOpacity
                onPress={() => toggle(asset.id)}
                className="flex-row items-center justify-between border-b border-white/5 px-3 py-3"
              >
                <View className="flex-1 flex-row items-center">
                  <View className="mr-3 h-10 w-10 items-center justify-center">
                    {lp ? (
                      <LpTokenIcon currencyA="?" currencyB="?" size={40} />
                    ) : (
                      <CurrencyIconImage currency={asset.currency} size={40} />
                    )}
                  </View>
                  <View>
                    <Text className="text-base font-semibold text-white">{displayName(asset)}</Text>
                    <Text className="text-xs text-white/50">{formatBalance(asset.balance, 6)}</Text>
                  </View>
                </View>
                <View className="items-end">
                  <Text className="text-base font-semibold text-white">
                    ${formatUsd(asset.value || 0)}
                  </Text>
                  <Text
                    className={`text-xs ${positive ? "text-green-400" : "text-red-400"}`}
                  >
                    {positive ? "+" : ""}
                    {change.toFixed(2)}%
                  </Text>
                </View>
              </TouchableOpacity>

              {isExp ? (
                <View className="bg-white/5 px-4 py-3">
                  {asset.issuer ? (
                    <View className="mb-1 flex-row">
                      <Text className="mr-2 text-xs text-white/50">Issuer:</Text>
                      <Text className="flex-1 font-mono text-xs text-white">
                        {shortAddress(asset.issuer, 14, 8)}
                      </Text>
                    </View>
                  ) : null}
                  {asset.walletAddress ? (
                    <View className="flex-row">
                      <Text className="mr-2 text-xs text-white/50">Wallet:</Text>
                      <Text className="flex-1 font-mono text-xs text-white">
                        {shortAddress(asset.walletAddress, 14, 8)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </View>
  );
}
