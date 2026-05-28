import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { HttpError } from "../plugins/auth.js";
import { loadWalletByAddress } from "../services/xrpl/wallet/loadWallet.js";
import { setTrustline, trustlineExists } from "../services/xrpl/trustline/setTrustline.js";
import { authorizeTrustline } from "../services/xrpl/trustline/authorizeTrustline.js";
import { freezeTrustline } from "../services/xrpl/trustline/freezeTrustline.js";
import {
  awardWelcomeBonus,
  type WelcomeBonusInfo,
} from "../services/xrpl/wallet/awardWelcomeBonus.js";

const setBody = z.object({
  walletAddress: z.string().min(25),
  currency: z.string().min(3),
  issuer: z.string().min(25),
  limit: z.string(),
});

const authorizeBody = z.object({
  issuerAddress: z.string().min(25),
  currency: z.string().min(3),
  holderAddress: z.string().min(25),
});

const freezeBody = z.object({
  issuerAddress: z.string().min(25),
  currency: z.string().min(3),
  holderAddress: z.string().min(25),
  mode: z.enum(["freeze", "deep_freeze", "unfreeze"]),
});

export async function trustlineRoutes(app: FastifyInstance) {
  app.post("/", async (req) => {
    const user = await app.requireAuth(req);
    const parse = setBody.safeParse(req.body ?? {});
    if (!parse.success) throw new HttpError(400, "Invalid body");

    const client = await app.ensureXrplConnected();
    const { wallet, userId, walletType } = await loadWalletByAddress(
      app.supabase,
      parse.data.walletAddress,
    );
    if (userId !== user.id && user.role !== "ADMIN") throw new HttpError(403, "Wallet does not belong to you");

    const alreadyExisted = await trustlineExists(
      client,
      wallet.classicAddress,
      parse.data.issuer,
      parse.data.currency,
    );

    if (alreadyExisted) {
      return {
        hash: "",
        trustlineAlreadyExisted: true,
        message: `Trustline already exists between ${wallet.classicAddress} and ${parse.data.issuer} for ${parse.data.currency}. No action needed.`,
      };
    }

    const result = await setTrustline(
      client,
      wallet,
      parse.data.currency,
      parse.data.issuer,
      parse.data.limit,
    );

    // Award a one-time welcome gift when a regular user first trusts a token
    // (mirrors xrpl_mvp). Never fails the trustline request.
    let welcomeBonus: WelcomeBonusInfo | undefined;
    if (walletType === "user" && parse.data.currency !== "XRP") {
      welcomeBonus = await awardWelcomeBonus({
        client,
        supabase: app.supabase,
        recipientAddress: wallet.classicAddress,
        issuerAddress: parse.data.issuer,
        currency: parse.data.currency,
      });
    }

    return { ...result, trustlineAlreadyExisted: false, welcomeBonus };
  });

  app.post("/authorize", async (req) => {
    await app.requireAdmin(req);
    const parse = authorizeBody.safeParse(req.body ?? {});
    if (!parse.success) throw new HttpError(400, "Invalid body");

    const client = await app.ensureXrplConnected();
    const { wallet } = await loadWalletByAddress(app.supabase, parse.data.issuerAddress);
    return authorizeTrustline(client, wallet, parse.data.currency, parse.data.holderAddress);
  });

  app.post("/freeze", async (req) => {
    await app.requireAdmin(req);
    const parse = freezeBody.safeParse(req.body ?? {});
    if (!parse.success) throw new HttpError(400, "Invalid body");

    const client = await app.ensureXrplConnected();
    const { wallet } = await loadWalletByAddress(app.supabase, parse.data.issuerAddress);
    return freezeTrustline(
      client,
      wallet,
      parse.data.currency,
      parse.data.holderAddress,
      parse.data.mode,
    );
  });
}
