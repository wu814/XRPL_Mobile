import "react-native-get-random-values";
import "../global.css";
import { useEffect } from "react";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { queryClient } from "@/src/lib/queryClient";
import { supabase } from "@/src/lib/supabase";
import { useAuthStore } from "@/src/stores/auth";
import { ensureProfile, getMe } from "@/src/api/auth";

function AuthBootstrapper() {
  const setSession = useAuthStore((s) => s.setSession);
  const setProfile = useAuthStore((s) => s.setProfile);
  const setLoading = useAuthStore((s) => s.setLoading);

  useEffect(() => {
    let mounted = true;

    const loadProfile = async (origin: string) => {
      try {
        const profile = await ensureProfile();
        if (mounted) setProfile(profile);
      } catch (ensureErr) {
        console.warn(`[auth:${origin}] ensureProfile failed`, ensureErr);
        try {
          const profile = await getMe();
          if (mounted) setProfile(profile);
        } catch (meErr) {
          console.warn(`[auth:${origin}] getMe failed`, meErr);
        }
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
      if (data.session) {
        // Defer so loadProfile (which calls supabase.auth.getSession via the
        // axios interceptor) doesn't re-enter while supabase is still holding
        // its initial-session lock.
        setTimeout(() => {
          void loadProfile("bootstrap");
        }, 0);
      }
    });

    // IMPORTANT: keep this callback SYNCHRONOUS and never await any supabase
    // call (direct or via apiClient) inside it. Doing so deadlocks the
    // auth-js internal lock and causes every subsequent supabase.auth.*
    // call to hang forever. See supabase/auth-js#762.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[auth] state change:", event, session?.user?.id ?? "no-user");
      setSession(session);
      if (!session) {
        setProfile(null);
        return;
      }
      setTimeout(() => {
        void loadProfile(`event:${event}`);
      }, 0);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [setSession, setProfile, setLoading]);

  return null;
}

function AuthGate() {
  const session = useAuthStore((s) => s.session);
  const isLoading = useAuthStore((s) => s.isLoading);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === "sign-in" || segments[0] === "auth-callback";
    if (!session && !inAuthGroup) {
      router.replace("/sign-in");
    } else if (session && inAuthGroup) {
      router.replace("/");
    }
  }, [session, isLoading, segments, router]);

  return null;
}

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <AuthBootstrapper />
        <AuthGate />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
          <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: "modal", title: "Modal" }} />
          <Stack.Screen name="advanced/amm" options={{ headerShown: true }} />
          <Stack.Screen name="advanced/dex" options={{ headerShown: true }} />
          <Stack.Screen name="advanced/nft" options={{ headerShown: true }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
