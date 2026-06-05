import { useState } from "react";
import { Alert, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { AppScrollView } from "@/src/components/ui/AppScrollView";
import { Screen } from "@/src/components/ui/Screen";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "@/src/lib/supabase";
import { createSessionFromUrl, getOAuthRedirectUri } from "@/src/lib/authSession";

WebBrowser.maybeCompleteAuthSession();

export default function SignIn() {
  const [busy, setBusy] = useState(false);

  const onGoogle = async () => {
    setBusy(true);
    let redirectTo = "";
    try {
      redirectTo = getOAuthRedirectUri();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("No OAuth URL returned");

      // Debug: confirm Supabase received our redirect_to param.
      try {
        const supabaseRedirect = new URL(data.url).searchParams.get("redirect_to");
        console.log("[oauth] supabase redirect_to =", supabaseRedirect);
      } catch {
        console.log("[oauth] could not parse supabase oauth url");
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      console.log("[oauth] auth session result =", result.type, result.type === "success" ? result.url : "");

      if (result.type !== "success" || !result.url) {
        throw new Error(
          result.type === "cancel"
            ? "OAuth was cancelled"
            : `OAuth failed (${result.type}). Safari "invalid address" usually means Supabase Site URL is wrong or redirect URLs are not saved as separate entries.`,
        );
      }

      await createSessionFromUrl(result.url);
    } catch (err) {
      const message = (err as Error).message;
      Alert.alert(
        "Sign in failed",
        redirectTo
          ? `${message}\n\nAdd this exact URL to Supabase → Authentication → Redirect URLs:\n${redirectTo}`
          : message,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <AppScrollView contentContainerClassName="grow items-center justify-center px-8 py-8">
        <Text className="mb-2 text-5xl font-extrabold text-primary">XRPL</Text>
        <Text className="mb-12 text-base text-white/70">Custodial Testnet demo</Text>

        <TouchableOpacity
          onPress={onGoogle}
          disabled={busy}
          className="w-full items-center rounded-2xl bg-primary px-6 py-4"
        >
          {busy ? (
            <ActivityIndicator />
          ) : (
            <Text className="text-base font-semibold text-black">Continue with Google</Text>
          )}
        </TouchableOpacity>
      </AppScrollView>
    </Screen>
  );
}
