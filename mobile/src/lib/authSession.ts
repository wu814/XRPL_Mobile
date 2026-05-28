import { makeRedirectUri } from "expo-auth-session";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import { supabase } from "./supabase";

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
