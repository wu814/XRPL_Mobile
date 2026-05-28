import { Linking, Text, TouchableOpacity, View } from "react-native";
import type { ProcessedTransaction } from "@/src/api/transactions";

export function formatTransactionType(direction: string, fallback: string): string {
  switch (direction) {
    case "sent":
      return "Sent";
    case "received":
      return "Received";
    case "smart_trade":
      return "Smart Trade";
    case "offer_create":
      return "Create Offer";
    case "offer_cancel":
      return "Cancel Offer";
    case "trustline_set":
      return "Set Trustline";
    case "amm_create":
      return "AMM Create";
    case "amm_deposit":
      return "AMM Deposit";
    case "amm_withdraw":
      return "AMM Withdraw";
    case "nft_mint":
      return "NFT Mint";
    case "nft_create_offer":
      return "NFT Create Offer";
    case "nft_accept_offer":
      return "NFT Accept Offer";
    case "clawback":
      return "Clawback";
    default:
      return fallback || "Unknown";
  }
}

function getDirectionColor(direction: string): string {
  switch (direction) {
    case "sent":
    case "received":
      return "text-green-400";
    case "smart_trade":
      return "text-yellow-400";
    case "offer_create":
      return "text-blue-400";
    case "offer_cancel":
      return "text-red-400";
    case "trustline_set":
      return "text-purple-400";
    case "amm_deposit":
    case "amm_create":
      return "text-cyan-400";
    case "amm_withdraw":
      return "text-orange-400";
    case "nft_mint":
      return "text-pink-400";
    case "nft_create_offer":
      return "text-indigo-400";
    case "nft_accept_offer":
      return "text-emerald-400";
    default:
      return "text-white/70";
  }
}

function DirectionBadge({ direction }: { direction: string }) {
  const map: Record<string, { bg: string; letter: string }> = {
    sent: { bg: "bg-green-600", letter: "↗" },
    received: { bg: "bg-green-600", letter: "↙" },
    smart_trade: { bg: "bg-yellow-500", letter: "S" },
    offer_create: { bg: "bg-blue-500", letter: "+" },
    offer_cancel: { bg: "bg-red-500", letter: "×" },
    trustline_set: { bg: "bg-purple-500", letter: "T" },
    amm_create: { bg: "bg-cyan-500", letter: "A" },
    amm_deposit: { bg: "bg-cyan-500", letter: "D" },
    amm_withdraw: { bg: "bg-orange-500", letter: "W" },
    nft_mint: { bg: "bg-pink-500", letter: "M" },
    nft_create_offer: { bg: "bg-indigo-500", letter: "O" },
    nft_accept_offer: { bg: "bg-emerald-500", letter: "A" },
    clawback: { bg: "bg-rose-500", letter: "C" },
  };
  const s = map[direction] ?? { bg: "bg-white/20", letter: "?" };
  return (
    <View className={`h-7 w-7 items-center justify-center rounded-full ${s.bg}`}>
      <Text className="text-xs font-bold text-white">{s.letter}</Text>
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
  const color = getDirectionColor(tx.direction);
  const openExplorer = () => {
    Linking.openURL(`https://testnet.xrpl.org/transactions/${tx.hash}`).catch(() => undefined);
  };
  return (
    <View className="border-b border-white/5 px-4 py-4">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 flex-row items-center">
          <DirectionBadge direction={tx.direction} />
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
                  {tx.direction === "sent" ? "To: " : "From: "}
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
          <Text className={`font-medium ${color}`}>{formatAmount(tx.amount, tx.currency)}</Text>
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
