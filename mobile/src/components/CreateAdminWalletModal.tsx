import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { WalletType } from "@/src/api/wallets";

type AdminWalletType = Extract<WalletType, "issuer" | "treasury" | "pathfind">;

const ADMIN_TYPES: { id: AdminWalletType; title: string; description: string }[] = [
  {
    id: "issuer",
    title: "Issuer",
    description:
      "Issues IOU tokens (USD, EUR, BTC…). Sets DisallowXRP, DefaultRipple, AllowTrustLineClawback, DepositAuth, and RequireAuth flags.",
  },
  {
    id: "treasury",
    title: "Treasury",
    description:
      "Holds issued IOUs and oracle feeds. Sets DepositAuth so only authorized senders can deposit.",
  },
  {
    id: "pathfind",
    title: "Pathfind",
    description:
      "Intermediary wallet for cross-currency routing. No flags applied automatically.",
  },
];

interface CreateAdminWalletModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (type: AdminWalletType) => Promise<void>;
  isCreating: boolean;
}

export function CreateAdminWalletModal({
  visible,
  onClose,
  onCreate,
  isCreating,
}: CreateAdminWalletModalProps) {
  const [selected, setSelected] = useState<AdminWalletType>("issuer");

  const onConfirm = async () => {
    try {
      await onCreate(selected);
      onClose();
    } catch (err) {
      Alert.alert("Create wallet failed", (err as Error).message);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 items-center justify-center bg-black/70 px-6">
        <View className="w-full rounded-3xl border border-white/10 bg-zinc-900 p-6">
          <Text className="mb-1 text-xl font-bold text-white">Create Wallet</Text>
          <Text className="mb-4 text-sm text-white/60">
            Pick which system wallet to fund and configure.
          </Text>

          <Text className="mb-2 text-xs uppercase tracking-wider text-white/50">
            Wallet Type
          </Text>
          {ADMIN_TYPES.map((t) => {
            const isSelected = selected === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => setSelected(t.id)}
                disabled={isCreating}
                className={`mb-2 rounded-2xl border p-4 ${
                  isSelected
                    ? "border-primary bg-primary/10"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-base font-semibold text-white">
                    {t.title}
                  </Text>
                  {isSelected ? <Text className="text-primary">✓</Text> : null}
                </View>
                <Text className="mt-1 text-xs text-white/60">{t.description}</Text>
              </TouchableOpacity>
            );
          })}

          <View className="mt-4 flex-row">
            <TouchableOpacity
              onPress={onClose}
              disabled={isCreating}
              className="mr-2 flex-1 items-center rounded-2xl border border-white/15 py-3"
            >
              <Text className="text-sm font-semibold text-white">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              disabled={isCreating}
              className={`ml-2 flex-1 items-center rounded-2xl py-3 ${
                isCreating ? "bg-white/15" : "bg-primary"
              }`}
            >
              {isCreating ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text className="text-sm font-semibold text-black">Create</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
