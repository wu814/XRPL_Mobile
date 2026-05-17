import { apiClient } from "../lib/api/client";

export interface Profile {
  id: string;
  username: string | null;
  email: string;
}

export interface FriendRequest {
  id: string;
  sentAt: string;
  sender: { username: string | null; email: string };
}

export interface Favorite {
  id: string;
  friend: { username: string | null; email: string };
}

export async function listFriends() {
  const { data } = await apiClient.get<Profile[]>("/friends");
  return data;
}

export async function listRequests() {
  const { data } = await apiClient.get<FriendRequest[]>("/friends/requests");
  return data;
}

export async function sendRequest(receiverUsername: string) {
  const { data } = await apiClient.post("/friends/requests", { receiverUsername });
  return data;
}

export async function respondRequest(id: string, action: "accept" | "decline") {
  const { data } = await apiClient.post(`/friends/requests/${id}/respond`, { action });
  return data as { ok: true; status: "accepted" | "declined" };
}

export async function removeFriend(friendId: string) {
  await apiClient.delete(`/friends/${friendId}`);
}

export async function listFavorites() {
  const { data } = await apiClient.get<Favorite[]>("/friends/favorites");
  return data;
}

export async function addFavorite(friendUsername: string) {
  const { data } = await apiClient.post("/friends/favorites", { friendUsername });
  return data;
}

export async function removeFavorite(id: string) {
  await apiClient.delete(`/friends/favorites/${id}`);
}
