import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  buildCreateOfferFlags,
  buildOfferAmounts,
  formatExecutionDescription,
  formatPostOnlyDescription,
  OFFER_EXECUTION_OPTIONS,
  type DexCurrencyPair,
  type DexOrderSide,
} from "@/src/lib/dex";
import { useCreateOffer } from "@/src/hooks/useDex";
import type { OfferExecution } from "@/src/api/dex";
import {
  DexPairDropdownTrigger,
  DexPairSelectorSheet,
} from "@/src/features/dex/DexPairSelectorSheet";

interface DexPlaceOrderProps {
  walletAddress: string | null;
  pair: DexCurrencyPair | null;
  onPairChange: (base: string, quote: string) => void;
}

export function DexPlaceOrder({ walletAddress, pair, onPairChange }: DexPlaceOrderProps) {
  const createMut = useCreateOffer();
  const [side, setSide] = useState<DexOrderSide>("buy");
  const [limitPrice, setLimitPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [execution, setExecution] = useState<OfferExecution>("gtc");
  const [postOnly, setPostOnly] = useState(false);
  const [pairSheetOpen, setPairSheetOpen] = useState(false);

  const executionDescription = formatExecutionDescription(execution);
  const postOnlyEnabled = execution === "gtc";
  const postOnlyDescription = formatPostOnlyDescription(postOnlyEnabled);

  const total = useMemo(() => {
    const p = Number(limitPrice);
    const q = Number(quantity);
    if (!p || !q) return null;
    return p * q;
  }, [limitPrice, quantity]);

  const setExecutionMode = (mode: OfferExecution) => {
    setExecution(mode);
    if (mode !== "gtc") setPostOnly(false);
  };

  const onSubmit = async () => {
    if (!walletAddress) {
      return Alert.alert("Pathfind wallet", "Create a pathfind wallet before placing orders.");
    }
    if (!pair?.issuerAddress) return Alert.alert("Issuer", "No issuer wallet on Testnet yet");
    const price = Number(limitPrice);
    const qty = Number(quantity);
    if (!price || !qty || price <= 0 || qty <= 0) {
      return Alert.alert("Amounts", "Enter a positive limit price and quantity");
    }
    const flags = buildCreateOfferFlags(execution, postOnly, side);
    try {
      const { takerPays, takerGets } = buildOfferAmounts({
        side,
        base: pair.base,
        quote: pair.quote,
        issuerAddress: pair.issuerAddress,
        limitPrice: price,
        quantity: qty,
      });
      await createMut.mutateAsync({
        walletAddress,
        takerPays,
        takerGets,
        ...flags,
      });
      setLimitPrice("");
      setQuantity("");
      Alert.alert("Submitted", "Offer submitted to the ledger");
    } catch (err) {
      Alert.alert("Failed", (err as Error).message);
    }
  };

  const canPlace = Boolean(walletAddress);

  return (
    <View className="flex-1 rounded-2xl border border-white/10 bg-white/5 p-3">
      <Text className="mb-2 text-xs font-semibold text-white">Place order</Text>
      {!canPlace ? (
        <Text className="mb-3 text-[10px] leading-4 text-amber-200/90">
          Orders are placed from the pathfind wallet. Create one on the admin Home screen.
        </Text>
      ) : null}

      <Text className="mb-1 text-[10px] text-white/55">Pair</Text>
      {pair ? (
        <DexPairDropdownTrigger
          base={pair.base}
          quote={pair.quote}
          onPress={() => setPairSheetOpen(true)}
        />
      ) : (
        <Pressable
          onPress={() => setPairSheetOpen(true)}
          className="mb-3 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5"
        >
          <Text className="text-sm text-white/60">Select trading pair</Text>
        </Pressable>
      )}

      <DexPairSelectorSheet
        visible={pairSheetOpen}
        onClose={() => setPairSheetOpen(false)}
        selectedBase={pair?.base}
        selectedQuote={pair?.quote}
        onSelect={onPairChange}
      />

      <View className="mb-3 flex-row rounded-full bg-white/10 p-0.5">
        {(["buy", "sell"] as const).map((s) => (
          <Pressable
            key={s}
            onPress={() => setSide(s)}
            className={`flex-1 rounded-full py-2 ${side === s ? (s === "buy" ? "bg-emerald-500" : "bg-danger") : ""}`}
          >
            <Text
              className={`text-center text-xs font-semibold capitalize ${
                side === s ? "text-black" : "text-white/60"
              }`}
            >
              {s}
            </Text>
          </Pressable>
        ))}
      </View>

      {pair && (
        <Text className="mb-2 text-[10px] text-white/50">
          {side === "buy"
            ? `Buy ${pair.base} with ${pair.quote}`
            : `Sell ${pair.base} for ${pair.quote}`}
        </Text>
      )}

      <Text className="mb-0.5 text-[10px] text-white/55">Limit price ({pair?.quote ?? "—"})</Text>
      <TextInput
        value={limitPrice}
        onChangeText={setLimitPrice}
        keyboardType="decimal-pad"
        placeholder="0.00"
        placeholderTextColor="#666"
        className="mb-2 rounded-lg border border-white/15 px-2 py-1.5 text-sm text-white"
      />

      <Text className="mb-0.5 text-[10px] text-white/55">Quantity ({pair?.base ?? "—"})</Text>
      <TextInput
        value={quantity}
        onChangeText={setQuantity}
        keyboardType="decimal-pad"
        placeholder="0.00"
        placeholderTextColor="#666"
        className="mb-2 rounded-lg border border-white/15 px-2 py-1.5 text-sm text-white"
      />

      {total != null && pair && (
        <Text className="mb-2 text-[10px] text-white/60">
          Total ≈ {total.toFixed(4)} {pair.quote}
        </Text>
      )}

      <Text className="mb-1 text-[10px] text-white/55">Execution</Text>
      <View className="mb-1 flex-row rounded-full bg-white/10 p-0.5">
        {OFFER_EXECUTION_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            onPress={() => setExecutionMode(opt.value)}
            className={`flex-1 rounded-full py-1.5 ${execution === opt.value ? "bg-accent" : ""}`}
          >
            <Text
              className={`text-center text-[10px] font-semibold ${
                execution === opt.value ? "text-black" : "text-white/60"
              }`}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text className="mb-2 text-[10px] leading-4 text-white/45">{executionDescription}</Text>

      <Pressable
        onPress={() => postOnlyEnabled && setPostOnly((v) => !v)}
        disabled={!postOnlyEnabled}
        className={`mb-3 flex-row items-center justify-between rounded-lg border px-2 py-2 ${
          postOnlyEnabled ? "border-white/15" : "border-white/5 opacity-40"
        }`}
      >
        <Text className="flex-1 pr-2 text-[10px] leading-4 text-white/45">{postOnlyDescription}</Text>
        <View
          className={`h-5 w-9 rounded-full p-0.5 ${postOnly && postOnlyEnabled ? "bg-accent" : "bg-white/20"}`}
        >
          <View
            className={`h-4 w-4 rounded-full bg-white ${postOnly && postOnlyEnabled ? "ml-auto" : ""}`}
          />
        </View>
      </Pressable>

      <Pressable
        onPress={onSubmit}
        disabled={createMut.isPending || !canPlace}
        className={`items-center rounded-xl py-2.5 ${
          !canPlace ? "bg-white/15" : side === "buy" ? "bg-emerald-500" : "bg-danger"
        }`}
      >
        {createMut.isPending ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text className={`text-sm font-semibold ${canPlace ? "text-black" : "text-white/40"}`}>
            {side === "buy" ? "Buy" : "Sell"} {pair?.base ?? ""}
          </Text>
        )}
      </Pressable>
    </View>
  );
}
