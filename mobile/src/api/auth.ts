import { apiClient } from "../lib/api/client";
import type { AuthProfile } from "../stores/auth";

export async function ensureProfile(input?: { username?: string }): Promise<AuthProfile> {
  const { data } = await apiClient.post<AuthProfile>("/auth/profile", input ?? {});
  return data;
}

export async function getMe(): Promise<AuthProfile> {
  const { data } = await apiClient.get<AuthProfile>("/auth/me");
  return data;
}

export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const { data } = await apiClient.get<{ available: boolean }>("/auth/check-username", {
    params: { username },
  });
  return data.available;
}
