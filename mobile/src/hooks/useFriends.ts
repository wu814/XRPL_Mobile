import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addFavorite,
  listFavorites,
  listFriends,
  listRequests,
  removeFavorite,
  removeFriend,
  respondRequest,
  sendRequest,
} from "@/src/api/friends";

const friendKeys = {
  list: ["friends", "list"] as const,
  requests: ["friends", "requests"] as const,
  favorites: ["friends", "favorites"] as const,
};

export function useFriends() {
  return useQuery({ queryKey: friendKeys.list, queryFn: listFriends });
}

export function useFriendRequests() {
  return useQuery({ queryKey: friendKeys.requests, queryFn: listRequests });
}

export function useFavorites() {
  return useQuery({ queryKey: friendKeys.favorites, queryFn: listFavorites });
}

export function useSendRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: sendRequest,
    onSuccess: () => qc.invalidateQueries({ queryKey: friendKeys.requests }),
  });
}

export function useRespondRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "accept" | "decline" }) =>
      respondRequest(id, action),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: friendKeys.requests });
      qc.invalidateQueries({ queryKey: friendKeys.list });
    },
  });
}

export function useRemoveFriend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: removeFriend,
    onSuccess: () => qc.invalidateQueries({ queryKey: friendKeys.list }),
  });
}

export function useAddFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: addFavorite,
    onSuccess: () => qc.invalidateQueries({ queryKey: friendKeys.favorites }),
  });
}

export function useRemoveFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: removeFavorite,
    onSuccess: () => qc.invalidateQueries({ queryKey: friendKeys.favorites }),
  });
}
