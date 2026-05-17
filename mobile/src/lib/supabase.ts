import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import { secureStorage } from "./secureStore";
import { ENV } from "./env";

export const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
