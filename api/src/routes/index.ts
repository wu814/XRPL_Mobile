import type { FastifyInstance } from "fastify";
import { authRoutes } from "./auth.js";
import { walletRoutes } from "./wallets.js";
import { trustlineRoutes } from "./trustlines.js";
import { transactionRoutes } from "./transactions.js";
import { dexRoutes } from "./dex.js";
import { ammRoutes } from "./amm.js";
import { nftRoutes } from "./nft.js";
import { friendRoutes } from "./friends.js";
import { adminRoutes } from "./admin.js";

export async function registerRoutes(app: FastifyInstance) {
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(walletRoutes, { prefix: "/wallets" });
  await app.register(trustlineRoutes, { prefix: "/trustlines" });
  await app.register(transactionRoutes, { prefix: "/transactions" });
  await app.register(dexRoutes, { prefix: "/dex" });
  await app.register(ammRoutes, { prefix: "/amm" });
  await app.register(nftRoutes, { prefix: "/nft" });
  await app.register(friendRoutes, { prefix: "/friends" });
  await app.register(adminRoutes, { prefix: "/admin" });
}
