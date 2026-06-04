import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView as RNScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { AppScrollView } from "@/src/components/ui/AppScrollView";
import { Screen } from "@/src/components/ui/Screen";
import { Stack } from "expo-router";
import { useWallets } from "@/src/hooks/useWallets";
import { useBuyNFT, useMintAndListNFT, useNftsByAccount } from "@/src/hooks/useNft";
import {
  missingNftWalletMessage,
  nftWalletsForPicker,
  resolveNftWallet,
} from "@/src/lib/featureWallet";
import { useAuthStore } from "@/src/stores/auth";

export default function NftScreen() {
  const isAdmin = useAuthStore((s) => s.profile?.role) === "ADMIN";
  const wallets = useWallets();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  const defaultNftWallet = useMemo(
    () => resolveNftWallet(wallets.data, isAdmin),
    [wallets.data, isAdmin],
  );

  const pickerWallets = useMemo(
    () => nftWalletsForPicker(wallets.data, isAdmin),
    [wallets.data, isAdmin],
  );

  const selected = isAdmin
    ? (walletAddress ?? defaultNftWallet.address ?? pickerWallets[0]?.classic_address ?? null)
    : (defaultNftWallet.address ?? pickerWallets[0]?.classic_address ?? null);

  const selectedWallet = useMemo(
    () => pickerWallets.find((w) => w.classic_address === selected) ?? defaultNftWallet.wallet,
    [pickerWallets, selected, defaultNftWallet.wallet],
  );

  const nfts = useNftsByAccount(selected ?? undefined);
  const mintMut = useMintAndListNFT();
  const buyMut = useBuyNFT();

  const [uri, setUri] = useState("https://example.com/nft.json");
  const [price, setPrice] = useState("1");
  const [offerID, setOfferID] = useState("");

  const onMint = async () => {
    if (!selected) return Alert.alert("Wallet", missingNftWalletMessage(isAdmin));
    try {
      const res = await mintMut.mutateAsync({
        walletAddress: selected,
        uri,
        priceXrp: Number(price),
      });
      Alert.alert("NFT minted + listed", `Offer: ${res.offerID}`);
    } catch (err) {
      Alert.alert("Mint failed", (err as Error).message);
    }
  };

  const onBuy = async () => {
    if (!selected || !offerID) return;
    try {
      await buyMut.mutateAsync({ walletAddress: selected, offerID });
      setOfferID("");
      Alert.alert("Purchase complete");
    } catch (err) {
      Alert.alert("Buy failed", (err as Error).message);
    }
  };

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: "NFT",
          headerStyle: { backgroundColor: "#000" },
          headerTintColor: "#fff",
        }}
      />
      <AppScrollView contentContainerClassName="px-6 py-6">
        <Text className="mb-1 text-3xl font-bold text-white">NFT</Text>
        <Text className="mb-6 text-white/60">Mint and trade XRPL NFTs (Testnet)</Text>

        {!selected && !wallets.isLoading ? (
          <View className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
            <Text className="text-xs text-amber-200">{missingNftWalletMessage(isAdmin)}</Text>
          </View>
        ) : null}

        {isAdmin ? (
          <>
            <Text className="mb-2 text-xs uppercase tracking-wider text-white/50">Wallet</Text>
            <RNScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5">
              {pickerWallets.map((w) => {
                const isSel = selected === w.classic_address;
                return (
                  <TouchableOpacity
                    key={w.id}
                    onPress={() => setWalletAddress(w.classic_address)}
                    className={`mr-2 rounded-full px-3 py-2 ${isSel ? "bg-primary" : "border border-white/20"}`}
                  >
                    <Text
                      className={`text-xs font-semibold uppercase ${isSel ? "text-black" : "text-white"}`}
                    >
                      {w.wallet_type.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </RNScrollView>
          </>
        ) : null}

        <View className="mb-5 rounded-2xl border border-white/10 p-5">
          <Text className="mb-3 text-sm uppercase tracking-wider text-white/50">Mint + list</Text>
          <TextInput
            value={uri}
            onChangeText={setUri}
            placeholder="https://..."
            placeholderTextColor="#666"
            autoCapitalize="none"
            className="mb-3 rounded-xl border border-white/15 px-3 py-2 text-white"
          />
          <TextInput
            value={price}
            onChangeText={setPrice}
            placeholder="Price in XRP"
            placeholderTextColor="#666"
            keyboardType="decimal-pad"
            className="mb-3 rounded-xl border border-white/15 px-3 py-2 text-white"
          />
          <TouchableOpacity
            onPress={onMint}
            disabled={!selected || mintMut.isPending}
            className="items-center rounded-2xl bg-primary py-3"
          >
            {mintMut.isPending ? (
              <ActivityIndicator />
            ) : (
              <Text className="text-base font-semibold text-black">Mint and list</Text>
            )}
          </TouchableOpacity>
        </View>

        <View className="mb-5 rounded-2xl border border-white/10 p-5">
          <Text className="mb-3 text-sm uppercase tracking-wider text-white/50">
            Buy by offer ID
          </Text>
          <TextInput
            value={offerID}
            onChangeText={setOfferID}
            placeholder="Offer ID (64-char hex)"
            placeholderTextColor="#666"
            autoCapitalize="none"
            className="mb-3 rounded-xl border border-white/15 px-3 py-2 text-white"
          />
          <TouchableOpacity
            onPress={onBuy}
            disabled={!selected || buyMut.isPending}
            className="items-center rounded-2xl bg-primary py-3"
          >
            {buyMut.isPending ? (
              <ActivityIndicator />
            ) : (
              <Text className="text-base font-semibold text-black">Buy</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text className="mb-3 text-lg font-semibold text-white">
          {isAdmin && selectedWallet
            ? `Owned by ${selectedWallet.wallet_type.toUpperCase()} wallet`
            : "Your NFTs"}
        </Text>
        {nfts.isLoading ? (
          <ActivityIndicator />
        ) : nfts.data && nfts.data.length > 0 ? (
          nfts.data.map((n) => (
            <View key={n.NFTokenID} className="mb-3 rounded-2xl border border-white/10 p-4">
              <Text className="mb-1 text-xs text-white/60">NFTokenID</Text>
              <Text className="font-mono text-xs text-white">{n.NFTokenID}</Text>
            </View>
          ))
        ) : (
          <Text className="text-white/50">No NFTs yet for this wallet</Text>
        )}
      </AppScrollView>
    </Screen>
  );
}
