import { Text, TouchableOpacity } from "react-native";
import { AppScrollView } from "@/src/components/ui/AppScrollView";
import { Screen } from "@/src/components/ui/Screen";
import { UsernameForm } from "@/src/features/auth/UsernameForm";
import { useAuthStore } from "@/src/stores/auth";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { AuthProfile } from "@/src/stores/auth";

export default function SetUsernameScreen() {
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isEdit = mode === "edit";

  const onSuccess = (updated: AuthProfile) => {
    setProfile(updated);
    router.replace(isEdit ? "/settings" : "/");
  };

  return (
    <Screen>
      <AppScrollView contentContainerClassName="px-6 py-8">
        {isEdit ? (
          <TouchableOpacity onPress={() => router.back()} className="mb-6 self-start">
            <Text className="text-base text-primary">Cancel</Text>
          </TouchableOpacity>
        ) : null}

        <Text className="mb-2 text-3xl font-bold text-white">
          {isEdit ? "Edit username" : "Choose a username"}
        </Text>
        <Text className="mb-8 text-base text-white/60">
          {isEdit
            ? "Your username is how friends find you for payments and requests."
            : "Pick a unique username so others can send you payments and friend requests."}
        </Text>

        <UsernameForm
          currentUsername={profile?.username}
          onSuccess={onSuccess}
          submitLabel={isEdit ? "Save changes" : "Continue"}
        />
      </AppScrollView>
    </Screen>
  );
}
