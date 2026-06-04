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
import { AppScrollView } from "@/src/components/ui/AppScrollView";
import { AppSheet } from "@/src/components/ui/AppSheet";
import { Screen } from "@/src/components/ui/Screen";
import { Stack, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAmms, ammKeys } from "@/src/hooks/useAmm";
import { createAmm } from "@/src/api/amm";
import { useAdminWallets } from "@/src/hooks/useAdminWallets";
import { decodeCurrency } from "@/src/lib/formatters";
import { useAuthStore } from "@/src/stores/auth";
import { availableCurrencies } from "@/src/lib/currencyIcon";
import { CurrencyIconImage } from "@/src/features/shared/CurrencyIconImage";

export default function AmmListScreen() {
  const router = useRouter();
  const amms = useAmms();
  const role = useAuthStore((s) => s.profile?.role);
  const isAdmin = role === "ADMIN";

  const [showCreate, setShowCreate] = useState(false);

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: "AMM",
          headerStyle: { backgroundColor: "#000" },
          headerTintColor: "#fff",
        }}
      />
      <AppScrollView contentContainerClassName="px-6 py-6">
        <View className="mb-6 flex-row items-end justify-between">
          <View className="flex-1">
            <Text className="mb-1 text-3xl font-bold text-white">AMM</Text>
            <Text className="text-white/60">Liquidity pools on Testnet</Text>
          </View>
          {isAdmin && (
            <TouchableOpacity
              onPress={() => setShowCreate(true)}
              className="rounded-full bg-primary px-4 py-2"
            >
              <Text className="text-sm font-semibold text-black">+ Create AMM</Text>
            </TouchableOpacity>
          )}
        </View>

        {amms.isLoading ? (
          <ActivityIndicator />
        ) : amms.data && amms.data.length > 0 ? (
          amms.data.map((a) => (
            <TouchableOpacity
              key={a.id}
              onPress={() => router.push(`/amm/${a.account}` as any)}
              className="mb-3 rounded-2xl border border-white/10 p-4"
            >
              <View className="mb-1 flex-row items-center">
                <View className="mr-2 flex-row">
                  <CurrencyIconImage currency={decodeCurrency(a.currency1)} size={28} />
                  <View className="-ml-3">
                    <CurrencyIconImage currency={decodeCurrency(a.currency2)} size={28} />
                  </View>
                </View>
                <Text className="text-base text-white">
                  {decodeCurrency(a.currency1)} / {decodeCurrency(a.currency2)}
                </Text>
              </View>
              <Text className="font-mono text-xs text-white/60">{a.account}</Text>
            </TouchableOpacity>
          ))
        ) : (
          <View className="rounded-2xl border border-white/10 p-6">
            <Text className="text-white/60">
              {isAdmin
                ? "No AMMs yet. Tap + Create AMM to create one."
                : "No AMMs yet."}
            </Text>
          </View>
        )}
      </AppScrollView>

      {isAdmin && (
        <CreateAmmModal visible={showCreate} onClose={() => setShowCreate(false)} />
      )}
    </Screen>
  );
}

function CreateAmmModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const adminWalletsQuery = useAdminWallets(visible);

  const treasury = adminWalletsQuery.data?.find((w) => w.wallet_type === "treasury");
  const issuer = adminWalletsQuery.data?.find((w) => w.wallet_type === "issuer");

  const [currency1, setCurrency1] = useState("USD");
  const [currency2, setCurrency2] = useState("XRP");
  const [value1, setValue1] = useState("");
  const [value2, setValue2] = useState("");
  const [tradingFee, setTradingFee] = useState("500");

  const createMut = useMutation({
    mutationFn: createAmm,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ammKeys.list() });
      onClose();
    },
  });

  const onSubmit = async () => {
    if (!treasury || !issuer) {
      Alert.alert("Missing wallets", "Create treasury and issuer wallets on the Home tab first.");
      return;
    }
    const v1 = Number(value1);
    const v2 = Number(value2);
    const fee = Number(tradingFee);
    if (!v1 || !v2 || currency1 === currency2) {
      Alert.alert("Invalid input", "Pick two different currencies and amounts.");
      return;
    }
    try {
      await createMut.mutateAsync({
        treasuryAddress: treasury.classic_address,
        issuerAddress: issuer.classic_address,
        currency1,
        value1: v1,
        currency2,
        value2: v2,
        tradingFee: Number.isFinite(fee) ? fee : 500,
      });
      setValue1("");
      setValue2("");
      Alert.alert("AMM created");
    } catch (err) {
      Alert.alert("Create AMM failed", (err as Error).message);
    }
  };

  return (
    <AppSheet visible={visible} onClose={onClose} title="Create AMM">
          {!treasury || !issuer ? (
            <Text className="text-danger">
              Treasury / Issuer wallets not created yet. Add them from the admin Home tab.
            </Text>
          ) : (
            <>
              <Text className="mb-2 text-xs uppercase tracking-wider text-white/50">
                Currency 1
              </Text>
              <CurrencyChips value={currency1} onChange={setCurrency1} exclude={currency2} />

              <Text className="mb-1 mt-3 text-xs text-white/60">Value 1</Text>
              <TextInput
                value={value1}
                onChangeText={setValue1}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#666"
                className="mb-4 rounded-xl border border-white/15 px-3 py-2 text-white"
              />

              <Text className="mb-2 text-xs uppercase tracking-wider text-white/50">
                Currency 2
              </Text>
              <CurrencyChips value={currency2} onChange={setCurrency2} exclude={currency1} />

              <Text className="mb-1 mt-3 text-xs text-white/60">Value 2</Text>
              <TextInput
                value={value2}
                onChangeText={setValue2}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#666"
                className="mb-4 rounded-xl border border-white/15 px-3 py-2 text-white"
              />

              <Text className="mb-1 text-xs text-white/60">
                Trading fee (XRPL units, 1 = 0.001%, max 1000 = 1%)
              </Text>
              <TextInput
                value={tradingFee}
                onChangeText={setTradingFee}
                keyboardType="number-pad"
                placeholder="500"
                placeholderTextColor="#666"
                className="mb-6 rounded-xl border border-white/15 px-3 py-2 text-white"
              />

              <TouchableOpacity
                onPress={onSubmit}
                disabled={createMut.isPending}
                className="items-center rounded-2xl bg-primary py-3"
              >
                {createMut.isPending ? (
                  <ActivityIndicator />
                ) : (
                  <Text className="text-base font-semibold text-black">Create AMM</Text>
                )}
              </TouchableOpacity>
            </>
          )}
    </AppSheet>
  );
}

function CurrencyChips({
  value,
  onChange,
  exclude,
}: {
  value: string;
  onChange: (c: string) => void;
  exclude?: string;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {availableCurrencies
        .filter((c) => c.id !== exclude)
        .map((c) => {
          const selected = c.id === value;
          return (
            <TouchableOpacity
              key={c.id}
              onPress={() => onChange(c.id)}
              className={`mr-2 flex-row items-center rounded-full px-3 py-2 ${selected ? "bg-primary" : "border border-white/20"}`}
            >
              <CurrencyIconImage currency={c.id} size={20} />
              <Text className={`ml-2 text-xs ${selected ? "text-black" : "text-white"}`}>
                {c.id}
              </Text>
            </TouchableOpacity>
          );
        })}
    </ScrollView>
  );
}
