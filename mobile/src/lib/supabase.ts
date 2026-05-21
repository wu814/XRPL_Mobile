import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { secureStorage } from "./secureStore";
import { ENV } from "./env";

// Fire-and-forget migration: earlier builds stored the auth session directly
// in Expo SecureStore, which has a 2048-byte limit that Supabase sessions
// often exceed. We now use AsyncStorage. Clear any stale SecureStore keys
// the old client created so they don't haunt us. Safe to remove after a
// release or two.
const LEGACY_KEY = `sb-${new URL(ENV.SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
SecureStore.isAvailableAsync?.()
  .then(async (available) => {
    if (!available) return;
    const legacy = await SecureStore.getItemAsync(LEGACY_KEY).catch(() => null);
    if (!legacy) return;
    console.log("[auth] migrating legacy session out of SecureStore");
    await AsyncStorage.setItem(LEGACY_KEY, legacy).catch(() => undefined);
    await SecureStore.deleteItemAsync(LEGACY_KEY).catch(() => undefined);
  })
  .catch(() => undefined);

export const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
