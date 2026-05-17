import { Alert, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { dropsToXrp, formatXrp, shortAddress } from "@/src/lib/formatters";
import { useWalletInfo } from "@/src/hooks/useWallets";
import type { WalletSummary } from "@/src/api/wallets";

export function WalletCard({
  wallet,
  onDelete,
}: {
  wallet: WalletSummary;
  onDelete: (address: string) => void;
}) {
  const router = useRouter();
  const { data: info } = useWalletInfo(wallet.classic_address);
  const balanceXrp = info?.Balance ? dropsToXrp(info.Balance) : null;

  const confirmDelete = () => {
    Alert.alert(
      "Remove wallet?",
      `${shortAddress(wallet.classic_address)} will no longer be tracked. The XRPL account remains on-ledger.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => onDelete(wallet.classic_address) },
      ],
    );
  };

  return (
    <TouchableOpacity
      onPress={() => router.push(`/wallet/${wallet.classic_address}` as any)}
      className="mb-3 rounded-2xl border border-white/10 p-5"
    >
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-xs uppercase tracking-wider text-white/50">{wallet.wallet_type}</Text>
        <TouchableOpacity onPress={confirmDelete} hitSlop={12}>
          <Text className="text-xs text-danger">Remove</Text>
        </TouchableOpacity>
      </View>
      <Text className="mb-1 font-mono text-base text-white">
        {shortAddress(wallet.classic_address, 10, 6)}
      </Text>
      <Text className="text-sm text-white/60">
        {balanceXrp !== null ? `${formatXrp(balanceXrp)} XRP` : "Loading balance..."}
      </Text>
    </TouchableOpacity>
  );
}
