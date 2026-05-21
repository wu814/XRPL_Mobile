import { useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/src/lib/supabase";
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
      // Local scope: only this device's session is cleared, no /logout
      // round-trip and no AuthSessionMissingError if the server already
      // dropped the session.
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) console.warn("supabase.auth.signOut error", error);
    } catch (err) {
      console.warn("supabase.auth.signOut threw", err);
    }
    resetAuth();
    queryClient.clear();
    setSigningOut(false);
    router.replace("/sign-in");
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-1 px-6 py-8">
        <Text className="mb-6 text-3xl font-bold text-white">Settings</Text>

        <View className="mb-4 rounded-2xl border border-white/10 p-5">
          <Text className="mb-1 text-sm uppercase tracking-wider text-white/50">Email</Text>
          <Text className="text-base text-white">{profile?.email ?? "-"}</Text>
        </View>

        <View className="mb-4 rounded-2xl border border-white/10 p-5">
          <Text className="mb-1 text-sm uppercase tracking-wider text-white/50">Username</Text>
          <Text className="text-base text-white">{profile?.username ?? "(not set)"}</Text>
        </View>

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
    </SafeAreaView>
  );
}
