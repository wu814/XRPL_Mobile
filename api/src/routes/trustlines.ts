import type { FastifyInstance } from "fastify";
import type { Wallet } from "xrpl";
import { z } from "zod";
import { HttpError } from "../plugins/auth.js";
import { loadWalletByAddress } from "../services/xrpl/wallet/loadWallet.js";
import { setTrustline, trustlineExists } from "../services/xrpl/trustline/setTrustline.js";
import { authorizeTrustline } from "../services/xrpl/trustline/authorizeTrustline.js";
import { freezeTrustline } from "../services/xrpl/trustline/freezeTrustline.js";
import {
  awardWelcomeBonus,
  issuerRequiresAuth,
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

    const isStandardToken =
      parse.data.currency !== "XRP" && parse.data.currency.length < 10;
    const eligibleForBonus = walletType === "user" && isStandardToken;

    let issuerWallet: Wallet | undefined;
    let skipAuthorizeForBonus = false;

    if (isStandardToken) {
      const requiresAuth = await issuerRequiresAuth(client, parse.data.issuer);

      if (requiresAuth || eligibleForBonus) {
        try {
          ({ wallet: issuerWallet } = await loadWalletByAddress(
            app.supabase,
            parse.data.issuer,
          ));
        } catch (err) {
          req.log.warn(
            { err: (err as Error).message, issuer: parse.data.issuer },
            "Failed to load issuer wallet after setTrustline",
          );
        }
      }

      if (requiresAuth && issuerWallet) {
        try {
          await authorizeTrustline(
            client,
            issuerWallet,
            parse.data.currency,
            wallet.classicAddress,
          );
          skipAuthorizeForBonus = true;
        } catch (err) {
          req.log.warn(
            { err: (err as Error).message, currency: parse.data.currency },
            "Auto-authorize trustline failed after setTrustline",
          );
        }
      } else if (!requiresAuth) {
        skipAuthorizeForBonus = true;
      }
    }

    // Issue the sign-in bonus in the background so the client is not blocked on a
    // third ledger validation (~4s). Never fails the trustline request.
    if (eligibleForBonus) {
      const bonusParams = {
        client,
        supabase: app.supabase,
        recipientAddress: wallet.classicAddress,
        issuerAddress: parse.data.issuer,
        currency: parse.data.currency,
        issuerWallet,
        skipAuthorize: skipAuthorizeForBonus,
      };

      void awardWelcomeBonus(bonusParams)
        .then((welcomeBonus: WelcomeBonusInfo) => {
          if (welcomeBonus.skipped) {
            req.log.warn(
              {
                welcomeBonus,
                recipient: wallet.classicAddress,
                currency: parse.data.currency,
              },
              "Welcome bonus skipped (background)",
            );
          } else {
            req.log.info(
              {
                transactionHash: welcomeBonus.transactionHash,
                amount: welcomeBonus.amount,
                currency: parse.data.currency,
                recipient: wallet.classicAddress,
              },
              "Welcome bonus issued (background)",
            );
          }
        })
        .catch((err: unknown) => {
          req.log.error(
            {
              err: err instanceof Error ? err.message : err,
              recipient: wallet.classicAddress,
              currency: parse.data.currency,
            },
            "Welcome bonus background task failed",
          );
        });

      return { ...result, trustlineAlreadyExisted: false, welcomeBonusPending: true };
    }

    return { ...result, trustlineAlreadyExisted: false };
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
