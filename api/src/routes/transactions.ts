import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { HttpError } from "../plugins/auth.js";
import { loadWalletByAddress } from "../services/xrpl/wallet/loadWallet.js";
import { sendXRP } from "../services/xrpl/transaction/sendXRP.js";
import { sendIOU } from "../services/xrpl/transaction/sendIOU.js";

const sendXrpBody = z.object({
  walletAddress: z.string().min(25),
  destination: z.string().min(25),
  xrpAmount: z.number().positive(),
  destinationTag: z.number().int().nonnegative().optional(),
});

const sendIouBody = z.object({
  walletAddress: z.string().min(25),
  destination: z.string().min(25),
  currency: z.string().min(3),
  issuer: z.string().min(25),
  value: z.string(),
});

export async function transactionRoutes(app: FastifyInstance) {
  app.post("/xrp", async (req) => {
    const user = await app.requireAuth(req);
    const parse = sendXrpBody.safeParse(req.body ?? {});
    if (!parse.success) throw new HttpError(400, "Invalid body");

    const client = await app.ensureXrplConnected();
    const { wallet, userId } = await loadWalletByAddress(app.supabase, parse.data.walletAddress);
    if (userId !== user.id && user.role !== "ADMIN") throw new HttpError(403, "Wallet does not belong to you");

    return sendXRP(
      client,
      wallet,
      parse.data.destination,
      parse.data.xrpAmount,
      parse.data.destinationTag,
    );
  });

  app.post("/iou", async (req) => {
    const user = await app.requireAuth(req);
    const parse = sendIouBody.safeParse(req.body ?? {});
    if (!parse.success) throw new HttpError(400, "Invalid body");

    const client = await app.ensureXrplConnected();
    const { wallet, userId } = await loadWalletByAddress(app.supabase, parse.data.walletAddress);
    if (userId !== user.id && user.role !== "ADMIN") throw new HttpError(403, "Wallet does not belong to you");

    return sendIOU(client, wallet, parse.data.destination, {
      currency: parse.data.currency,
      issuer: parse.data.issuer,
      value: parse.data.value,
    });
  });
}
