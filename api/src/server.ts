import Fastify from "fastify";
import cors from "@fastify/cors";
import { env, corsOrigins } from "./lib/env.js";
import { supabasePlugin } from "./plugins/supabase.js";
import { xrplPlugin } from "./plugins/xrpl.js";
import { authPlugin } from "./plugins/auth.js";
import { registerRoutes } from "./routes/index.js";

async function buildServer() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport:
        env.NODE_ENV === "development"
          ? { target: "pino-pretty", options: { translateTime: "SYS:HH:MM:ss" } }
          : undefined,
    },
    trustProxy: true,
  });

  await app.register(cors, {
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  });

  await app.register(supabasePlugin);
  await app.register(xrplPlugin);
  await app.register(authPlugin);

  app.get("/health", async () => ({ status: "ok", uptime: process.uptime() }));

  await registerRoutes(app);

  return app;
}

async function main() {
  const app = await buildServer();
  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "Shutting down");
    await app.close();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

void main();
