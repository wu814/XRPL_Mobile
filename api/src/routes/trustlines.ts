import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { HttpError } from "../plugins/auth.js";
import { loadWalletByAddress } from "../services/xrpl/wallet/loadWallet.js";
import { setTrustline } from "../services/xrpl/trustline/setTrustline.js";

const setBody = z.object({
  walletAddress: z.string().min(25),
  currency: z.string().min(3),
  issuer: z.string().min(25),
  limit: z.string(),
});

export async function trustlineRoutes(app: FastifyInstance) {
  app.post("/", async (req) => {
    const user = await app.requireAuth(req);
    const parse = setBody.safeParse(req.body ?? {});
    if (!parse.success) throw new HttpError(400, "Invalid body");

    const client = await app.ensureXrplConnected();
    const { wallet, userId } = await loadWalletByAddress(app.supabase, parse.data.walletAddress);
    if (userId !== user.id && user.role !== "ADMIN") throw new HttpError(403, "Wallet does not belong to you");

    return setTrustline(client, wallet, parse.data.currency, parse.data.issuer, parse.data.limit);
  });
}
