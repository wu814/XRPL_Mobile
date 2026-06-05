import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { checkUsernameAvailable, ensureProfile } from "@/src/api/auth";
import type { AuthProfile } from "@/src/stores/auth";

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,24}$/;

interface UsernameFormProps {
  currentUsername?: string | null;
  onSuccess: (profile: AuthProfile) => void;
  submitLabel?: string;
}

export function UsernameForm({
  currentUsername,
  onSuccess,
  submitLabel = "Save",
}: UsernameFormProps) {
  const [username, setUsername] = useState(currentUsername ?? "");
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = username.trim();
  const isValid = USERNAME_REGEX.test(trimmed);
  const unchanged = trimmed === (currentUsername ?? "");
  const canSubmit = isValid && (unchanged || available === true) && !saving && !checking;

  useEffect(() => {
    setError(null);
    if (!trimmed || !isValid) {
      setAvailable(null);
      return;
    }
    if (unchanged) {
      setAvailable(null);
      return;
    }

    let cancelled = false;
    setChecking(true);
    const timer = setTimeout(() => {
      checkUsernameAvailable(trimmed)
        .then((ok) => {
          if (!cancelled) setAvailable(ok);
        })
        .catch(() => {
          if (!cancelled) setAvailable(null);
        })
        .finally(() => {
          if (!cancelled) setChecking(false);
        });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, isValid, unchanged]);

  const onSave = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const profile = await ensureProfile({ username: trimmed });
      onSuccess(profile);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.toLowerCase().includes("taken")) {
        setAvailable(false);
        setError("Username is already taken");
      } else {
        setError(msg || "Failed to save username");
      }
    } finally {
      setSaving(false);
    }
  };

  const statusText = (() => {
    if (!trimmed) return null;
    if (!isValid) return "3–24 characters: letters, digits, and underscores only";
    if (unchanged) return null;
    if (checking) return "Checking availability…";
    if (available === true) return "Username is available";
    if (available === false) return "Username is taken";
    return null;
  })();

  const statusColor =
    available === true ? "text-green-400" : available === false || !isValid ? "text-danger" : "text-white/50";

  return (
    <View>
      <TextInput
        value={username}
        onChangeText={setUsername}
        placeholder="username"
        placeholderTextColor="#666"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={24}
        className="mb-2 rounded-xl border border-white/15 px-3 py-3 text-base text-white"
      />

      {statusText ? (
        <Text className={`mb-3 text-sm ${statusColor}`}>{statusText}</Text>
      ) : (
        <View className="mb-3" />
      )}

      {error ? <Text className="mb-3 text-sm text-danger">{error}</Text> : null}

      <TouchableOpacity
        onPress={onSave}
        disabled={!canSubmit}
        className={`items-center rounded-2xl px-6 py-4 ${canSubmit ? "bg-primary" : "bg-white/10"}`}
      >
        {saving ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text className={`text-base font-semibold ${canSubmit ? "text-black" : "text-white/40"}`}>
            {submitLabel}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
