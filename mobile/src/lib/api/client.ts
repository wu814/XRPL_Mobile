import axios, { AxiosError, type AxiosInstance } from "axios";
import { supabase } from "../supabase";
import { ENV } from "../env";

export const apiClient: AxiosInstance = axios.create({
  baseURL: ENV.API_URL,
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

apiClient.interceptors.response.use(
  (r) => r,
  (err: AxiosError<{ error?: string }>) => {
    const message = err.response?.data?.error ?? err.message;
    return Promise.reject(new Error(message));
  },
);
