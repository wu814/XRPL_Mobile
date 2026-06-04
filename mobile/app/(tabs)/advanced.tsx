import { Image, ImageSourcePropType, Text, TouchableOpacity, View } from "react-native";
import { AppScrollView } from "@/src/components/ui/AppScrollView";
import { Screen } from "@/src/components/ui/Screen";
import { useRouter } from "expo-router";

interface Card {
  title: string;
  subtitle: string;
  path: string;
  icon: ImageSourcePropType;
}

const CARDS: Card[] = [
  {
    title: "AMM",
    subtitle: "Automated market maker pools",
    path: "/advanced/amm",
    icon: require("../../assets/icons/amm.png"),
  },
  {
    title: "DEX",
    subtitle: "XRPL decentralized exchange offers",
    path: "/advanced/dex",
    icon: require("../../assets/icons/dex.png"),
  },
  {
    title: "NFT",
    subtitle: "Mint and trade NFTs",
    path: "/advanced/nft",
    icon: require("../../assets/icons/nft.png"),
  },
];

export default function AdvancedScreen() {
  const router = useRouter();

  return (
    <Screen>
      <AppScrollView contentContainerClassName="px-6 py-6">
        <Text className="mb-1 text-3xl font-bold text-white">Advanced</Text>
        <Text className="mb-6 text-white/60">Pro tools for XRPL trading</Text>

        {CARDS.map((card) => (
          <TouchableOpacity
            key={card.title}
            onPress={() => router.push(card.path as any)}
            className="mb-4 flex-row items-center rounded-2xl border border-white/10 bg-white/5 p-5"
          >
            <View className="mr-4 h-14 w-14 items-center justify-center rounded-2xl bg-primary/15">
              <Image source={card.icon} style={{ width: 40, height: 40 }} resizeMode="contain" />
            </View>
            <View className="flex-1">
              <Text className="mb-1 text-xl font-bold text-white">{card.title}</Text>
              <Text className="text-sm text-white/60">{card.subtitle}</Text>
            </View>
            <Text className="text-2xl text-white/40">›</Text>
          </TouchableOpacity>
        ))}
      </AppScrollView>
    </Screen>
  );
}
