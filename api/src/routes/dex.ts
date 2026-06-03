import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { HttpError } from "../plugins/auth.js";
import { loadWalletByAddress } from "../services/xrpl/wallet/loadWallet.js";
import { createOffer } from "../services/xrpl/dex/createOffer.js";
import { cancelOffer } from "../services/xrpl/dex/cancelOffer.js";
import {
  getBookOffers,
  getCompletedOffers,
  getUserOffers,
} from "../services/xrpl/dex/getOffers.js";

const amountSchema = z.union([
  z.string().regex(/^\d+$/, "drops as decimal string"),
  z.object({
    currency: z.string().min(3),
    issuer: z.string().min(25),
    value: z.string(),
  }),
]);

const createOfferBody = z
  .object({
    walletAddress: z.string().min(25),
    takerPays: amountSchema,
    takerGets: amountSchema,
    execution: z.enum(["gtc", "ioc", "fok"]).default("gtc"),
    passive: z.boolean().optional().default(false),
    sell: z.boolean().optional().default(false),
  })
  .refine((d) => !d.passive || d.execution === "gtc", {
    message: "Post-only (passive) requires GTC execution",
    path: ["passive"],
  });

const bookOffersQuery = z.object({
  takerGetsCurrency: z.string().min(3),
  takerGetsIssuer: z.string().optional(),
  takerPaysCurrency: z.string().min(3),
  takerPaysIssuer: z.string().optional(),
});

export async function dexRoutes(app: FastifyInstance) {
  app.post("/offers", async (req) => {
    const user = await app.requireAuth(req);
    const parse = createOfferBody.safeParse(req.body ?? {});
    if (!parse.success) throw new HttpError(400, "Invalid body");

    const client = await app.ensureXrplConnected();
    const { wallet, userId } = await loadWalletByAddress(app.supabase, parse.data.walletAddress);
    if (userId !== user.id && user.role !== "ADMIN") {
      throw new HttpError(403, "Wallet does not belong to you");
    }

    return createOffer(client, wallet, parse.data.takerPays as never, parse.data.takerGets as never, {
      execution: parse.data.execution,
      passive: parse.data.passive,
      sell: parse.data.sell,
    });
  });

  app.delete("/offers/:sequence", async (req) => {
    const user = await app.requireAuth(req);
    const params = z.object({ sequence: z.coerce.number().int().positive() }).safeParse(req.params);
    if (!params.success) throw new HttpError(400, "Invalid sequence");

    const body = z.object({ walletAddress: z.string().min(25) }).safeParse(req.body ?? {});
    if (!body.success) throw new HttpError(400, "walletAddress required in body");

    const client = await app.ensureXrplConnected();
    const { wallet, userId } = await loadWalletByAddress(app.supabase, body.data.walletAddress);
    if (userId !== user.id && user.role !== "ADMIN") {
      throw new HttpError(403, "Wallet does not belong to you");
    }
    return cancelOffer(client, wallet, params.data.sequence);
  });

  app.get("/offers/user/:address", async (req) => {
    await app.requireAuth(req);
    const params = z.object({ address: z.string().min(25) }).safeParse(req.params);
    if (!params.success) throw new HttpError(400, "Invalid address");

    const client = await app.ensureXrplConnected();
    return getUserOffers(client, params.data.address);
  });

  app.get("/offers/completed/:address", async (req) => {
    await app.requireAuth(req);
    const params = z.object({ address: z.string().min(25) }).safeParse(req.params);
    if (!params.success) throw new HttpError(400, "Invalid address");

    const client = await app.ensureXrplConnected();
    return getCompletedOffers(client, params.data.address);
  });

  app.get("/offers/book", async (req) => {
    await app.requireAuth(req);
    const parse = bookOffersQuery.safeParse(req.query);
    if (!parse.success) throw new HttpError(400, "Invalid query");

    const takerGets =
      parse.data.takerGetsCurrency === "XRP"
        ? { currency: "XRP" }
        : { currency: parse.data.takerGetsCurrency, issuer: parse.data.takerGetsIssuer ?? "" };
    const takerPays =
      parse.data.takerPaysCurrency === "XRP"
        ? { currency: "XRP" }
        : { currency: parse.data.takerPaysCurrency, issuer: parse.data.takerPaysIssuer ?? "" };

    const client = await app.ensureXrplConnected();
    return getBookOffers(client, takerGets as never, takerPays as never);
  });
}
