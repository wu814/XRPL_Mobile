import { useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { AppSheet } from "@/src/components/ui/AppSheet";
import { useAuthStore } from "@/src/stores/auth";
import { formatBalance } from "@/src/lib/prices";
import type { WalletSummary } from "@/src/api/wallets";
import type { WalletBalanceSummary } from "@/src/lib/walletAssets";
import {
  WalletActionSheet,
  WALLET_ACTION_TITLES,
  type WalletActionKey,
} from "@/src/features/wallet/WalletActionSheet";

interface WalletSummaryCardProps {
  wallet: WalletSummary;
  balance: WalletBalanceSummary;
  isLoading: boolean;
  onTransfer: () => void;
  onDelete?: () => void;
}

function actionsForType(walletType: WalletSummary["wallet_type"]): WalletActionKey[] {
  switch (walletType) {
    case "issuer":
      return ["authorize_deposit", "authorize_trustline", "clawback", "deep_freeze"];
    case "treasury":
      return ["set_trustline", "authorize_deposit", "manage_oracle"];
    case "pathfind":
      return ["set_trustline"];
    default:
      return ["set_trustline"];
  }
}

export function WalletSummaryCard({
  wallet,
  balance,
  isLoading,
  onTransfer,
  onDelete,
}: WalletSummaryCardProps) {
  const router = useRouter();
  const role = useAuthStore((s) => s.profile?.role);
  const username = useAuthStore((s) => s.profile?.username);
  const [showDetails, setShowDetails] = useState(false);
  const [activeAction, setActiveAction] = useState<WalletActionKey | null>(null);

  const isAdmin = role === "ADMIN";
  const isSystemWallet = wallet.wallet_type !== "user";
  const heading = isSystemWallet
    ? wallet.wallet_type.toUpperCase()
    : (username ?? "User").toUpperCase();

  const typeActions = actionsForType(wallet.wallet_type);

  return (
    <View className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-5">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-xl font-bold text-white">{heading}</Text>
        </View>
        <View className="items-end">
          <View className="flex-row items-center">
            <Text className="text-sm text-white/60">Balance: </Text>
            <Text className="text-sm text-white">
              {isLoading ? "…" : formatBalance(balance.xrpBalance, 6)}
            </Text>
            <Text className="ml-1 text-xs text-white/40">XRP</Text>
          </View>
          <View className="mt-1 flex-row items-center">
            <Text className="text-sm text-white/60">Reserved: </Text>
            <Text className="text-sm text-white">
              {isLoading ? "…" : formatBalance(balance.reservedXrp, 1)}
            </Text>
            <Text className="ml-1 text-xs text-white/40">XRP</Text>
          </View>
          <View className="mt-1 flex-row items-center">
            <Text className="text-sm text-white/60">Available: </Text>
            <Text className="text-sm font-semibold text-primary">
              {isLoading ? "…" : formatBalance(balance.availableXrp, 6)}
            </Text>
            <Text className="ml-1 text-xs text-primary/80">XRP</Text>
          </View>
        </View>
      </View>

      <Text
        className="mt-3 font-mono text-xs text-white/60"
        numberOfLines={1}
        ellipsizeMode="middle"
      >
        {wallet.classic_address}
      </Text>

      <View className="mt-4 flex-row flex-wrap">
        <TouchableOpacity
          onPress={onTransfer}
          className="mr-2 mb-2 rounded-full border border-white/15 px-4 py-2"
        >
          <Text className="text-xs text-white">Transfer</Text>
        </TouchableOpacity>
        {typeActions.map((a) => (
          <TouchableOpacity
            key={a}
            onPress={() => setActiveAction(a)}
            className="mr-2 mb-2 rounded-full border border-white/15 px-4 py-2"
          >
            <Text className="text-xs text-white">{WALLET_ACTION_TITLES[a]}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          onPress={() => setShowDetails(true)}
          className="mr-2 mb-2 rounded-full border border-white/15 px-4 py-2"
        >
          <Text className="text-xs text-white">View Details</Text>
        </TouchableOpacity>
        {onDelete && isAdmin && isSystemWallet ? (
          <TouchableOpacity
            onPress={() =>
              Alert.alert(
                "Delete wallet?",
                "This removes the wallet record from the app database. The wallet on the XRPL ledger remains.",
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: onDelete },
                ],
              )
            }
            className="mr-2 mb-2 rounded-full border border-red-500/40 bg-red-900/20 px-4 py-2"
          >
            <Text className="text-xs text-red-400">Delete</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <WalletActionSheet
        visible={activeAction !== null}
        action={activeAction}
        wallet={wallet}
        onClose={() => setActiveAction(null)}
      />

      <AppSheet
        visible={showDetails}
        onClose={() => setShowDetails(false)}
        title="Wallet Details"
      >
          <View>
            <Text className="mb-1 text-xs uppercase tracking-wider text-white/50">Address</Text>
            <Text className="mb-4 font-mono text-sm text-white">{wallet.classic_address}</Text>
            <Text className="mb-1 text-xs uppercase tracking-wider text-white/50">Type</Text>
            <Text className="mb-4 text-base text-white">{wallet.wallet_type}</Text>
            <Text className="mb-1 text-xs uppercase tracking-wider text-white/50">Balance</Text>
            <Text className="mb-4 text-base text-white">
              {formatBalance(balance.xrpBalance, 6)} XRP
            </Text>
            <Text className="mb-1 text-xs uppercase tracking-wider text-white/50">Reserved</Text>
            <Text className="mb-4 text-base text-white">
              {formatBalance(balance.reservedXrp, 1)} XRP ({balance.ownerCount} owner objects)
            </Text>
            <Text className="mb-1 text-xs uppercase tracking-wider text-white/50">Available</Text>
            <Text className="mb-6 text-base text-primary">
              {formatBalance(balance.availableXrp, 6)} XRP
            </Text>

            <TouchableOpacity
              onPress={() => {
                setShowDetails(false);
                router.push(`/wallet/${wallet.classic_address}` as any);
              }}
              className="items-center rounded-2xl border border-white/15 py-3"
            >
              <Text className="text-sm text-white">Open trustline view</Text>
            </TouchableOpacity>
          </View>
      </AppSheet>
    </View>
  );
}

export function NoWalletCard({ onCreate, isCreating }: { onCreate: () => void; isCreating: boolean }) {
  const onPress = () => {
    if (isCreating) return;
    Alert.alert("Create wallet?", "This will fund a new XRPL Testnet wallet for you.", [
      { text: "Cancel", style: "cancel" },
      { text: "Create", onPress: onCreate },
    ]);
  };
  return (
    <View className="items-center rounded-2xl border border-white/10 bg-white/5 p-8">
      <Text className="mb-2 text-base text-white">No wallet yet</Text>
      <Text className="mb-5 text-center text-sm text-white/50">
        Create your XRPL wallet — automatically funded by the Testnet faucet.
      </Text>
      <TouchableOpacity
        onPress={onPress}
        disabled={isCreating}
        className="rounded-full bg-primary px-5 py-3"
      >
        <Text className="text-sm font-semibold text-black">
          {isCreating ? "Creating…" : "Create Wallet"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export function CreateAdminWalletCard({
  onPress,
  isCreating,
}: {
  onPress: () => void;
  isCreating: boolean;
}) {
  return (
    <View className="mb-4 items-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6">
      <Text className="mb-1 text-base font-semibold text-white">Create New Wallet</Text>
      <Text className="mb-4 text-center text-xs text-white/50">
        Add a new ISSUER, TREASURY, or PATHFIND wallet
      </Text>
      <TouchableOpacity
        onPress={onPress}
        disabled={isCreating}
        className={`w-full items-center rounded-full px-5 py-3 ${
          isCreating ? "bg-white/15" : "border border-primary/40 bg-primary/10"
        }`}
      >
        <Text
          className={`text-sm font-semibold ${
            isCreating ? "text-white/40" : "text-primary"
          }`}
        >
          {isCreating ? "Creating…" : "+ Create Wallet"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
