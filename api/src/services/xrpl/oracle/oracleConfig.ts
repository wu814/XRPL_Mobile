import type { SupabaseClient } from "@supabase/supabase-js";

export const DEFAULT_ORACLE_DOCUMENT_ID = 1;

export async function getTreasuryAddress(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase
    .from("wallets")
    .select("classic_address")
    .eq("wallet_type", "treasury")
    .order("created_at", { ascending: true })
    .limit(1);
  return (data?.[0]?.classic_address as string | undefined) ?? null;
}
