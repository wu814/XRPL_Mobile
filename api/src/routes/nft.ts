import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { HttpError } from "../plugins/auth.js";
import { loadWalletByAddress } from "../services/xrpl/wallet/loadWallet.js";
import {
  acceptNFTSellOffer,
  createNFTSellOffer,
  getAccountNFTs,
  mintNFT,
} from "../services/xrpl/nft/nftManager.js";

const mintAndListBody = z.object({
  walletAddress: z.string().min(25),
  uri: z.string().min(1),
  priceXrp: z.number().positive(),
  destination: z.string().optional(),
  taxon: z.number().int().nonnegative().optional(),
});

const buyBody = z.object({
  walletAddress: z.string().min(25),
  offerID: z.string().min(20),
});

export async function nftRoutes(app: FastifyInstance) {
  app.post("/mint-and-list", async (req) => {
    const user = await app.requireAuth(req);
    const parse = mintAndListBody.safeParse(req.body ?? {});
    if (!parse.success) throw new HttpError(400, "Invalid body");

    const client = await app.ensureXrplConnected();
    const { wallet, userId } = await loadWalletByAddress(app.supabase, parse.data.walletAddress);
    if (userId !== user.id && user.role !== "ADMIN") throw new HttpError(403, "Wallet does not belong to you");

    const mint = await mintNFT(client, wallet, parse.data.uri, parse.data.taxon ?? 1001);
    const offer = await createNFTSellOffer(
      client,
      wallet,
      mint.nftTokenID,
      Math.floor(parse.data.priceXrp * 1_000_000).toString(),
      parse.data.destination,
    );
    return { ...mint, ...offer };
  });

  app.post("/buy", async (req) => {
    const user = await app.requireAuth(req);
    const parse = buyBody.safeParse(req.body ?? {});
    if (!parse.success) throw new HttpError(400, "Invalid body");

    const client = await app.ensureXrplConnected();
    const { wallet, userId } = await loadWalletByAddress(app.supabase, parse.data.walletAddress);
    if (userId !== user.id && user.role !== "ADMIN") throw new HttpError(403, "Wallet does not belong to you");

    return acceptNFTSellOffer(client, wallet, parse.data.offerID);
  });

  app.get("/by-account/:address", async (req) => {
    await app.requireAuth(req);
    const params = z.object({ address: z.string().min(25) }).safeParse(req.params);
    if (!params.success) throw new HttpError(400, "Invalid address");

    const client = await app.ensureXrplConnected();
    return getAccountNFTs(client, params.data.address);
  });
}
