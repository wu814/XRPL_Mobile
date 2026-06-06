import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { DexRefreshButton } from "@/src/features/dex/DexRefreshButton";
import {
  formatActiveOfferLeg,
  formatOfferQty,
  offerLeg,
  parseDexAsset,
  rippleTimeToDate,
  type BookOfferRow,
} from "@/src/lib/dex";
import { useCancelOffer, useCompletedOffers, useUserOffers } from "@/src/hooks/useDex";

type OrdersTab = "active" | "completed";

interface DexOrdersPanelProps {
  walletAddress: string | null;
}

function explorerUrl(hash: string) {
  return `https://testnet.xrpl.org/transactions/${hash}`;
}

export function DexOrdersPanel({ walletAddress }: DexOrdersPanelProps) {
  const [tab, setTab] = useState<OrdersTab>("active");
  const active = useUserOffers(walletAddress ?? undefined);
  const completed = useCompletedOffers(walletAddress ?? undefined);
  const cancelMut = useCancelOffer();

  const query = tab === "active" ? active : completed;
  const [isRefreshing, setIsRefreshing] = useState(false);
  const cancelPending = cancelMut.isPending;

  const refetch = () => {
    if (cancelPending) return;
    setIsRefreshing(true);
    const p = tab === "active" ? active.refetch() : completed.refetch();
    void p.finally(() => setIsRefreshing(false));
  };

  const requestCancel = (seq: number) => {
    if (!walletAddress || cancelPending) return;
    cancelMut.mutate(
      { walletAddress, sequence: seq },
      {
        onSuccess: () => {
          Alert.alert("Success", "Order canceled successfully");
        },
        onError: (err) => {
          Alert.alert("Cancel failed", (err as Error).message);
        },
      },
    );
  };

  return (
    <View className="relative mt-4 min-h-[220px] rounded-2xl border border-white/10 bg-white/5 p-3">
      <View className="mb-3 flex-row items-center justify-between">
        <View className="flex-row rounded-full bg-white/10 p-0.5">
          <TabButton
            label="Active offers"
            active={tab === "active"}
            disabled={cancelPending}
            onPress={() => setTab("active")}
          />
          <TabButton
            label="Completed"
            active={tab === "completed"}
            disabled={cancelPending}
            onPress={() => setTab("completed")}
          />
        </View>
        <DexRefreshButton
          refreshing={isRefreshing}
          disabled={cancelPending}
          onPress={refetch}
          size={20}
          accessibilityLabel="Refresh offers"
        />
      </View>

      {query.isLoading ? (
        <ActivityIndicator color="#8EDFE2" />
      ) : tab === "active" ? (
        <ActiveOffersList
          offers={(active.data ?? []) as BookOfferRow[]}
          walletAddress={walletAddress}
          onCancel={requestCancel}
          cancelPending={cancelPending}
        />
      ) : (
        <CompletedOffersList
          txs={(completed.data ?? []) as Record<string, unknown>[]}
          actionsDisabled={cancelPending}
        />
      )}

      {cancelPending && (
        <View
          className="absolute inset-0 z-10 items-center justify-center rounded-2xl bg-black/70"
          accessibilityLabel="Cancelling order"
        >
          <ActivityIndicator color="#8EDFE2" size="large" />
          <Text className="mt-2 text-xs text-white/80">Cancelling order…</Text>
        </View>
      )}
    </View>
  );
}

function TabButton({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`rounded-full px-3 py-1.5 ${active ? "border border-primary bg-primary/20" : ""} ${disabled ? "opacity-40" : ""}`}
    >
      <Text className={`text-xs font-medium ${active ? "text-primary" : "text-white/50"}`}>
        {label}
      </Text>
    </Pressable>
  );
}

function ActiveOffersList({
  offers,
  walletAddress,
  onCancel,
  cancelPending,
}: {
  offers: BookOfferRow[];
  walletAddress: string | null;
  onCancel: (seq: number) => void;
  cancelPending: boolean;
}) {
  if (!walletAddress) {
    return <Text className="text-sm text-white/50">Select a wallet</Text>;
  }
  if (offers.length === 0) {
    return <Text className="text-sm text-white/50">No active offers</Text>;
  }

  return (
    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
      {offers.map((o) => {
        const seq = Number(o.seq ?? o.Sequence ?? 0);
        const pays = offerLeg(o, "pays");
        const gets = offerLeg(o, "gets");
        return (
          <View
            key={String(seq)}
            className="mb-2 flex-row items-center justify-between border-b border-white/10 pb-2"
          >
            <View className="flex-1 pr-2">
              <Text className="text-xs text-white">Seq #{seq}</Text>
              <Text className="text-[10px] text-white/55">
                Want {formatActiveOfferLeg(pays)} · Pay {formatActiveOfferLeg(gets)}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                if (cancelPending) return;
                Alert.alert(
                  "Cancel offer?",
                  `Remove offer #${seq} from the order book?\n\nWant ${formatActiveOfferLeg(pays)} · Pay ${formatActiveOfferLeg(gets)}`,
                  [
                    { text: "Keep offer", style: "cancel" },
                    {
                      text: "Cancel offer",
                      style: "destructive",
                      onPress: () => onCancel(seq),
                    },
                  ],
                );
              }}
              disabled={cancelPending}
              className={`rounded-full border border-danger/50 px-2 py-1 ${cancelPending ? "opacity-40" : ""}`}
            >
              <Text className="text-[10px] text-danger">
                {cancelPending ? "Cancelling…" : "Cancel"}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </ScrollView>
  );
}

function CompletedOffersList({
  txs,
  actionsDisabled = false,
}: {
  txs: Record<string, unknown>[];
  actionsDisabled?: boolean;
}) {
  if (txs.length === 0) {
    return <Text className="text-sm text-white/50">No fulfilled orders yet</Text>;
  }

  return (
    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
      {txs.map((tx, i) => {
        const txJson = (tx.tx_json ?? tx.tx ?? tx) as Record<string, unknown>;
        const hash = String(tx.hash ?? txJson.hash ?? "");
        const date = rippleTimeToDate(
          (tx.date as number | undefined) ?? (txJson.date as number | undefined),
        );
        const pays = parseDexAsset(txJson.TakerPays ?? txJson.taker_pays);
        const gets = parseDexAsset(txJson.TakerGets ?? txJson.taker_gets);
        const meta = tx.meta as { TransactionResult?: string } | string | undefined;
        const result =
          typeof meta === "object" && meta?.TransactionResult
            ? meta.TransactionResult
            : typeof meta === "string"
              ? meta
              : "—";
        const ok = result === "tesSUCCESS";

        return (
          <View key={`${hash}-${i}`} className="mb-2 border-b border-white/10 pb-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-medium text-white">Fulfilled</Text>
              <Text className={`text-[10px] ${ok ? "text-emerald-400" : "text-danger"}`}>
                {result}
              </Text>
            </View>
            {(pays.currency !== "?" || gets.currency !== "?") && (
              <Text className="text-[10px] text-white/55">
                Gets {formatOfferQty(gets.value)} {gets.currency} · Pays {formatOfferQty(pays.value)}{" "}
                {pays.currency}
              </Text>
            )}
            {date && <Text className="text-[10px] text-white/40">{date}</Text>}
            {hash ? (
              <Pressable
                disabled={actionsDisabled}
                onPress={() => Linking.openURL(explorerUrl(hash))}
              >
                <Text
                  className={`mt-0.5 text-[10px] ${actionsDisabled ? "text-white/30" : "text-primary"}`}
                >
                  View on explorer
                </Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}
