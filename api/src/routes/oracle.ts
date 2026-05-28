import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { HttpError } from "../plugins/auth.js";
import { loadWalletByAddress } from "../services/xrpl/wallet/loadWallet.js";
import { deleteOracle, setOracle } from "../services/xrpl/oracle/manageOracle.js";

const setBody = z.object({
  walletAddress: z.string().min(25),
  oracleDocumentId: z.number().int().nonnegative(),
  provider: z.string().min(1).max(256),
  assetClass: z.string().min(1).max(16),
  baseAsset: z.string().min(3).max(40),
  quoteAsset: z.string().min(3).max(40),
  price: z.number().positive(),
  scale: z.number().int().min(0).max(10),
  uri: z.string().max(256).optional(),
});

const deleteBody = z.object({
  walletAddress: z.string().min(25),
  oracleDocumentId: z.number().int().nonnegative(),
});

export async function oracleRoutes(app: FastifyInstance) {
  app.post("/", async (req) => {
    await app.requireAdmin(req);
    const parse = setBody.safeParse(req.body ?? {});
    if (!parse.success) throw new HttpError(400, "Invalid body");

    const client = await app.ensureXrplConnected();
    const { wallet } = await loadWalletByAddress(app.supabase, parse.data.walletAddress);
    return setOracle(client, wallet, {
      oracleDocumentId: parse.data.oracleDocumentId,
      provider: parse.data.provider,
      assetClass: parse.data.assetClass,
      baseAsset: parse.data.baseAsset,
      quoteAsset: parse.data.quoteAsset,
      price: parse.data.price,
      scale: parse.data.scale,
      uri: parse.data.uri,
    });
  });

  app.delete("/", async (req) => {
    await app.requireAdmin(req);
    const parse = deleteBody.safeParse(req.body ?? {});
    if (!parse.success) throw new HttpError(400, "Invalid body");

    const client = await app.ensureXrplConnected();
    const { wallet } = await loadWalletByAddress(app.supabase, parse.data.walletAddress);
    return deleteOracle(client, wallet, parse.data.oracleDocumentId);
  });
}
