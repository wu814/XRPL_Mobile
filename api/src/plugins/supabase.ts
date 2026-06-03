import fp from "fastify-plugin";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";
import { env } from "../lib/env.js";

declare module "fastify" {
  interface FastifyInstance {
    supabase: SupabaseClient;
  }
}

export const supabasePlugin = fp(async (app) => {
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    realtime: {
      transport: ws as any,
    },
  });

  app.decorate("supabase", client);
  app.log.info("Supabase secret-key client ready");
});
