import { ActivityIndicator, Alert, TouchableOpacity } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useAddFavorite, useFavorites, useRemoveFavorite } from "@/src/hooks/useFriends";

interface FavoriteStarButtonProps {
  friendUsername: string | null;
}

export function FavoriteStarButton({ friendUsername }: FavoriteStarButtonProps) {
  const favorites = useFavorites();
  const addMut = useAddFavorite();
  const removeMut = useRemoveFavorite();

  if (!friendUsername) return null;

  const favEntry = favorites.data?.find((f) => f.friend.username === friendUsername);
  const isFavorited = !!favEntry;
  const loading = addMut.isPending || removeMut.isPending;

  const onToggle = async () => {
    try {
      if (isFavorited && favEntry) {
        await removeMut.mutateAsync(favEntry.id);
      } else {
        await addMut.mutateAsync(friendUsername);
      }
    } catch (err) {
      Alert.alert("Failed", (err as Error).message);
    }
  };

  if (favorites.isLoading) {
    return <ActivityIndicator size="small" color="#9ca3af" />;
  }

  return (
    <TouchableOpacity
      onPress={onToggle}
      disabled={loading}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      className="mr-3"
    >
      {loading ? (
        <ActivityIndicator size="small" color="#facc15" />
      ) : (
        <MaterialIcons
          name={isFavorited ? "star" : "star-border"}
          size={22}
          color={isFavorited ? "#facc15" : "#9ca3af"}
        />
      )}
    </TouchableOpacity>
  );
}
