import { Wallet } from "xrpl";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptSeed } from "../../../lib/crypto.js";

/**
 * Load an XRPL Wallet instance from the encrypted seed stored in the wallets table.
 * Used by every signing route. The seed is decrypted in-memory only.
 */
export async function loadWalletByAddress(
  supabase: SupabaseClient,
  classicAddress: string,
): Promise<{ wallet: Wallet; userId: string | null; walletType: string }> {
  const { data, error } = await supabase
    .from("wallets")
    .select("user_id, encrypted_seed, wallet_type")
    .eq("classic_address", classicAddress)
    .maybeSingle();

  if (error) throw new Error(`Failed to load wallet: ${error.message}`);
  if (!data) throw new Error(`Wallet not found: ${classicAddress}`);

  const seed = await decryptSeed(supabase, data.encrypted_seed as string);
  return {
    wallet: Wallet.fromSeed(seed),
    userId: (data.user_id as string | null) ?? null,
    walletType: data.wallet_type as string,
  };
}
