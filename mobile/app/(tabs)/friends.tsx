import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { AppScrollView } from "@/src/components/ui/AppScrollView";
import { Screen } from "@/src/components/ui/Screen";
import {
  useFavorites,
  useFriendRequests,
  useFriends,
  useRemoveFavorite,
  useRemoveFriend,
  useRespondRequest,
  useSendRequest,
} from "@/src/hooks/useFriends";
import { FavoriteStarButton } from "@/src/features/shared/FavoriteStarButton";

type Tab = "friends" | "requests" | "favorites";

export default function FriendsScreen() {
  const [tab, setTab] = useState<Tab>("friends");
  const [username, setUsername] = useState("");

  const friends = useFriends();
  const requests = useFriendRequests();
  const favorites = useFavorites();
  const sendMut = useSendRequest();
  const respondMut = useRespondRequest();
  const removeMut = useRemoveFriend();
  const removeFavMut = useRemoveFavorite();

  const onSend = async () => {
    if (!username) return;
    try {
      await sendMut.mutateAsync(username);
      setUsername("");
      Alert.alert("Friend request sent");
    } catch (err) {
      Alert.alert("Failed", (err as Error).message);
    }
  };

  return (
    <Screen>
      <AppScrollView contentContainerClassName="px-6 py-6">
        <Text className="mb-1 text-3xl font-bold text-white">Friends</Text>

        <View className="mb-5 flex-row rounded-full border border-white/10 p-1">
          {(["friends", "requests", "favorites"] as Tab[]).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              className={`flex-1 items-center rounded-full py-2 ${tab === t ? "bg-primary" : ""}`}
            >
              <Text className={`text-xs ${tab === t ? "text-black" : "text-white/70"}`}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === "friends" ? (
          <View className="mb-6 rounded-2xl border border-white/10 p-5">
            <Text className="mb-2 text-xs uppercase tracking-wider text-white/50">
              Send friend request
            </Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="username"
              placeholderTextColor="#666"
              autoCapitalize="none"
              className="mb-3 rounded-xl border border-white/15 px-3 py-2 text-white"
            />
            <TouchableOpacity
              onPress={onSend}
              disabled={sendMut.isPending}
              className="items-center rounded-2xl bg-primary py-3"
            >
              {sendMut.isPending ? (
                <ActivityIndicator />
              ) : (
                <Text className="text-base font-semibold text-black">Send request</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        {tab === "friends" &&
          (friends.isLoading ? (
            <ActivityIndicator />
          ) : friends.data && friends.data.length > 0 ? (
            friends.data.map((f) => (
              <View
                key={f.id}
                className="mb-3 flex-row items-center justify-between rounded-2xl border border-white/10 p-4"
              >
                <View className="flex-1">
                  <Text className="text-base text-white">{f.username ?? "(no username)"}</Text>
                  <Text className="text-xs text-white/50">{f.email}</Text>
                </View>
                <View className="flex-row items-center">
                  <FavoriteStarButton friendUsername={f.username} />
                  <TouchableOpacity
                    onPress={() => removeMut.mutate(f.id)}
                    className="rounded-full border border-danger/40 px-3 py-1"
                  >
                    <Text className="text-xs text-danger">Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <Text className="text-white/50">No friends yet</Text>
          ))}

        {tab === "requests" &&
          (requests.isLoading ? (
            <ActivityIndicator />
          ) : requests.data && requests.data.length > 0 ? (
            requests.data.map((r) => (
              <View key={r.id} className="mb-3 rounded-2xl border border-white/10 p-4">
                <Text className="mb-2 text-base text-white">
                  {r.sender.username ?? r.sender.email}
                </Text>
                <View className="flex-row">
                  <TouchableOpacity
                    onPress={() => respondMut.mutate({ id: r.id, action: "accept" })}
                    className="mr-2 rounded-full bg-primary px-4 py-1"
                  >
                    <Text className="text-xs font-semibold text-black">Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => respondMut.mutate({ id: r.id, action: "decline" })}
                    className="rounded-full border border-white/20 px-4 py-1"
                  >
                    <Text className="text-xs text-white">Decline</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <Text className="text-white/50">No pending requests</Text>
          ))}

        {tab === "favorites" &&
          (favorites.isLoading ? (
            <ActivityIndicator />
          ) : favorites.data && favorites.data.length > 0 ? (
            favorites.data.map((f) => (
              <View
                key={f.id}
                className="mb-3 flex-row items-center justify-between rounded-2xl border border-white/10 p-4"
              >
                <View>
                  <Text className="text-base text-white">{f.friend.username ?? "(no username)"}</Text>
                  <Text className="text-xs text-white/50">{f.friend.email}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => removeFavMut.mutate(f.id)}
                  className="rounded-full border border-danger/40 px-3 py-1"
                >
                  <Text className="text-xs text-danger">Remove</Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text className="text-white/50">No favorites yet</Text>
          ))}
      </AppScrollView>
    </Screen>
  );
}
