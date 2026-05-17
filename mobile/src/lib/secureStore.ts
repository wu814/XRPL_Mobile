import * as SecureStore from "expo-secure-store";

/**
 * Adapter for Supabase storage; uses Expo SecureStore on device,
 * falls back to in-memory map for web/SSR.
 */
const memoryStore = new Map<string, string>();

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    if (SecureStore.isAvailableAsync && (await SecureStore.isAvailableAsync())) {
      return SecureStore.getItemAsync(key);
    }
    return memoryStore.get(key) ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    if (SecureStore.isAvailableAsync && (await SecureStore.isAvailableAsync())) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    memoryStore.set(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (SecureStore.isAvailableAsync && (await SecureStore.isAvailableAsync())) {
      await SecureStore.deleteItemAsync(key);
      return;
    }
    memoryStore.delete(key);
  },
};
