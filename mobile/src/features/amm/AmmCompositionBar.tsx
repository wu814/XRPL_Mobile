import { ActivityIndicator, Text, View } from "react-native";
import { useLivePrices } from "@/src/hooks/useLivePrices";
import { decodeCurrency } from "@/src/lib/formatters";
import { formatBalance, formatUsdDisplay, getUsdValue } from "@/src/lib/prices";

interface CurrencyAmount {
  currency: string;
  value: string | number;
}

interface AmmCompositionBarProps {
  amount1: CurrencyAmount | undefined;
  amount2: CurrencyAmount | undefined;
  loading?: boolean;
}

export function AmmCompositionBar({ amount1, amount2, loading }: AmmCompositionBarProps) {
  const { prices, isLoading: pricesLoading } = useLivePrices();

  if (loading || pricesLoading || !amount1 || !amount2) {
    return (
      <View className="py-2">
        <View className="h-2 w-full overflow-hidden rounded-full bg-white/10" />
        <View className="mt-3 items-center">
          <ActivityIndicator color="#8EDFE2" />
        </View>
      </View>
    );
  }

  const v1 = parseFloat(String(amount1.value));
  const v2 = parseFloat(String(amount2.value));
  const c1 = decodeCurrency(amount1.currency);
  const c2 = decodeCurrency(amount2.currency);

  const usd1 = getUsdValue(c1, v1, prices);
  const usd2 = getUsdValue(c2, v2, prices);
  const totalUsd = usd1 + usd2;
  const pct1 = totalUsd > 0 ? (usd1 / totalUsd) * 100 : 50;
  const pct2 = 100 - pct1;

  return (
    <View>
      <View className="mt-2 h-2 w-full flex-row overflow-hidden rounded-full">
        <View className="bg-primary/85" style={{ width: `${pct1}%` }} />
        <View className="bg-danger/85" style={{ width: `${pct2}%` }} />
      </View>

      <View className="mt-3 flex-row justify-between px-1">
        <Text className="text-base font-semibold text-white">
          {formatBalance(v1, 4)} {c1}
        </Text>
        <Text className="text-base font-semibold text-white">
          {formatBalance(v2, 4)} {c2}
        </Text>
      </View>

      <View className="mt-1 flex-row justify-between px-1">
        <Text className="text-sm text-white/50">{formatUsdDisplay(usd1)}</Text>
        <Text className="text-sm text-white/50">{formatUsdDisplay(usd2)}</Text>
      </View>
    </View>
  );
}
