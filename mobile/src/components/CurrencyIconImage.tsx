import { Image, Text, View } from "react-native";
import { getCurrencyIcon } from "@/src/lib/currencyIcon";

export function CurrencyIconImage({
  currency,
  size = 40,
}: {
  currency: string;
  size?: number;
}) {
  const src = getCurrencyIcon(currency);
  if (src) {
    return (
      <Image
        source={src}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        resizeMode="cover"
      />
    );
  }
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2 }}
      className="items-center justify-center bg-white/15"
    >
      <Text className="text-xs font-bold text-white">
        {currency ? currency.substring(0, 2).toUpperCase() : "?"}
      </Text>
    </View>
  );
}

export function LpTokenIcon({
  currencyA,
  currencyB,
  size = 40,
}: {
  currencyA: string;
  currencyB: string;
  size?: number;
}) {
  const iconSize = Math.round(size * 0.7);
  return (
    <View style={{ width: size, height: size }} className="relative">
      <View style={{ position: "absolute", top: 0, left: 0, zIndex: 10 }}>
        <CurrencyIconImage currency={currencyA} size={iconSize} />
      </View>
      <View style={{ position: "absolute", bottom: 0, right: 0, zIndex: 20 }}>
        <CurrencyIconImage currency={currencyB} size={iconSize} />
      </View>
    </View>
  );
}
