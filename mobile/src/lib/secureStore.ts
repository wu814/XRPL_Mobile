import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Storage adapter for Supabase auth sessions.
 *
 * We intentionally use AsyncStorage rather than Expo SecureStore: a Supabase
 * session (JWT + refresh + user metadata) routinely exceeds SecureStore's
 * 2048-byte limit, which made writes unreliable and broke sign-out.
 *
 * Tokens are still sandboxed per-app on iOS/Android. If we ever need at-rest
 * encryption we can wrap this with `aes-js` + a SecureStore-held key, but
 * doing so adds a polyfill dependency that has historically caused
 * hard-to-debug hangs in React Native crypto code paths.
 */
export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    return AsyncStorage.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    await AsyncStorage.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },
};
