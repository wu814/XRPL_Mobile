import { makeRedirectUri } from "expo-auth-session";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import { ENV } from "./env";
import { secureStorage } from "./secureStore";
import { supabase } from "./supabase";

/** AsyncStorage key used by @supabase/supabase-js for this project. */
export function getSupabaseStorageKey(): string {
  const ref = new URL(ENV.SUPABASE_URL).hostname.split(".")[0];
  return `sb-${ref}-auth-token`;
}

async function clearPersistedAuthSession(): Promise<void> {
  const storageKey = getSupabaseStorageKey();
  await Promise.all([
    secureStorage.removeItem(storageKey),
    secureStorage.removeItem(`${storageKey}-code-verifier`),
    secureStorage.removeItem(`${storageKey}-user`),
  ]);
}

/**
 * Sign out on this device only.
 *
 * auth-js always POSTs to /logout before clearing storage; on network failure it
 * returns early and leaves the session on disk. We remove storage first so the
 * follow-up signOut skips the network call, runs _removeSession, and emits
 * SIGNED_OUT.
 */
export async function signOutLocally(): Promise<void> {
  await supabase.auth.stopAutoRefresh();
  await clearPersistedAuthSession();

  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) {
    console.warn("[auth] signOut after storage clear failed", error);
  }
}

/** OAuth redirect URI — Expo Go uses exp://, dev builds use xrplmobile:// */
export function getOAuthRedirectUri(): string {
  const redirectTo = makeRedirectUri({
    scheme: "xrplmobile",
    path: "auth-callback",
  });
  console.log("[oauth] redirectTo =", redirectTo);
  return redirectTo;
}

/** Parse Supabase OAuth callback URL and establish session (implicit or PKCE). */
export async function createSessionFromUrl(url: string) {
  const { params, errorCode } = QueryParams.getQueryParams(url);

  if (errorCode) {
    throw new Error(errorCode);
  }

  if (params.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw error;
    return data.session;
  }

  const { access_token, refresh_token } = params;
  if (!access_token || !refresh_token) {
    throw new Error("Missing tokens in OAuth callback");
  }

  const { data, error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });
  if (error) throw error;
  return data.session;
}
