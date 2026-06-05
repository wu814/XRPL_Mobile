import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { HttpError } from "../plugins/auth.js";
import { loadWalletByAddress } from "../services/xrpl/wallet/loadWallet.js";
import { deleteOracle } from "../services/xrpl/oracle/deleteOracle.js";
import { createLiveCryptoOracle } from "../services/xrpl/oracle/createLiveCryptoOracle.js";
import { getLivePrices } from "../services/xrpl/oracle/getLivePrices.js";
import { DEFAULT_COIN_GECKO_IDS, DEFAULT_VS_CURRENCY } from "../services/xrpl/oracle/coinGecko.js";

const setBody = z.object({
  walletAddress: z.string().min(25),
  oracleDocumentId: z.number().int().nonnegative(),
  coinGeckoIds: z.array(z.string().min(1)).optional(),
  vsCurrency: z.string().min(3).max(10).optional(),
});

const deleteBody = z.object({
  walletAddress: z.string().min(25),
  oracleDocumentId: z.number().int().nonnegative(),
});

export async function oracleRoutes(app: FastifyInstance) {
  app.get("/prices", async (req) => {
    await app.requireAuth(req);
    const client = await app.ensureXrplConnected();
    return getLivePrices(client, app.supabase);
  });

  app.post("/", async (req) => {
    await app.requireAdmin(req);
    const parse = setBody.safeParse(req.body ?? {});
    if (!parse.success) throw new HttpError(400, "Invalid body");

    const client = await app.ensureXrplConnected();
    const { wallet } = await loadWalletByAddress(app.supabase, parse.data.walletAddress);
    return createLiveCryptoOracle(
      client,
      wallet,
      parse.data.oracleDocumentId,
      parse.data.coinGeckoIds ?? [...DEFAULT_COIN_GECKO_IDS],
      parse.data.vsCurrency ?? DEFAULT_VS_CURRENCY,
    );
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
