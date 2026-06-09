import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { DexRefreshButton } from "@/src/features/dex/DexRefreshButton";
import type { PastDexOffer } from "@/src/api/dex";
import {
  formatOfferPrice,
  formatOrderAmount,
  formatOrderDate,
  offerBaseAsset,
  offerLimitPrice,
  offerQuoteCurrency,
  offerTitle,
  type BookOfferRow,
} from "@/src/lib/dex";
import { useCancelOffer, useCompletedOffers, useUserOffers } from "@/src/hooks/useDex";

type OrdersTab = "open" | "past";

interface DexOrdersPanelProps {
  walletAddress: string | null;
}

export function DexOrdersPanel({ walletAddress }: DexOrdersPanelProps) {
  const [tab, setTab] = useState<OrdersTab>("open");
  const active = useUserOffers(walletAddress ?? undefined);
  const completed = useCompletedOffers(walletAddress ?? undefined);
  const cancelMut = useCancelOffer();

  const query = tab === "open" ? active : completed;
  const [isRefreshing, setIsRefreshing] = useState(false);
  const cancelPending = cancelMut.isPending;

  const refetch = () => {
    if (cancelPending) return;
    setIsRefreshing(true);
    const p = tab === "open" ? active.refetch() : completed.refetch();
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

  const confirmCancel = (seq: number, title: string) => {
    if (cancelPending) return;
    Alert.alert("Cancel order?", `Remove ${title} from the order book?`, [
      { text: "Keep order", style: "cancel" },
      {
        text: "Cancel order",
        style: "destructive",
        onPress: () => requestCancel(seq),
      },
    ]);
  };

  const cancelAll = (offers: BookOfferRow[]) => {
    if (!walletAddress || cancelPending || offers.length === 0) return;
    Alert.alert(
      "Cancel all orders?",
      `Cancel ${offers.length} open order${offers.length === 1 ? "" : "s"}?`,
      [
        { text: "Keep orders", style: "cancel" },
        {
          text: "Cancel all",
          style: "destructive",
          onPress: async () => {
            for (const o of offers) {
              const seq = Number(o.seq ?? o.Sequence ?? 0);
              if (!seq) continue;
              try {
                await cancelMut.mutateAsync({ walletAddress, sequence: seq });
              } catch (err) {
                Alert.alert("Cancel failed", (err as Error).message);
                break;
              }
            }
          },
        },
      ],
    );
  };

  const openOffers = (active.data ?? []) as BookOfferRow[];

  return (
    <View className="relative mt-4 min-h-[220px] rounded-2xl border border-white/10 bg-white/5 p-3">
      <View className="mb-3 flex-row items-center justify-between">
        <View className="flex-row rounded-full bg-white/10 p-0.5">
          <TabButton
            label="Open"
            active={tab === "open"}
            disabled={cancelPending}
            onPress={() => setTab("open")}
          />
          <TabButton
            label="Past"
            active={tab === "past"}
            disabled={cancelPending}
            onPress={() => setTab("past")}
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

      {tab === "open" && openOffers.length > 0 && !query.isLoading && (
        <View className="mb-2 flex-row justify-end">
          <Pressable onPress={() => cancelAll(openOffers)} disabled={cancelPending}>
            <Text className={`text-sm text-danger ${cancelPending ? "opacity-40" : ""}`}>
              Cancel all
            </Text>
          </Pressable>
        </View>
      )}

      {query.isLoading ? (
        <ActivityIndicator color="#8EDFE2" />
      ) : tab === "open" ? (
        <OpenOffersList
          offers={openOffers}
          walletAddress={walletAddress}
          onCancel={confirmCancel}
          cancelPending={cancelPending}
        />
      ) : (
        <PastOffersList orders={completed.data ?? []} />
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

function OrderHistoryRow({
  variant,
  title,
  status,
  date,
  amount,
  price,
  quote,
  onPress,
  disabled,
}: {
  variant: "open" | "past";
  title: string;
  status: string;
  date: string | null;
  amount: string;
  price: number;
  quote: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const isOpen = variant === "open";
  const titleClass = isOpen ? "text-sm font-semibold text-white" : "text-sm font-semibold text-white/50";
  const statusClass = isOpen ? "text-sm text-emerald-400" : "text-sm text-white/45";
  const dateClass = isOpen ? "text-sm text-white/45" : "text-sm text-white/45";
  const amountClass = isOpen ? "text-sm text-white" : "text-sm text-white/50";
  const priceClass = isOpen ? "text-sm text-white/45" : "text-sm text-white/40";

  const content = (
    <View className="flex-row items-start justify-between py-3">
      <View className="flex-1 pr-3">
        <Text className={titleClass}>{title}</Text>
        <View className="mt-0.5 flex-row flex-wrap items-center">
          <Text className={statusClass}>{status}</Text>
          {date ? (
            <Text className={dateClass}>
              {" · "}
              {date}
            </Text>
          ) : null}
        </View>
      </View>
      <View className="items-end">
        <Text className={amountClass}>{amount}</Text>
        <Text className={`mt-0.5 ${priceClass}`}>
          @ {formatOfferPrice(price)} {quote}
        </Text>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} disabled={disabled} className={disabled ? "opacity-40" : ""}>
        {content}
      </Pressable>
    );
  }

  return content;
}

function OpenOffersList({
  offers,
  walletAddress,
  onCancel,
  cancelPending,
}: {
  offers: BookOfferRow[];
  walletAddress: string | null;
  onCancel: (seq: number, title: string) => void;
  cancelPending: boolean;
}) {
  if (!walletAddress) {
    return <Text className="text-sm text-white/50">Select a wallet</Text>;
  }
  if (offers.length === 0) {
    return <Text className="text-sm text-white/50">No open orders</Text>;
  }

  return (
    <ScrollView style={{ maxHeight: 280 }} nestedScrollEnabled>
      {offers.map((o) => {
        const seq = Number(o.seq ?? o.Sequence ?? 0);
        const title = offerTitle(o);
        const base = offerBaseAsset(o);
        const quote = offerQuoteCurrency(o);
        return (
          <OrderHistoryRow
            key={String(seq)}
            variant="open"
            title={title}
            status="Open"
            date={null}
            amount={formatOrderAmount(base)}
            price={offerLimitPrice(o)}
            quote={quote}
            onPress={() => onCancel(seq, title)}
            disabled={cancelPending}
          />
        );
      })}
    </ScrollView>
  );
}

function pastOfferRow(offer: PastDexOffer) {
  const bookOffer: BookOfferRow = {
    TakerGets: offer.takerGets,
    TakerPays: offer.takerPays,
    flags: offer.flags,
  };
  return {
    title: offerTitle(bookOffer),
    status: offer.status === "cancelled" ? "Cancelled" : "Filled",
    date: formatOrderDate(offer.date),
    amount: formatOrderAmount(offerBaseAsset(bookOffer)),
    price: offerLimitPrice(bookOffer),
    quote: offerQuoteCurrency(bookOffer),
  };
}

function PastOffersList({ orders }: { orders: PastDexOffer[] }) {
  if (orders.length === 0) {
    return <Text className="text-sm text-white/50">No past orders yet</Text>;
  }

  return (
    <ScrollView style={{ maxHeight: 280 }} nestedScrollEnabled>
      {orders.map((order) => {
        const row = pastOfferRow(order);
        return (
          <OrderHistoryRow
            key={order.hash}
            variant="past"
            title={row.title}
            status={row.status}
            date={row.date}
            amount={row.amount}
            price={row.price}
            quote={row.quote}
          />
        );
      })}
    </ScrollView>
  );
}
