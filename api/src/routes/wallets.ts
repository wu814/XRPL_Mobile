import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createWallet } from "../services/xrpl/wallet/createWallet.js";
import {
  getAccountInfo,
  getAccountLines,
  getAccountObjects,
} from "../services/xrpl/wallet/getWalletInfo.js";
import { authorizeDeposit } from "../services/xrpl/wallet/authorizeDeposit.js";
import {
  setIssuerWalletFlags,
  setTreasuryWalletFlags,
} from "../services/xrpl/wallet/setWalletFlags.js";
import { loadWalletByAddress } from "../services/xrpl/wallet/loadWallet.js";
import { encryptSeed } from "../lib/crypto.js";
import { HttpError } from "../plugins/auth.js";

const addressParam = z.object({ address: z.string().min(25).max(40) });

const createBody = z.object({
  walletType: z.enum(["user", "issuer", "treasury", "pathfind"]).default("user"),
});

const ADMIN_TYPES = new Set(["issuer", "treasury", "pathfind"]);

export async function walletRoutes(app: FastifyInstance) {
  app.get("/", async (req) => {
    const user = await app.requireAuth(req);
    if (user.role === "ADMIN") {
      // Admins see their own user-owned wallets plus all system-level wallets.
      const { data, error } = await app.supabase
        .from("wallets")
        .select("id, classic_address, wallet_type, created_at, user_id")
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .order("wallet_type")
        .order("created_at", { ascending: false });
      if (error) throw new HttpError(500, error.message);
      return data ?? [];
    }
    const { data, error } = await app.supabase
      .from("wallets")
      .select("id, classic_address, wallet_type, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw new HttpError(500, error.message);
    return data ?? [];
  });

  app.get("/by-username/:username", async (req) => {
    await app.requireAuth(req);
    const params = z
      .object({ username: z.string().min(1).max(64) })
      .safeParse(req.params);
    if (!params.success) throw new HttpError(400, "Invalid username");

    const { data: profile } = await app.supabase
      .from("profiles")
      .select("id, username, email")
      .eq("username", params.data.username)
      .maybeSingle();
    if (!profile) throw new HttpError(404, "User not found");

    const { data: wallet } = await app.supabase
      .from("wallets")
      .select("classic_address, wallet_type")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .maybeSingle();
    if (!wallet) throw new HttpError(404, "User has no wallet");

    return {
      username: profile.username,
      classic_address: wallet.classic_address,
      wallet_type: wallet.wallet_type,
    };
  });

  app.post("/", async (req) => {
    const user = await app.requireAuth(req);
    const parse = createBody.safeParse(req.body ?? {});
    if (!parse.success) throw new HttpError(400, "Invalid body");

    const walletType = parse.data.walletType;
    if (ADMIN_TYPES.has(walletType) && user.role !== "ADMIN") {
      throw new HttpError(403, "Only admins can create issuer/treasury/pathfind wallets");
    }

    const client = await app.ensureXrplConnected();
    const { wallet, balanceXrp } = await createWallet(client);
    const encrypted = await encryptSeed(app.supabase, wallet.seed!);

    // Admin-owned wallets (issuer/treasury/pathfind) are system-level — no user_id.
    const userId = ADMIN_TYPES.has(walletType) ? null : user.id;

    const { data, error } = await app.supabase
      .from("wallets")
      .insert({
        user_id: userId,
        classic_address: wallet.classicAddress,
        wallet_type: walletType,
        encrypted_seed: encrypted,
      })
      .select("id, classic_address, wallet_type, created_at")
      .single();

    if (error) throw new HttpError(500, error.message);

    // Apply XRPL flags appropriate to the wallet type (issuer: 5 flags, treasury: deposit-auth, pathfind/user: none).
    try {
      if (walletType === "issuer") {
        const r = await setIssuerWalletFlags(client, wallet);
        if (!r.success) req.log.warn({ err: r.message }, "setIssuerWalletFlags failed");
      } else if (walletType === "treasury") {
        const r = await setTreasuryWalletFlags(client, wallet);
        if (!r.success) req.log.warn({ err: r.message }, "setTreasuryWalletFlags failed");
      }
    } catch (err) {
      req.log.warn({ err: (err as Error).message }, "Setting wallet flags threw");
    }

    return { ...data, balanceXrp };
  });

  app.delete("/:address", async (req) => {
    const user = await app.requireAuth(req);
    const params = addressParam.safeParse(req.params);
    if (!params.success) throw new HttpError(400, "Invalid address");

    if (user.role === "ADMIN") {
      // Admins can delete any wallet they own or any system-level wallet.
      const { error } = await app.supabase
        .from("wallets")
        .delete()
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .eq("classic_address", params.data.address);
      if (error) throw new HttpError(500, error.message);
      return { ok: true };
    }
    const { error } = await app.supabase
      .from("wallets")
      .delete()
      .eq("user_id", user.id)
      .eq("classic_address", params.data.address);
    if (error) throw new HttpError(500, error.message);
    return { ok: true };
  });

  app.get("/:address/info", async (req) => {
    await app.requireAuth(req);
    const params = addressParam.safeParse(req.params);
    if (!params.success) throw new HttpError(400, "Invalid address");

    const client = await app.ensureXrplConnected();
    try {
      return await getAccountInfo(client, params.data.address);
    } catch (err) {
      throw new HttpError(404, (err as Error).message);
    }
  });

  app.get("/:address/lines", async (req) => {
    await app.requireAuth(req);
    const params = addressParam.safeParse(req.params);
    if (!params.success) throw new HttpError(400, "Invalid address");

    const client = await app.ensureXrplConnected();
    return getAccountLines(client, params.data.address);
  });

  app.get("/:address/objects", async (req) => {
    await app.requireAuth(req);
    const params = addressParam.safeParse(req.params);
    if (!params.success) throw new HttpError(400, "Invalid address");

    const client = await app.ensureXrplConnected();
    return getAccountObjects(client, params.data.address);
  });

  app.post("/:address/flags", async (req) => {
    const user = await app.requireAuth(req);
    const params = addressParam.safeParse(req.params);
    if (!params.success) throw new HttpError(400, "Invalid address");

    const body = z.object({ preset: z.enum(["issuer", "treasury"]) }).safeParse(req.body ?? {});
    if (!body.success) throw new HttpError(400, "Invalid preset");

    if (user.role !== "ADMIN") throw new HttpError(403, "Admin only for setting flags");

    const client = await app.ensureXrplConnected();
    const { wallet } = await loadWalletByAddress(app.supabase, params.data.address);
    const result =
      body.data.preset === "issuer"
        ? await setIssuerWalletFlags(client, wallet)
        : await setTreasuryWalletFlags(client, wallet);
    if (!result.success) throw new HttpError(400, result.message ?? "Failed to set flags");
    return result;
  });

  app.post("/:address/authorize-deposit", async (req) => {
    await app.requireAuth(req);
    const params = addressParam.safeParse(req.params);
    if (!params.success) throw new HttpError(400, "Invalid address");

    const body = z
      .object({ authorizedAddress: z.string().min(25).max(40) })
      .safeParse(req.body ?? {});
    if (!body.success) throw new HttpError(400, "Invalid body");

    const client = await app.ensureXrplConnected();
    const { wallet } = await loadWalletByAddress(app.supabase, params.data.address);
    return authorizeDeposit(client, wallet, body.data.authorizedAddress);
  });
}
