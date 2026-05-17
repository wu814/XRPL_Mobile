import { useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { supabase } from "@/src/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"google" | "magic" | null>(null);

  const onGoogle = async () => {
    setBusy("google");
    try {
      const redirectTo = Linking.createURL("/auth-callback");
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("No OAuth URL returned");

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== "success" || !result.url) {
        throw new Error("OAuth was cancelled");
      }
      const url = new URL(result.url);
      const params = new URLSearchParams(url.hash.replace(/^#/, ""));
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      if (!access_token || !refresh_token) {
        throw new Error("Missing tokens in OAuth callback");
      }
      await supabase.auth.setSession({ access_token, refresh_token });
    } catch (err) {
      Alert.alert("Sign in failed", (err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const onMagicLink = async () => {
    if (!email) {
      Alert.alert("Enter your email first");
      return;
    }
    setBusy("magic");
    try {
      const redirectTo = Linking.createURL("/auth-callback");
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw error;
      Alert.alert("Check your email", "We sent you a magic link to sign in.");
    } catch (err) {
      Alert.alert("Sign in failed", (err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-1 items-center justify-center px-8">
        <Text className="mb-2 text-5xl font-extrabold text-primary">XRPL</Text>
        <Text className="mb-12 text-base text-white/70">Custodial Testnet demo</Text>

        <TouchableOpacity
          onPress={onGoogle}
          disabled={busy !== null}
          className="mb-6 w-full items-center rounded-2xl bg-primary px-6 py-4"
        >
          {busy === "google" ? (
            <ActivityIndicator />
          ) : (
            <Text className="text-base font-semibold text-black">Continue with Google</Text>
          )}
        </TouchableOpacity>

        <View className="mb-4 w-full flex-row items-center">
          <View className="h-px flex-1 bg-white/20" />
          <Text className="mx-3 text-xs text-white/50">or</Text>
          <View className="h-px flex-1 bg-white/20" />
        </View>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor="#888"
          autoCapitalize="none"
          keyboardType="email-address"
          className="mb-3 w-full rounded-2xl border border-white/20 px-4 py-3 text-base text-white"
        />

        <TouchableOpacity
          onPress={onMagicLink}
          disabled={busy !== null}
          className="w-full items-center rounded-2xl border border-white/30 px-6 py-4"
        >
          {busy === "magic" ? (
            <ActivityIndicator />
          ) : (
            <Text className="text-base font-semibold text-white">Email me a magic link</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
