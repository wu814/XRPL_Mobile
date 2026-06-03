import { Text, TouchableOpacity, View } from "react-native";

export function StickyActions({
  canAct,
  onSmartTrade,
  onSend,
}: {
  canAct: boolean;
  onSmartTrade: () => void;
  onSend: () => void;
}) {
  return (
    <View className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-black/95 px-6 pb-6 pt-3">
      <View className="flex-row">
        <TouchableOpacity
          onPress={onSmartTrade}
          disabled={!canAct}
          className={`mr-2 flex-1 items-center rounded-2xl py-3 ${canAct ? "bg-primary" : "bg-white/10"}`}
        >
          <Text className={`text-base font-semibold ${canAct ? "text-black" : "text-white/40"}`}>
            Smart Trade
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onSend}
          disabled={!canAct}
          className={`ml-2 flex-1 items-center rounded-2xl py-3 ${canAct ? "bg-accent" : "bg-white/10"}`}
        >
          <Text className={`text-base font-semibold ${canAct ? "text-black" : "text-white/40"}`}>
            Send
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
