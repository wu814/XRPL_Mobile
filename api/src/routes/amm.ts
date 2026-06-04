import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { HttpError } from "../plugins/auth.js";
import { loadWalletByAddress } from "../services/xrpl/wallet/loadWallet.js";
import { createAMM } from "../services/xrpl/amm/createAMM.js";
import { getFormattedAMMInfo } from "../services/xrpl/amm/ammInfo.js";
import {
  addLiquidityOneAssetLPToken,
  addLiquiditySingleAsset,
  addLiquidityTwoAsset,
  addLiquidityTwoAssetLPToken,
} from "../services/xrpl/amm/addLiquidity.js";
import {
  withdrawAllLiquidity,
  withdrawAllSingleAsset,
  withdrawLiquidityTwoAsset,
  withdrawSingleAsset,
  withdrawSingleAssetWithLPToken,
  withdrawWithLPToken,
} from "../services/xrpl/amm/withdrawLiquidity.js";
import { sendCrossCurrency } from "../services/xrpl/transaction/sendCrossCurrency.js";
import { checkTrustline, setTrustline, trustlineExists } from "../services/xrpl/trustline/setTrustline.js";

const LP_TRUST_LIMIT = "1000000000000000";

const createAmmBody = z.object({
  treasuryAddress: z.string().min(25),
  issuerAddress: z.string().min(25),
  currency1: z.string().min(3),
  value1: z.number().positive(),
  currency2: z.string().min(3),
  value2: z.number().positive(),
  tradingFee: z.number().int().min(0).max(1000).default(500),
});

const addLiquidityBody = z.discriminatedUnion("depositType", [
  z.object({
    depositType: z.literal("twoAsset"),
    walletAddress: z.string().min(25),
    addValue1: z.string(),
    addValue2: z.string(),
  }),
  z.object({
    depositType: z.literal("twoAssetLPToken"),
    walletAddress: z.string().min(25),
    addValue1: z.string(),
    addValue2: z.string(),
    lpTokenValue: z.string(),
  }),
  z.object({
    depositType: z.literal("oneAsset"),
    walletAddress: z.string().min(25),
    addValue1: z.string(),
    selectedCurrency: z.string().min(3),
  }),
  z.object({
    depositType: z.literal("oneAssetLPToken"),
    walletAddress: z.string().min(25),
    addValue1: z.string(),
    selectedCurrency: z.string().min(3),
    lpTokenValue: z.string(),
  }),
]);

const withdrawBody = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("twoAsset"),
    walletAddress: z.string().min(25),
    withdrawValue1: z.string(),
    withdrawValue2: z.string(),
  }),
  z.object({
    mode: z.literal("lpToken"),
    walletAddress: z.string().min(25),
    lpTokenValue: z.string(),
  }),
  z.object({
    mode: z.literal("all"),
    walletAddress: z.string().min(25),
  }),
  z.object({
    mode: z.literal("singleAsset"),
    walletAddress: z.string().min(25),
    singleWithdrawCurrency: z.string().min(3),
    singleWithdrawValue: z.string(),
  }),
  z.object({
    mode: z.literal("singleAssetAll"),
    walletAddress: z.string().min(25),
    singleWithdrawCurrency: z.string().min(3),
  }),
  z.object({
    mode: z.literal("singleAssetLp"),
    walletAddress: z.string().min(25),
    singleWithdrawCurrency: z.string().min(3),
    lpTokenValue: z.string(),
  }),
]);

const swapBody = z.object({
  walletAddress: z.string().min(25),
  sendCurrency: z.string().min(3),
  receiveCurrency: z.string().min(3),
  issuerAddress: z.string().min(25),
  paymentType: z.enum(["exact_input", "exact_output"]).default("exact_input"),
  sendAmount: z.number().positive().optional(),
  exactOutputAmount: z.number().positive().optional(),
  slippagePercent: z.number().min(0).default(0),
});

async function ensureLpTrustline(
  client: Awaited<ReturnType<FastifyInstance["ensureXrplConnected"]>>,
  wallet: Awaited<ReturnType<typeof loadWalletByAddress>>["wallet"],
  lpToken: { currency: string; issuer: string },
) {
  const ready = await checkTrustline(client, wallet.classicAddress, lpToken.issuer, lpToken.currency);
  if (ready) return;

  const exists = await trustlineExists(client, wallet.classicAddress, lpToken.issuer, lpToken.currency);
  if (!exists) {
    await setTrustline(client, wallet, lpToken.currency, lpToken.issuer, LP_TRUST_LIMIT);
  }
}

async function cleanupAmmIfGone(
  app: FastifyInstance,
  req: { log: { warn: (obj: object, msg: string) => void } },
  client: Awaited<ReturnType<FastifyInstance["ensureXrplConnected"]>>,
  ammAccount: string,
): Promise<boolean> {
  const ammStillExists = await getFormattedAMMInfo(client, ammAccount);
  if (ammStillExists) return false;

  const { error: deleteError } = await app.supabase.from("amms").delete().eq("account", ammAccount);
  if (deleteError) {
    req.log.warn({ err: deleteError.message }, "Failed to delete AMM record from DB");
    return false;
  }
  return true;
}

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

    const info = await getFormattedAMMInfo(client, params.data.account);
    if (!info) throw new HttpError(404, "AMM not found");

    const pool = {
      formattedAmount1: info.formattedAmount1,
      formattedAmount2: info.formattedAmount2,
      lpToken: info.lpToken,
    };

    await ensureLpTrustline(client, wallet, info.lpToken);

    switch (parse.data.depositType) {
      case "twoAsset":
        return addLiquidityTwoAsset(client, wallet, pool, parse.data.addValue1, parse.data.addValue2);
      case "twoAssetLPToken":
        return addLiquidityTwoAssetLPToken(
          client,
          wallet,
          pool,
          parse.data.addValue1,
          parse.data.addValue2,
          parse.data.lpTokenValue,
        );
      case "oneAsset":
        return addLiquiditySingleAsset(
          client,
          wallet,
          pool,
          parse.data.addValue1,
          parse.data.selectedCurrency,
        );
      case "oneAssetLPToken":
        return addLiquidityOneAssetLPToken(
          client,
          wallet,
          pool,
          parse.data.addValue1,
          parse.data.selectedCurrency,
          parse.data.lpTokenValue,
        );
    }
  });

  app.delete("/:account/liquidity", async (req) => {
    const user = await app.requireAuth(req);
    const params = z.object({ account: z.string().min(25) }).safeParse(req.params);
    if (!params.success) throw new HttpError(400, "Invalid account");
    const parse = withdrawBody.safeParse(req.body ?? {});
    if (!parse.success) throw new HttpError(400, "Invalid body");

    const client = await app.ensureXrplConnected();
    const { wallet, userId } = await loadWalletByAddress(app.supabase, parse.data.walletAddress);
    if (userId !== user.id && user.role !== "ADMIN") throw new HttpError(403, "Wallet does not belong to you");

    const info = await getFormattedAMMInfo(client, params.data.account);
    if (!info) throw new HttpError(404, "AMM not found");

    const pool = {
      formattedAmount1: info.formattedAmount1,
      formattedAmount2: info.formattedAmount2,
      lpToken: info.lpToken,
    };

    let result: { hash: string };
    switch (parse.data.mode) {
      case "twoAsset":
        result = await withdrawLiquidityTwoAsset(
          client,
          wallet,
          pool,
          parse.data.withdrawValue1,
          parse.data.withdrawValue2,
        );
        break;
      case "lpToken":
        result = await withdrawWithLPToken(client, wallet, pool, parse.data.lpTokenValue);
        break;
      case "all":
        result = await withdrawAllLiquidity(client, wallet, pool);
        break;
      case "singleAsset":
        result = await withdrawSingleAsset(
          client,
          wallet,
          pool,
          parse.data.singleWithdrawCurrency,
          parse.data.singleWithdrawValue,
        );
        break;
      case "singleAssetAll":
        result = await withdrawAllSingleAsset(
          client,
          wallet,
          pool,
          parse.data.singleWithdrawCurrency,
        );
        break;
      case "singleAssetLp":
        result = await withdrawSingleAssetWithLPToken(
          client,
          wallet,
          pool,
          parse.data.singleWithdrawCurrency,
          parse.data.lpTokenValue,
        );
        break;
    }

    const poolDeleted = await cleanupAmmIfGone(app, req, client, params.data.account);
    return { ...result, poolDeleted };
  });

  app.post("/:account/swap", async (req) => {
    const user = await app.requireAuth(req);
    const params = z.object({ account: z.string().min(25) }).safeParse(req.params);
    if (!params.success) throw new HttpError(400, "Invalid account");
    const parse = swapBody.safeParse(req.body ?? {});
    if (!parse.success) throw new HttpError(400, "Invalid body");

    const client = await app.ensureXrplConnected();
    const { wallet, userId } = await loadWalletByAddress(app.supabase, parse.data.walletAddress);
    if (userId !== user.id && user.role !== "ADMIN") throw new HttpError(403, "Wallet does not belong to you");

    const info = await getFormattedAMMInfo(client, params.data.account);
    if (!info) throw new HttpError(404, "AMM not found");

    const { paymentType, sendAmount, exactOutputAmount, slippagePercent } = parse.data;
    if (paymentType === "exact_input" && !sendAmount) {
      throw new HttpError(400, "sendAmount required for exact_input");
    }
    if (paymentType === "exact_output" && !exactOutputAmount) {
      throw new HttpError(400, "exactOutputAmount required for exact_output");
    }

    return sendCrossCurrency({
      client,
      senderWallet: wallet,
      destinationAddress: wallet.classicAddress,
      sendCurrency: parse.data.sendCurrency,
      receiveCurrency: parse.data.receiveCurrency,
      issuerAddress: parse.data.issuerAddress,
      mode: paymentType,
      sendAmount,
      exactOutputAmount,
      slippagePercent,
    });
  });
}
