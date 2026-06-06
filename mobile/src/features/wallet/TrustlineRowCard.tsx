import { Text, View } from "react-native";
import { decodeCurrency, isLpTokenCurrency } from "@/src/lib/formatters";
import { formatBalanceForCurrency } from "@/src/lib/prices";
import { useLpPairCurrencies } from "@/src/hooks/useLpPairCurrencies";
import type { TrustlineRow } from "@/src/lib/walletAssets";

function trustlineTitle(
  line: TrustlineRow,
  pair: { currencyA: string; currencyB: string } | null,
): string {
  if (!isLpTokenCurrency(line.currency)) {
    return decodeCurrency(line.currency);
  }
  if (pair) return `${pair.currencyA} / ${pair.currencyB} LP`;
  return "Liquidity pool LP";
}

export function TrustlineRowCard({ line }: { line: TrustlineRow }) {
  const lp = isLpTokenCurrency(line.currency);
  const pair = useLpPairCurrencies(lp ? line.account : undefined);
  const balance = parseFloat(line.balance);
  const balanceText = Number.isFinite(balance)
    ? formatBalanceForCurrency(balance, line.currency)
    : line.balance;

  return (
    <View className="mb-3 rounded-2xl border border-white/10 p-4">
      <Text className="mb-1 text-base font-semibold text-white">{trustlineTitle(line, pair)}</Text>
      <Text className="mb-2 text-sm text-white/70">Balance: {balanceText}</Text>
      <Text className="font-mono text-xs text-white/50">
        {lp ? "Pool: " : "Issuer: "}
        {line.account}
      </Text>
    </View>
  );
}
