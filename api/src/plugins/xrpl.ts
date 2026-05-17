import fp from "fastify-plugin";
import { Client } from "xrpl";
import { env } from "../lib/env.js";

declare module "fastify" {
  interface FastifyInstance {
    xrpl: Client;
    ensureXrplConnected: () => Promise<Client>;
  }
}

export const xrplPlugin = fp(async (app) => {
  const client = new Client(env.XRPL_NETWORK);

  const ensureConnected = async () => {
    if (!client.isConnected()) {
      app.log.info({ network: env.XRPL_NETWORK }, "Connecting to XRPL");
      await client.connect();
      app.log.info("XRPL connected");
    }
    return client;
  };

  app.decorate("xrpl", client);
  app.decorate("ensureXrplConnected", ensureConnected);

  app.addHook("onClose", async () => {
    if (client.isConnected()) {
      await client.disconnect();
      app.log.info("XRPL disconnected");
    }
  });
});
