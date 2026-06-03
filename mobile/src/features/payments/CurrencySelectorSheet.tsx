import { Text, TouchableOpacity, View } from "react-native";
import { AppSheet } from "@/src/components/ui/AppSheet";
import { availableCurrencies } from "@/src/lib/currencyIcon";
import { CurrencyIconImage } from "@/src/features/shared/CurrencyIconImage";

interface CurrencySelectorListProps {
  onSelect: (currency: string) => void;
  exclude?: string;
  selected?: string;
  disabledIds?: string[];
}

export function CurrencySelectorList({
  onSelect,
  exclude,
  selected,
  disabledIds,
}: CurrencySelectorListProps) {
  return (
    <>
      {availableCurrencies
        .filter((c) => c.id !== exclude)
        .map((c) => {
          const isSelected = selected === c.id;
          const isDisabled = disabledIds?.includes(c.id) ?? false;
          return (
            <TouchableOpacity
              key={c.id}
              disabled={isDisabled}
              onPress={() => onSelect(c.id)}
              className={`mb-2 flex-row items-center rounded-2xl border p-4 ${
                isDisabled
                  ? "border-white/5 bg-white/[0.02] opacity-40"
                  : isSelected
                    ? "border-primary bg-primary/10"
                    : "border-white/10 bg-white/5"
              }`}
            >
              <CurrencyIconImage currency={c.id} size={32} />
              <View className="ml-3 flex-1">
                <Text className="text-base font-semibold text-white">{c.id}</Text>
                <Text className="text-xs text-white/60">
                  {isDisabled ? "Not available" : c.name}
                </Text>
              </View>
              {isSelected && !isDisabled ? <Text className="text-primary">✓</Text> : null}
            </TouchableOpacity>
          );
        })}
    </>
  );
}

interface CurrencySelectorSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (currency: string) => void;
  exclude?: string;
  selected?: string;
  disabledIds?: string[];
}

export function CurrencySelectorSheet({
  visible,
  onClose,
  onSelect,
  exclude,
  selected,
  disabledIds,
}: CurrencySelectorSheetProps) {
  return (
    <AppSheet visible={visible} onClose={onClose} title="Select Currency">
      <CurrencySelectorList
        onSelect={onSelect}
        exclude={exclude}
        selected={selected}
        disabledIds={disabledIds}
      />
    </AppSheet>
  );
}
