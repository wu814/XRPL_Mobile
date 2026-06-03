import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { HttpError } from "../plugins/auth.js";
import { loadWalletByAddress } from "../services/xrpl/wallet/loadWallet.js";
import { createWallet } from "../services/xrpl/wallet/createWallet.js";
import { encryptSeed } from "../lib/crypto.js";
import { sendIOU } from "../services/xrpl/transaction/sendIOU.js";
import {
  setIssuerWalletFlags,
  setTreasuryWalletFlags,
} from "../services/xrpl/wallet/setWalletFlags.js";

const issueBody = z.object({
  treasuryAddress: z.string().min(25),
  destinationAddress: z.string().min(25),
  currency: z.string().min(3),
  issuerAddress: z.string().min(25),
  value: z.string(),
});

const promoteBody = z.object({
  email: z.string().email(),
});

export async function adminRoutes(app: FastifyInstance) {
  app.get("/wallets", async (req) => {
    await app.requireAdmin(req);
    const { data, error } = await app.supabase
      .from("wallets")
      .select("id, classic_address, wallet_type, created_at, user_id")
      .order("wallet_type");
    if (error) throw new HttpError(500, error.message);
    return data ?? [];
  });

  app.post("/bootstrap", async (req) => {
    await app.requireAdmin(req);
    const client = await app.ensureXrplConnected();

    const { data: existing } = await app.supabase
      .from("wallets")
      .select("classic_address, wallet_type")
      .in("wallet_type", ["issuer", "treasury"]);
    const existingMap = Object.fromEntries(
      (existing ?? []).map((w) => [w.wallet_type as string, w.classic_address as string]),
    );

    const created: Record<string, string> = {};

    for (const role of ["issuer", "treasury"] as const) {
      if (existingMap[role]) {
        created[role] = existingMap[role]!;
        continue;
      }
      const { wallet } = await createWallet(client);
      const encrypted = await encryptSeed(app.supabase, wallet.seed!);
      const { error } = await app.supabase.from("wallets").insert({
        user_id: null,
        classic_address: wallet.classicAddress,
        wallet_type: role,
        encrypted_seed: encrypted,
      });
      if (error) throw new HttpError(500, error.message);
      created[role] = wallet.classicAddress;

      if (role === "issuer") {
        await setIssuerWalletFlags(client, wallet);
      } else {
        await setTreasuryWalletFlags(client, wallet);
      }
    }

    return { issuer: created["issuer"], treasury: created["treasury"] };
  });

  app.post("/issue", async (req) => {
    await app.requireAdmin(req);
    const parse = issueBody.safeParse(req.body ?? {});
    if (!parse.success) throw new HttpError(400, "Invalid body");

    const client = await app.ensureXrplConnected();
    const { wallet: treasury, walletType } = await loadWalletByAddress(
      app.supabase,
      parse.data.treasuryAddress,
    );
    if (walletType !== "treasury") throw new HttpError(400, "Wallet must be treasury type");

    return sendIOU(client, treasury, parse.data.destinationAddress, {
      currency: parse.data.currency,
      issuer: parse.data.issuerAddress,
      value: parse.data.value,
    });
  });

  app.post("/promote", async (req) => {
    await app.requireAdmin(req);
    const parse = promoteBody.safeParse(req.body ?? {});
    if (!parse.success) throw new HttpError(400, "Invalid body");
    const { error } = await app.supabase
      .from("profiles")
      .update({ role: "ADMIN" })
      .eq("email", parse.data.email);
    if (error) throw new HttpError(500, error.message);
    return { ok: true };
  });
}
