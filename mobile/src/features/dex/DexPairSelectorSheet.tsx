import { Text, TouchableOpacity, View } from "react-native";
import { AppSheet } from "@/src/components/ui/AppSheet";
import { getCurrencyMeta } from "@/src/lib/currencyIcon";
import { DEX_PAIR_PRESETS, dexPairKey } from "@/src/lib/dex";
import { LpTokenIcon } from "@/src/features/shared/CurrencyIconImage";

interface DexPairSelectorSheetProps {
  visible: boolean;
  onClose: () => void;
  selectedBase?: string;
  selectedQuote?: string;
  onSelect: (base: string, quote: string) => void;
}

export function DexPairSelectorSheet({
  visible,
  onClose,
  selectedBase,
  selectedQuote,
  onSelect,
}: DexPairSelectorSheetProps) {
  const activeKey =
    selectedBase && selectedQuote ? dexPairKey(selectedBase, selectedQuote) : "";

  return (
    <AppSheet visible={visible} onClose={onClose} title="Select pair">
      {DEX_PAIR_PRESETS.map((p) => {
        const key = dexPairKey(p.base, p.quote);
        const isSelected = activeKey === key;
        const baseMeta = getCurrencyMeta(p.base);
        const quoteMeta = getCurrencyMeta(p.quote);
        return (
          <TouchableOpacity
            key={key}
            onPress={() => {
              onSelect(p.base, p.quote);
              onClose();
            }}
            className={`mb-2 flex-row items-center rounded-2xl border p-4 ${
              isSelected ? "border-primary bg-primary/10" : "border-white/10 bg-white/5"
            }`}
          >
            <LpTokenIcon currencyA={p.base} currencyB={p.quote} size={36} />
            <View className="ml-3 flex-1">
              <Text className="text-base font-semibold text-white">{key}</Text>
              <Text className="text-xs text-white/60">
                {baseMeta.name} / {quoteMeta.name}
              </Text>
            </View>
            {isSelected ? <Text className="text-primary">✓</Text> : null}
          </TouchableOpacity>
        );
      })}
    </AppSheet>
  );
}

/** Compact trigger showing the active pair with overlapping currency icons. */
export function DexPairDropdownTrigger({
  base,
  quote,
  onPress,
}: {
  base: string;
  quote: string;
  onPress: () => void;
}) {
  const baseMeta = getCurrencyMeta(base);
  const quoteMeta = getCurrencyMeta(quote);
  return (
    <TouchableOpacity
      onPress={onPress}
      className="mb-3 flex-row items-center rounded-xl border border-white/15 bg-white/5 px-3 py-2.5"
      activeOpacity={0.7}
    >
      <LpTokenIcon currencyA={base} currencyB={quote} size={32} />
      <View className="ml-2.5 flex-1">
        <Text className="text-sm font-semibold text-white">{dexPairKey(base, quote)}</Text>
        <Text className="text-[10px] text-white/50">
          {baseMeta.name} / {quoteMeta.name}
        </Text>
      </View>
      <Text className="ml-2 text-xs text-white/45">▼</Text>
    </TouchableOpacity>
  );
}
