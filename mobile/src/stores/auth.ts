import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";

export interface AuthProfile {
  id: string;
  email: string;
  username: string | null;
  role: "USER" | "ADMIN";
}

interface AuthState {
  session: Session | null;
  profile: AuthProfile | null;
  isLoading: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (profile: AuthProfile | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  isLoading: true,
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),
  reset: () => set({ session: null, profile: null, isLoading: false }),
}));
