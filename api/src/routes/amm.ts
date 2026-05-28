import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { HttpError } from "../plugins/auth.js";
import { loadWalletByAddress } from "../services/xrpl/wallet/loadWallet.js";
import { createAMM } from "../services/xrpl/amm/createAMM.js";
import { getFormattedAMMInfo } from "../services/xrpl/amm/ammInfo.js";
import { addLiquidityTwoAsset } from "../services/xrpl/amm/addLiquidity.js";
import { withdrawWithLPToken } from "../services/xrpl/amm/withdrawLiquidity.js";
import { swap } from "../services/xrpl/amm/swap.js";

const assetSchema = z.object({
  currency: z.string().min(3),
  issuer: z.string().default(""),
  value: z.string(),
});

const createAmmBody = z.object({
  treasuryAddress: z.string().min(25),
  issuerAddress: z.string().min(25),
  currency1: z.string().min(3),
  value1: z.number().positive(),
  currency2: z.string().min(3),
  value2: z.number().positive(),
  tradingFee: z.number().int().min(0).max(1000).default(500),
});

const addLiquidityBody = z.object({
  walletAddress: z.string().min(25),
  amount1: assetSchema,
  amount2: assetSchema,
});

const withdrawBody = z.object({
  walletAddress: z.string().min(25),
  asset1: z.object({ currency: z.string(), issuer: z.string().default("") }),
  asset2: z.object({ currency: z.string(), issuer: z.string().default("") }),
  lpToken: z.object({ currency: z.string(), issuer: z.string(), value: z.string() }),
});

const swapBody = z.object({
  walletAddress: z.string().min(25),
  sendMax: z.union([z.string(), assetSchema]),
  destinationAmount: z.union([z.string(), assetSchema]),
});

export async function ammRoutes(app: FastifyInstance) {
  app.get("/", async (req) => {
    await app.requireAuth(req);
    const { data, error } = await app.supabase
      .from("amms")
      .select("id, account, currency1, currency2, issuer_address, treasury_address, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new HttpError(500, error.message);
    return data ?? [];
  });

  app.post("/info-by-currencies", async (req) => {
    await app.requireAuth(req);
    const body = z
      .object({ sellCurrency: z.string().min(3), buyCurrency: z.string().min(3) })
      .safeParse(req.body ?? {});
    if (!body.success) throw new HttpError(400, "Invalid body");

    const { sellCurrency, buyCurrency } = body.data;
    const { data: rows } = await app.supabase
      .from("amms")
      .select("account, currency1, currency2");
    const match = (rows ?? []).find(
      (r) =>
        (r.currency1 === sellCurrency && r.currency2 === buyCurrency) ||
        (r.currency1 === buyCurrency && r.currency2 === sellCurrency),
    );
    if (!match) throw new HttpError(404, `No AMM pool found for ${sellCurrency}/${buyCurrency}`);

    const client = await app.ensureXrplConnected();
    const info = await getFormattedAMMInfo(client, match.account as string);
    if (!info) throw new HttpError(404, "AMM not found");
    return info;
  });

  app.get("/:account", async (req) => {
    await app.requireAuth(req);
    const params = z.object({ account: z.string().min(25) }).safeParse(req.params);
    if (!params.success) throw new HttpError(400, "Invalid account");
    const client = await app.ensureXrplConnected();
    const info = await getFormattedAMMInfo(client, params.data.account);
    if (!info) throw new HttpError(404, "AMM not found");
    return info;
  });

  app.post("/", async (req) => {
    const user = await app.requireAdmin(req);
    void user;
    const parse = createAmmBody.safeParse(req.body ?? {});
    if (!parse.success) throw new HttpError(400, "Invalid body");

    const client = await app.ensureXrplConnected();
    const { wallet: treasury } = await loadWalletByAddress(app.supabase, parse.data.treasuryAddress);
    const result = await createAMM({
      client,
      treasuryWallet: treasury,
      issuerAddress: parse.data.issuerAddress,
      currency1: parse.data.currency1,
      value1: parse.data.value1,
      currency2: parse.data.currency2,
      value2: parse.data.value2,
      tradingFee: parse.data.tradingFee,
    });

    const { error } = await app.supabase.from("amms").insert({
      account: result.account,
      currency1: result.currency1,
      currency2: result.currency2,
      issuer_address: parse.data.issuerAddress,
      treasury_address: parse.data.treasuryAddress,
    });
    if (error && !error.message.includes("duplicate")) {
      req.log.warn({ err: error.message }, "Failed to record AMM in DB");
    }
    return result;
  });

  app.post("/:account/liquidity", async (req) => {
    const user = await app.requireAuth(req);
    const params = z.object({ account: z.string().min(25) }).safeParse(req.params);
    if (!params.success) throw new HttpError(400, "Invalid account");
    const parse = addLiquidityBody.safeParse(req.body ?? {});
    if (!parse.success) throw new HttpError(400, "Invalid body");

    const client = await app.ensureXrplConnected();
    const { wallet, userId } = await loadWalletByAddress(app.supabase, parse.data.walletAddress);
    if (userId !== user.id && user.role !== "ADMIN") throw new HttpError(403, "Wallet does not belong to you");
    return addLiquidityTwoAsset(client, wallet, parse.data.amount1, parse.data.amount2);
  });

  app.delete("/:account/liquidity", async (req) => {
    const user = await app.requireAuth(req);
    const parse = withdrawBody.safeParse(req.body ?? {});
    if (!parse.success) throw new HttpError(400, "Invalid body");

    const client = await app.ensureXrplConnected();
    const { wallet, userId } = await loadWalletByAddress(app.supabase, parse.data.walletAddress);
    if (userId !== user.id && user.role !== "ADMIN") throw new HttpError(403, "Wallet does not belong to you");
    return withdrawWithLPToken(client, wallet, parse.data.asset1, parse.data.asset2, parse.data.lpToken);
  });

  app.post("/:account/swap", async (req) => {
    const user = await app.requireAuth(req);
    const parse = swapBody.safeParse(req.body ?? {});
    if (!parse.success) throw new HttpError(400, "Invalid body");

    const client = await app.ensureXrplConnected();
    const { wallet, userId } = await loadWalletByAddress(app.supabase, parse.data.walletAddress);
    if (userId !== user.id && user.role !== "ADMIN") throw new HttpError(403, "Wallet does not belong to you");

    return swap(client, wallet, parse.data.sendMax as never, parse.data.destinationAmount as never);
  });
}
