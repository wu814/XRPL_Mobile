import { Alert, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/src/lib/supabase";
import { useAuthStore } from "@/src/stores/auth";

export default function SettingsScreen() {
  const profile = useAuthStore((s) => s.profile);

  const onSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert("Sign out failed", error.message);
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
          className="items-center rounded-2xl border border-danger/40 px-6 py-4"
        >
          <Text className="text-base font-semibold text-danger">Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
