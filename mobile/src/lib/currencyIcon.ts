import type { ImageSourcePropType } from "react-native";

const ICONS: Record<string, ImageSourcePropType> = {
  USD: require("../../assets/icons/USD.png"),
  XRP: require("../../assets/icons/XRP.png"),
  EUR: require("../../assets/icons/EUR.png"),
  BTC: require("../../assets/icons/BTC.png"),
  ETH: require("../../assets/icons/ETH.png"),
  SOL: require("../../assets/icons/SOL.png"),
};

const LP_TOKEN_FALLBACK: ImageSourcePropType = require("../../assets/icons/liquidity-pool-swap.png");

export interface YONACurrency {
  id: string;
  name: string;
  icon: ImageSourcePropType;
}

export const availableCurrencies: YONACurrency[] = [
  { id: "USD", name: "USD", icon: ICONS.USD },
  { id: "XRP", name: "XRP", icon: ICONS.XRP },
  { id: "EUR", name: "Euro", icon: ICONS.EUR },
  { id: "BTC", name: "Bitcoin", icon: ICONS.BTC },
  { id: "ETH", name: "Ethereum", icon: ICONS.ETH },
  { id: "SOL", name: "Solana", icon: ICONS.SOL },
];

export function getCurrencyIcon(currency: string): ImageSourcePropType | null {
  return ICONS[currency] ?? null;
}

export function getLpTokenFallbackIcon(): ImageSourcePropType {
  return LP_TOKEN_FALLBACK;
}

export function getCurrencyMeta(currency: string): YONACurrency {
  return availableCurrencies.find((c) => c.id === currency) ?? availableCurrencies[0];
}
