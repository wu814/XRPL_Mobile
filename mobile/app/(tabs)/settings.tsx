import { useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { Screen } from "@/src/components/ui/Screen";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { signOutLocally } from "@/src/lib/authSession";
import { useAuthStore } from "@/src/stores/auth";

export default function SettingsScreen() {
  const profile = useAuthStore((s) => s.profile);
  const resetAuth = useAuthStore((s) => s.reset);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);

  const onSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await queryClient.cancelQueries();
      await signOutLocally();
    } catch (err) {
      console.warn("[auth] sign out failed", err);
    } finally {
      resetAuth();
      queryClient.clear();
      setSigningOut(false);
      router.replace("/sign-in");
    }
  };

  return (
    <Screen>
      <View className="flex-1 px-6 py-8">
        <Text className="mb-6 text-3xl font-bold text-white">Settings</Text>

        <View className="mb-4 rounded-2xl border border-white/10 p-5">
          <Text className="mb-1 text-sm uppercase tracking-wider text-white/50">Email</Text>
          <Text className="text-base text-white">{profile?.email ?? "-"}</Text>
        </View>

        <TouchableOpacity
          onPress={() => router.push("/set-username?mode=edit")}
          className="mb-4 rounded-2xl border border-white/10 p-5"
        >
          <View className="mb-1 flex-row items-center justify-between">
            <Text className="text-sm uppercase tracking-wider text-white/50">Username</Text>
            <Text className="text-sm text-primary">{profile?.username ? "Edit" : "Set"}</Text>
          </View>
          <Text className="text-base text-white">{profile?.username ?? "(not set)"}</Text>
        </TouchableOpacity>

        <View className="mb-8 rounded-2xl border border-white/10 p-5">
          <Text className="mb-1 text-sm uppercase tracking-wider text-white/50">Role</Text>
          <Text className="text-base text-white">{profile?.role ?? "USER"}</Text>
        </View>

        <TouchableOpacity
          onPress={onSignOut}
          disabled={signingOut}
          className="items-center rounded-2xl border border-danger/40 px-6 py-4"
        >
          {signingOut ? (
            <ActivityIndicator color="#ff5c5c" />
          ) : (
            <Text className="text-base font-semibold text-danger">Sign out</Text>
          )}
        </TouchableOpacity>
      </View>
    </Screen>
  );
}
