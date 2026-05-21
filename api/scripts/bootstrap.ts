/**
 * Bootstrap issuer + treasury wallets for the demo.
 *
 * Run once with: `npm run bootstrap`
 *
 * Idempotent: if issuer/treasury rows already exist in `wallets`, no new
 * funded wallets are created. Otherwise it funds new wallets via the XRPL
 * Testnet faucet, encrypts their seeds, and inserts them.
 *
 * After running, set issuer/treasury flags by hitting the running API at
 * POST /admin/wallets/:address/flags  body {"preset":"issuer"} (admin auth).
 */
import "dotenv/config";
import { Client } from "xrpl";
import { createClient } from "@supabase/supabase-js";
import { env } from "../src/lib/env.js";
import {
  setIssuerWalletFlags,
  setTreasuryWalletFlags,
} from "../src/services/xrpl/wallet/setWalletFlags.js";
import { encryptSeed } from "../src/lib/crypto.js";

async function main() {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const client = new Client(env.XRPL_NETWORK);
  await client.connect();

  console.log("Connected to", env.XRPL_NETWORK);

  const { data: existing, error: existingErr } = await supabase
    .from("wallets")
    .select("classic_address, wallet_type, encrypted_seed")
    .in("wallet_type", ["issuer", "treasury"]);
  if (existingErr) throw existingErr;

  const byType = Object.fromEntries(
    (existing ?? []).map((w) => [w.wallet_type as string, w]),
  );

  for (const role of ["issuer", "treasury"] as const) {
    if (byType[role]) {
      console.log(`-> ${role} already exists at`, byType[role]!.classic_address);
      continue;
    }
    console.log(`Creating ${role} via Testnet faucet...`);
    const fund = await client.fundWallet();
    const wallet = fund.wallet;
    console.log(`   -> ${wallet.classicAddress} (${fund.balance} XRP)`);

    const encrypted = await encryptSeed(supabase, wallet.seed!);
    const { error } = await supabase.from("wallets").insert({
      user_id: null,
      classic_address: wallet.classicAddress,
      wallet_type: role,
      encrypted_seed: encrypted,
    });
    if (error) throw error;

    console.log(`Setting ${role} flags...`);
    if (role === "issuer") {
      const result = await setIssuerWalletFlags(client, wallet);
      if (!result.success) console.warn("issuer flags warning:", result.message);
    } else {
      const result = await setTreasuryWalletFlags(client, wallet);
      if (!result.success) console.warn("treasury flags warning:", result.message);
    }
  }

  await client.disconnect();
  console.log("\nBootstrap done. Use POST /admin/promote with your email to grant ADMIN role.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
