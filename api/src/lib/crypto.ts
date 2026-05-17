import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env.js";

/**
 * Encrypt a seed using Postgres pgp_sym_encrypt with the API-held key.
 * Returns bytea-suitable hex prefixed with `\\x` for direct insert.
 *
 * We perform encryption in Postgres so the symmetric key never touches the wire
 * outside of normal Supabase TLS-protected requests, and only via parameterized RPC.
 */
export async function encryptSeed(supabase: SupabaseClient, seed: string): Promise<string> {
  const { data, error } = await supabase.rpc("encrypt_seed_v1", {
    p_plaintext: seed,
    p_key: env.SEED_ENCRYPTION_KEY,
  });
  if (error) throw new Error(`encryptSeed failed: ${error.message}`);
  if (typeof data !== "string") throw new Error("encryptSeed returned unexpected type");
  return data;
}

export async function decryptSeed(supabase: SupabaseClient, ciphertextHex: string): Promise<string> {
  const { data, error } = await supabase.rpc("decrypt_seed_v1", {
    p_ciphertext: ciphertextHex,
    p_key: env.SEED_ENCRYPTION_KEY,
  });
  if (error) throw new Error(`decryptSeed failed: ${error.message}`);
  if (typeof data !== "string") throw new Error("decryptSeed returned unexpected type");
  return data;
}
