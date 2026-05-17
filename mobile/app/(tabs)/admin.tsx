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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminBootstrap,
  adminFundWallet,
  adminIssue,
  adminPromote,
  adminWallets,
} from "@/src/api/admin";
import { shortAddress } from "@/src/lib/formatters";

export default function AdminScreen() {
  const qc = useQueryClient();
  const wallets = useQuery({ queryKey: ["admin", "wallets"], queryFn: adminWallets });

  const bootstrapMut = useMutation({
    mutationFn: adminBootstrap,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "wallets"] }),
  });

  const issueMut = useMutation({ mutationFn: adminIssue });
  const fundMut = useMutation({ mutationFn: adminFundWallet });
  const promoteMut = useMutation({ mutationFn: adminPromote });

  const [destination, setDestination] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [value, setValue] = useState("100");
  const [fundAddr, setFundAddr] = useState("");
  const [promoteEmail, setPromoteEmail] = useState("");

  const issuer = wallets.data?.find((w) => w.wallet_type === "issuer");
  const treasury = wallets.data?.find((w) => w.wallet_type === "treasury");

  const onBootstrap = async () => {
    try {
      const r = await bootstrapMut.mutateAsync();
      Alert.alert("Bootstrap done", `issuer ${shortAddress(r.issuer)}\ntreasury ${shortAddress(r.treasury)}`);
    } catch (err) {
      Alert.alert("Failed", (err as Error).message);
    }
  };

  const onIssue = async () => {
    if (!issuer || !treasury || !destination) return Alert.alert("Bootstrap + destination required");
    try {
      await issueMut.mutateAsync({
        treasuryAddress: treasury.classic_address,
        destinationAddress: destination,
        currency,
        issuerAddress: issuer.classic_address,
        value,
      });
      Alert.alert("Issued");
    } catch (err) {
      Alert.alert("Issue failed", (err as Error).message);
    }
  };

  const onFund = async () => {
    try {
      const r = await fundMut.mutateAsync(fundAddr || undefined);
      Alert.alert("Funded", `${r.address}\n${r.balanceXrp} XRP`);
    } catch (err) {
      Alert.alert("Fund failed", (err as Error).message);
    }
  };

  const onPromote = async () => {
    if (!promoteEmail) return;
    try {
      await promoteMut.mutateAsync(promoteEmail);
      setPromoteEmail("");
      Alert.alert("Promoted to ADMIN");
    } catch (err) {
      Alert.alert("Failed", (err as Error).message);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <ScrollView contentContainerClassName="px-6 py-6">
        <Text className="mb-1 text-3xl font-bold text-white">Admin</Text>
        <Text className="mb-6 text-white/60">Issuance + faucet (Testnet)</Text>

        <View className="mb-5 rounded-2xl border border-white/10 p-5">
          <Text className="mb-2 text-sm uppercase tracking-wider text-white/50">Bootstrap</Text>
          <Text className="mb-3 text-xs text-white/60">
            {issuer ? `Issuer: ${shortAddress(issuer.classic_address)}` : "Issuer not yet created"}
            {"\n"}
            {treasury ? `Treasury: ${shortAddress(treasury.classic_address)}` : "Treasury not yet created"}
          </Text>
          <TouchableOpacity
            onPress={onBootstrap}
            disabled={bootstrapMut.isPending}
            className="items-center rounded-2xl bg-primary py-3"
          >
            {bootstrapMut.isPending ? (
              <ActivityIndicator />
            ) : (
              <Text className="text-base font-semibold text-black">Run bootstrap</Text>
            )}
          </TouchableOpacity>
        </View>

        <View className="mb-5 rounded-2xl border border-white/10 p-5">
          <Text className="mb-2 text-sm uppercase tracking-wider text-white/50">Issue tokens</Text>
          <TextInput
            value={destination}
            onChangeText={setDestination}
            placeholder="Destination address (rXXX)"
            placeholderTextColor="#666"
            autoCapitalize="none"
            className="mb-3 rounded-xl border border-white/15 px-3 py-2 text-white"
          />
          <View className="mb-3 flex-row">
            <TextInput
              value={currency}
              onChangeText={setCurrency}
              placeholder="USD"
              placeholderTextColor="#666"
              autoCapitalize="characters"
              className="mr-2 flex-1 rounded-xl border border-white/15 px-3 py-2 text-white"
            />
            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder="amount"
              placeholderTextColor="#666"
              keyboardType="decimal-pad"
              className="flex-1 rounded-xl border border-white/15 px-3 py-2 text-white"
            />
          </View>
          <TouchableOpacity
            onPress={onIssue}
            disabled={issueMut.isPending}
            className="items-center rounded-2xl bg-primary py-3"
          >
            {issueMut.isPending ? (
              <ActivityIndicator />
            ) : (
              <Text className="text-base font-semibold text-black">Send IOU from treasury</Text>
            )}
          </TouchableOpacity>
        </View>

        <View className="mb-5 rounded-2xl border border-white/10 p-5">
          <Text className="mb-2 text-sm uppercase tracking-wider text-white/50">Faucet top-up</Text>
          <TextInput
            value={fundAddr}
            onChangeText={setFundAddr}
            placeholder="Existing wallet address (optional)"
            placeholderTextColor="#666"
            autoCapitalize="none"
            className="mb-3 rounded-xl border border-white/15 px-3 py-2 text-white"
          />
          <TouchableOpacity
            onPress={onFund}
            disabled={fundMut.isPending}
            className="items-center rounded-2xl bg-primary py-3"
          >
            {fundMut.isPending ? (
              <ActivityIndicator />
            ) : (
              <Text className="text-base font-semibold text-black">Fund via faucet</Text>
            )}
          </TouchableOpacity>
        </View>

        <View className="mb-5 rounded-2xl border border-white/10 p-5">
          <Text className="mb-2 text-sm uppercase tracking-wider text-white/50">Promote to admin</Text>
          <TextInput
            value={promoteEmail}
            onChangeText={setPromoteEmail}
            placeholder="email@example.com"
            placeholderTextColor="#666"
            autoCapitalize="none"
            keyboardType="email-address"
            className="mb-3 rounded-xl border border-white/15 px-3 py-2 text-white"
          />
          <TouchableOpacity
            onPress={onPromote}
            disabled={promoteMut.isPending}
            className="items-center rounded-2xl bg-primary py-3"
          >
            {promoteMut.isPending ? (
              <ActivityIndicator />
            ) : (
              <Text className="text-base font-semibold text-black">Set role = ADMIN</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text className="mb-3 text-lg font-semibold text-white">All wallets</Text>
        {wallets.isLoading ? (
          <ActivityIndicator />
        ) : (
          (wallets.data ?? []).map((w) => (
            <View key={w.id} className="mb-2 rounded-xl border border-white/10 p-3">
              <Text className="mb-1 text-xs uppercase tracking-wider text-white/50">
                {w.wallet_type}
              </Text>
              <Text className="font-mono text-xs text-white">{w.classic_address}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
