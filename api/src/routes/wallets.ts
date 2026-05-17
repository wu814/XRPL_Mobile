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
  walletType: z.enum(["user"]).default("user"),
});

export async function walletRoutes(app: FastifyInstance) {
  app.get("/", async (req) => {
    const user = await app.requireAuth(req);
    const { data, error } = await app.supabase
      .from("wallets")
      .select("id, classic_address, wallet_type, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw new HttpError(500, error.message);
    return data ?? [];
  });

  app.post("/", async (req) => {
    const user = await app.requireAuth(req);
    const parse = createBody.safeParse(req.body ?? {});
    if (!parse.success) throw new HttpError(400, "Invalid body");

    const client = await app.ensureXrplConnected();
    const { wallet, balanceXrp } = await createWallet(client);
    const encrypted = await encryptSeed(app.supabase, wallet.seed!);

    const { data, error } = await app.supabase
      .from("wallets")
      .insert({
        user_id: user.id,
        classic_address: wallet.classicAddress,
        wallet_type: parse.data.walletType,
        encrypted_seed: encrypted,
      })
      .select("id, classic_address, wallet_type, created_at")
      .single();

    if (error) throw new HttpError(500, error.message);
    return { ...data, balanceXrp };
  });

  app.delete("/:address", async (req) => {
    const user = await app.requireAuth(req);
    const params = addressParam.safeParse(req.params);
    if (!params.success) throw new HttpError(400, "Invalid address");

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
