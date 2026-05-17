import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useWallets } from "@/src/hooks/useWallets";
import { useCancelOffer, useCreateOffer, useUserOffers } from "@/src/hooks/useDex";
import { shortAddress, xrpToDrops } from "@/src/lib/formatters";
import type { OfferKind } from "@/src/api/dex";

const KINDS: OfferKind[] = ["limit", "ioc", "fok", "passive", "sell"];

export default function TradeScreen() {
  const wallets = useWallets();
  const [selected, setSelected] = useState<string | null>(null);
  const walletAddress = selected ?? wallets.data?.[0]?.classic_address ?? null;

  const offers = useUserOffers(walletAddress ?? undefined);
  const createMut = useCreateOffer();
  const cancelMut = useCancelOffer();

  const [pays, setPays] = useState(""); // XRP amount the offerer wants
  const [gets, setGets] = useState(""); // XRP amount the offerer gives
  const [kind, setKind] = useState<OfferKind>("limit");

  const onCreate = async () => {
    if (!walletAddress) return Alert.alert("Pick a wallet first");
    const paysNum = Number(pays);
    const getsNum = Number(gets);
    if (!paysNum || !getsNum) return Alert.alert("Enter both XRP amounts");
    try {
      await createMut.mutateAsync({
        walletAddress,
        takerPays: xrpToDrops(paysNum),
        takerGets: xrpToDrops(getsNum),
        kind,
      });
      setPays("");
      setGets("");
      Alert.alert("Offer submitted");
    } catch (err) {
      Alert.alert("Offer failed", (err as Error).message);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <ScrollView contentContainerClassName="px-6 py-6">
        <Text className="mb-1 text-3xl font-bold text-white">Trade</Text>
        <Text className="mb-6 text-white/60">Place XRP/XRP test offers (DEX)</Text>

        <Text className="mb-2 text-sm uppercase tracking-wider text-white/50">Wallet</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5">
          {(wallets.data ?? []).map((w) => {
            const isSelected = walletAddress === w.classic_address;
            return (
              <TouchableOpacity
                key={w.id}
                onPress={() => setSelected(w.classic_address)}
                className={`mr-2 rounded-full px-4 py-2 ${isSelected ? "bg-primary" : "border border-white/20"}`}
              >
                <Text className={`text-xs ${isSelected ? "text-black" : "text-white"}`}>
                  {shortAddress(w.classic_address)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View className="mb-5 rounded-2xl border border-white/10 p-5">
          <Text className="mb-3 text-sm uppercase tracking-wider text-white/50">New offer (XRP for XRP)</Text>

          <Text className="mb-1 text-xs text-white/60">You give (XRP)</Text>
          <TextInput
            value={gets}
            onChangeText={setGets}
            keyboardType="decimal-pad"
            placeholder="0.0"
            placeholderTextColor="#666"
            className="mb-3 rounded-xl border border-white/15 px-3 py-2 text-white"
          />

          <Text className="mb-1 text-xs text-white/60">You receive (XRP)</Text>
          <TextInput
            value={pays}
            onChangeText={setPays}
            keyboardType="decimal-pad"
            placeholder="0.0"
            placeholderTextColor="#666"
            className="mb-3 rounded-xl border border-white/15 px-3 py-2 text-white"
          />

          <Text className="mb-1 text-xs text-white/60">Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
            {KINDS.map((k) => (
              <TouchableOpacity
                key={k}
                onPress={() => setKind(k)}
                className={`mr-2 rounded-full px-3 py-2 ${kind === k ? "bg-accent" : "border border-white/20"}`}
              >
                <Text className={`text-xs ${kind === k ? "text-black" : "text-white"}`}>{k}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            onPress={onCreate}
            disabled={createMut.isPending}
            className="items-center rounded-2xl bg-primary py-3"
          >
            {createMut.isPending ? (
              <ActivityIndicator />
            ) : (
              <Text className="text-base font-semibold text-black">Submit offer</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text className="mb-3 text-lg font-semibold text-white">Your active offers</Text>
        {offers.isLoading ? (
          <ActivityIndicator />
        ) : offers.data && offers.data.length > 0 ? (
          (offers.data as any[]).map((o) => (
            <View key={String(o.seq)} className="mb-3 rounded-2xl border border-white/10 p-4">
              <Text className="mb-1 text-white">Seq #{o.seq}</Text>
              <Text className="mb-1 text-xs text-white/60">
                Taker pays {typeof o.taker_pays === "string" ? `${Number(o.taker_pays) / 1_000_000} XRP` : `${o.taker_pays.value} ${o.taker_pays.currency}`}
              </Text>
              <Text className="mb-2 text-xs text-white/60">
                Taker gets {typeof o.taker_gets === "string" ? `${Number(o.taker_gets) / 1_000_000} XRP` : `${o.taker_gets.value} ${o.taker_gets.currency}`}
              </Text>
              <TouchableOpacity
                onPress={() =>
                  walletAddress &&
                  cancelMut.mutate({ walletAddress, sequence: Number(o.seq) })
                }
                className="self-start rounded-full border border-danger/50 px-3 py-1"
              >
                <Text className="text-xs text-danger">Cancel</Text>
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <Text className="text-white/50">No active offers</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
