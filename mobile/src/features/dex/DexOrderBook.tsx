import { ActivityIndicator, Text, View } from "react-native";
import { DexRefreshButton } from "@/src/features/dex/DexRefreshButton";
import {
  buyOfferPrice,
  formatOfferPrice,
  formatOfferQty,
  offerBaseQuantity,
  sellOfferPrice,
  type BookOfferRow,
} from "@/src/lib/dex";

interface DexOrderBookProps {
  baseCurrency: string;
  quoteCurrency: string;
  sellOffers: BookOfferRow[];
  buyOffers: BookOfferRow[];
  isLoading: boolean;
  isRefreshing?: boolean;
  onRefresh: () => void;
}

function DepthRow({
  price,
  quantity,
  depthPct,
  tone,
}: {
  price: string;
  quantity: string;
  depthPct: number;
  tone: "sell" | "buy";
}) {
  const barColor = tone === "sell" ? "bg-danger/25" : "bg-emerald-500/25";
  const textColor = tone === "sell" ? "text-danger" : "text-emerald-400";
  return (
    <View className="relative mb-0.5 flex-row items-center justify-between py-0.5">
      <View
        className={`absolute right-0 top-0 bottom-0 ${barColor}`}
        style={{ width: `${Math.min(100, Math.max(8, depthPct))}%` }}
      />
      <Text className={`z-10 flex-1 text-[10px] font-medium ${textColor}`}>{price}</Text>
      <Text className="z-10 text-[10px] text-white/80">{quantity}</Text>
    </View>
  );
}

export function DexOrderBook({
  baseCurrency,
  quoteCurrency,
  sellOffers,
  buyOffers,
  isLoading,
  isRefreshing = false,
  onRefresh,
}: DexOrderBookProps) {
  const sortedSells = [...sellOffers].sort((a, b) => sellOfferPrice(b) - sellOfferPrice(a));
  const sortedBuys = [...buyOffers].sort((a, b) => buyOfferPrice(b) - buyOfferPrice(a));

  const sellQtys = sortedSells.map((o) => offerBaseQuantity(o, true));
  const buyQtys = sortedBuys.map((o) => offerBaseQuantity(o, false));
  const maxSellQty = Math.max(...sellQtys, 1);
  const maxBuyQty = Math.max(...buyQtys, 1);

  const bestAsk = sortedSells.length ? sellOfferPrice(sortedSells[sortedSells.length - 1]) : null;
  const bestBid = sortedBuys.length ? buyOfferPrice(sortedBuys[0]) : null;
  const mid =
    bestAsk != null && bestBid != null && bestAsk > 0
      ? (bestAsk + bestBid) / 2
      : bestAsk ?? bestBid ?? null;
  const spread =
    bestAsk != null && bestBid != null ? Math.abs(bestAsk - bestBid) : null;

  const displaySells = sortedSells.slice(0, 8);
  const displayBuys = sortedBuys.slice(0, 8);

  return (
    <View className="flex-1 rounded-2xl border border-white/10 bg-white/5 p-2">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-xs font-semibold text-white">Order book</Text>
        <DexRefreshButton
          refreshing={isRefreshing}
          onPress={onRefresh}
          accessibilityLabel="Refresh order book"
        />
      </View>

      <View className="mb-1 flex-row justify-between px-0.5">
        <Text className="text-[9px] text-white/50">Price ({quoteCurrency})</Text>
        <Text className="text-[9px] text-white/50">Amt ({baseCurrency})</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator className="my-6" color="#8EDFE2" />
      ) : (
        <>
          <View className="mb-1 min-h-[100px]">
            {displaySells.length === 0 ? (
              <Text className="py-2 text-center text-[10px] text-white/40">No asks</Text>
            ) : (
              displaySells.map((offer, i) => (
                <DepthRow
                  key={`sell-${i}`}
                  price={formatOfferPrice(sellOfferPrice(offer))}
                  quantity={formatOfferQty(offerBaseQuantity(offer, true))}
                  depthPct={(offerBaseQuantity(offer, true) / maxSellQty) * 100}
                  tone="sell"
                />
              ))
            )}
          </View>

          <View className="my-1 items-center border-y border-white/10 py-1.5">
            <Text className="text-sm font-semibold text-emerald-400">
              {mid != null ? formatOfferPrice(mid) : "—"}
            </Text>
            {spread != null && (
              <Text className="text-[9px] text-white/45">
                Spread {formatOfferPrice(spread)}
              </Text>
            )}
          </View>

          <View className="min-h-[100px]">
            {displayBuys.length === 0 ? (
              <Text className="py-2 text-center text-[10px] text-white/40">No bids</Text>
            ) : (
              displayBuys.map((offer, i) => (
                <DepthRow
                  key={`buy-${i}`}
                  price={formatOfferPrice(buyOfferPrice(offer))}
                  quantity={formatOfferQty(offerBaseQuantity(offer, false))}
                  depthPct={(offerBaseQuantity(offer, false) / maxBuyQty) * 100}
                  tone="buy"
                />
              ))
            )}
          </View>
        </>
      )}
    </View>
  );
}
