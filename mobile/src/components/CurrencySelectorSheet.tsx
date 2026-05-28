import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { availableCurrencies } from "@/src/lib/currencyIcon";
import { CurrencyIconImage } from "./CurrencyIconImage";

interface CurrencySelectorSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (currency: string) => void;
  exclude?: string;
  selected?: string;
}

export function CurrencySelectorSheet({
  visible,
  onClose,
  onSelect,
  exclude,
  selected,
}: CurrencySelectorSheetProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <SafeAreaView className="flex-1 bg-black">
        <View className="border-b border-white/10 px-6 py-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-xl font-bold text-white">Select Currency</Text>
            <TouchableOpacity onPress={onClose}>
              <Text className="text-white/60">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
        <ScrollView contentContainerClassName="px-4 py-2">
          {availableCurrencies
            .filter((c) => c.id !== exclude)
            .map((c) => {
              const isSelected = selected === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => onSelect(c.id)}
                  className={`mb-2 flex-row items-center rounded-2xl border p-4 ${isSelected ? "border-primary bg-primary/10" : "border-white/10 bg-white/5"}`}
                >
                  <CurrencyIconImage currency={c.id} size={32} />
                  <View className="ml-3 flex-1">
                    <Text className="text-base font-semibold text-white">{c.id}</Text>
                    <Text className="text-xs text-white/60">{c.name}</Text>
                  </View>
                  {isSelected ? <Text className="text-primary">✓</Text> : null}
                </TouchableOpacity>
              );
            })}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
