import Constants from "expo-constants";

function read(name: string, fallback?: string): string {
  const fromProcess = (process.env as Record<string, string | undefined>)[name];
  if (fromProcess && fromProcess.length > 0) return fromProcess;
  const fromExtra = (Constants.expoConfig?.extra as Record<string, string | undefined> | undefined)?.[
    name
  ];
  if (fromExtra && fromExtra.length > 0) return fromExtra;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing env var: ${name}`);
}

export const ENV = {
  API_URL: read("EXPO_PUBLIC_API_URL", "http://localhost:3001"),
  SUPABASE_URL: read("EXPO_PUBLIC_SUPABASE_URL", ""),
  SUPABASE_PUBLISHABLE_KEY: read("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY", ""),
};
