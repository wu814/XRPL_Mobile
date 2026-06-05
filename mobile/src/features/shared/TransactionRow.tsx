import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { ComponentProps } from "react";
import { Linking, Text, TouchableOpacity, View } from "react-native";
import type { ProcessedTransaction } from "@/src/api/transactions";

type MaterialIconName = ComponentProps<typeof MaterialIcons>["name"];

type TxStyle = {
  label: string;
  color: string;
  bg: string;
  icon: MaterialIconName;
  iconColor: string;
};

const TX_STYLES: Record<string, TxStyle> = {
  sent: {
    label: "Sent",
    color: "text-green-400",
    bg: "bg-green-600",
    icon: "call-made",
    iconColor: "#ffffff",
  },
  received: {
    label: "Received",
    color: "text-green-400",
    bg: "bg-green-600",
    icon: "call-received",
    iconColor: "#ffffff",
  },
  smart_trade: {
    label: "Smart Trade",
    color: "text-yellow-400",
    bg: "bg-yellow-500",
    icon: "swap-horiz",
    iconColor: "#000000",
  },
  offer_create: {
    label: "Create Offer",
    color: "text-blue-400",
    bg: "bg-blue-500",
    icon: "post-add",
    iconColor: "#ffffff",
  },
  offer_cancel: {
    label: "Cancel Offer",
    color: "text-red-400",
    bg: "bg-red-500",
    icon: "highlight-off",
    iconColor: "#ffffff",
  },
  trustline_set: {
    label: "Set Trustline",
    color: "text-purple-400",
    bg: "bg-purple-500",
    icon: "link",
    iconColor: "#ffffff",
  },
  authorize_trustline: {
    label: "Authorize Trustline",
    color: "text-violet-400",
    bg: "bg-violet-500",
    icon: "verified-user",
    iconColor: "#ffffff",
  },
  trustline_freeze: {
    label: "Freeze Trustline",
    color: "text-sky-400",
    bg: "bg-sky-600",
    icon: "ac-unit",
    iconColor: "#ffffff",
  },
  deep_freeze: {
    label: "Deep Freeze",
    color: "text-sky-300",
    bg: "bg-sky-800",
    icon: "severe-cold",
    iconColor: "#ffffff",
  },
  trustline_unfreeze: {
    label: "Unfreeze Trustline",
    color: "text-teal-400",
    bg: "bg-teal-600",
    icon: "lock-open",
    iconColor: "#ffffff",
  },
  deposit_preauth: {
    label: "Authorize Deposit",
    color: "text-teal-400",
    bg: "bg-teal-500",
    icon: "account-balance-wallet",
    iconColor: "#ffffff",
  },
  oracle_set: {
    label: "Set Oracle",
    color: "text-amber-400",
    bg: "bg-amber-500",
    icon: "show-chart",
    iconColor: "#000000",
  },
  oracle_delete: {
    label: "Delete Oracle",
    color: "text-amber-300",
    bg: "bg-amber-700",
    icon: "delete-outline",
    iconColor: "#ffffff",
  },
  account_set: {
    label: "Account Settings",
    color: "text-slate-400",
    bg: "bg-slate-600",
    icon: "settings",
    iconColor: "#ffffff",
  },
  amm_create: {
    label: "AMM Create",
    color: "text-cyan-400",
    bg: "bg-cyan-500",
    icon: "water-drop",
    iconColor: "#ffffff",
  },
  amm_deposit: {
    label: "AMM Deposit",
    color: "text-cyan-400",
    bg: "bg-cyan-500",
    icon: "add-circle-outline",
    iconColor: "#ffffff",
  },
  amm_withdraw: {
    label: "AMM Withdraw",
    color: "text-orange-400",
    bg: "bg-orange-500",
    icon: "remove-circle-outline",
    iconColor: "#ffffff",
  },
  nft_mint: {
    label: "NFT Mint",
    color: "text-pink-400",
    bg: "bg-pink-500",
    icon: "brush",
    iconColor: "#ffffff",
  },
  nft_create_offer: {
    label: "NFT Create Offer",
    color: "text-indigo-400",
    bg: "bg-indigo-500",
    icon: "sell",
    iconColor: "#ffffff",
  },
  nft_accept_offer: {
    label: "NFT Accept Offer",
    color: "text-emerald-400",
    bg: "bg-emerald-500",
    icon: "shopping-bag",
    iconColor: "#ffffff",
  },
  clawback: {
    label: "Clawback",
    color: "text-rose-400",
    bg: "bg-rose-500",
    icon: "undo",
    iconColor: "#ffffff",
  },
};

function humanizeType(type: string): string {
  return type
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim();
}

function resolveTxStyle(direction: string, type: string): TxStyle {
  const known = TX_STYLES[direction];
  if (known) return known;
  const label = humanizeType(type || direction);
  return {
    label,
    color: "text-white/70",
    bg: "bg-white/20",
    icon: "receipt-long",
    iconColor: "#ffffff",
  };
}

export function formatTransactionType(direction: string, fallback: string): string {
  return resolveTxStyle(direction, fallback).label;
}

function DirectionBadge({ direction, type }: { direction: string; type: string }) {
  const { bg, icon, iconColor } = resolveTxStyle(direction, type);
  return (
    <View className={`h-8 w-8 items-center justify-center rounded-full ${bg}`}>
      <MaterialIcons name={icon} size={17} color={iconColor} />
    </View>
  );
}

function formatAmount(amount: ProcessedTransaction["amount"], currency: string): string {
  if (amount === null || amount === undefined) return "—";
  if (typeof amount === "string") {
    if (amount.includes("→") || amount.includes("+") || amount.includes(" ")) return amount;
    if (currency === "XRP") return `${parseFloat(amount).toFixed(6)} XRP`;
    if (!currency) return amount;
    return `${parseFloat(amount).toFixed(6)} ${currency}`;
  }
  if (currency === "XRP") return `${amount.toFixed(6)} XRP`;
  return `${amount} ${currency}`;
}

export function TransactionRow({ tx }: { tx: ProcessedTransaction }) {
  const { color } = resolveTxStyle(tx.direction, tx.type);
  const openExplorer = () => {
    Linking.openURL(`https://testnet.xrpl.org/transactions/${tx.hash}`).catch(() => undefined);
  };
  return (
    <View className="border-b border-white/5 px-4 py-4">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 flex-row items-center">
          <DirectionBadge direction={tx.direction} type={tx.type} />
          <View className="ml-3 flex-1">
            <View className="flex-row items-center">
              <Text className={`font-semibold ${color}`}>
                {formatTransactionType(tx.direction, tx.type)}
              </Text>
              <Text className="ml-2 text-xs text-white/40">
                {tx.result === "tesSUCCESS" ? "✓" : "✗"}
              </Text>
            </View>
            <View>
              {tx.counterparty ? (
                <Text className="text-xs text-white/60" numberOfLines={1}>
                  {tx.direction === "sent"
                    ? "To: "
                    : tx.direction === "received"
                      ? "From: "
                      : "Counterparty: "}
                  {tx.counterparty}
                </Text>
              ) : null}
              {tx.date ? (
                <Text className="text-xs text-white/40">
                  {new Date(tx.date).toLocaleString()}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
        <View className="ml-3 items-end">
          <Text className="font-medium text-white/85">{formatAmount(tx.amount, tx.currency)}</Text>
          {tx.fee ? (
            <Text className="text-[10px] text-white/40">Fee: {tx.fee} XRP</Text>
          ) : null}
          <TouchableOpacity onPress={openExplorer} hitSlop={8}>
            <Text className="mt-1 text-xs text-primary">View ↗</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
