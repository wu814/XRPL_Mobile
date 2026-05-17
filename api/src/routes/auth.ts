import type { FastifyInstance } from "fastify";
import { jwtVerify } from "jose";
import { z } from "zod";
import { env } from "../lib/env.js";

const usernameSchema = z
  .string()
  .min(3)
  .max(24)
  .regex(/^[a-zA-Z0-9_]+$/, "username may contain letters, digits, and underscores");

const profileBodySchema = z.object({
  username: usernameSchema.optional(),
});

const jwtSecret = new TextEncoder().encode(env.SUPABASE_JWT_SECRET);

export async function authRoutes(app: FastifyInstance) {
  app.get("/me", async (req, reply) => {
    try {
      const user = await app.requireAuth(req);
      return user;
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === "Unauthorized") return reply.status(401).send({ error: msg });
      if (msg.includes("Profile not found")) return reply.status(404).send({ error: msg });
      return reply.status(500).send({ error: msg });
    }
  });

  app.post("/profile", async (req, reply) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "Missing bearer token" });
    }
    const token = header.slice("Bearer ".length).trim();

    let claims: { sub: string; email?: string };
    try {
      const { payload } = await jwtVerify(token, jwtSecret, { algorithms: ["HS256"] });
      claims = {
        sub: payload.sub as string,
        email: typeof payload.email === "string" ? payload.email : undefined,
      };
    } catch {
      return reply.status(401).send({ error: "Invalid token" });
    }

    if (!claims.email) {
      return reply.status(400).send({ error: "JWT missing email claim" });
    }

    const parse = profileBodySchema.safeParse(req.body ?? {});
    if (!parse.success) {
      return reply.status(400).send({ error: parse.error.flatten() });
    }

    const { data: existing } = await app.supabase
      .from("profiles")
      .select("id, username, email, role")
      .eq("id", claims.sub)
      .maybeSingle();

    if (existing) {
      if (parse.data.username && existing.username !== parse.data.username) {
        const { data: usernameTaken } = await app.supabase
          .from("profiles")
          .select("id")
          .eq("username", parse.data.username)
          .neq("id", claims.sub)
          .maybeSingle();
        if (usernameTaken) {
          return reply.status(409).send({ error: "Username taken" });
        }
        const { data: updated, error: updateErr } = await app.supabase
          .from("profiles")
          .update({ username: parse.data.username })
          .eq("id", claims.sub)
          .select("id, email, role, username")
          .single();
        if (updateErr) return reply.status(500).send({ error: updateErr.message });
        return updated;
      }
      return existing;
    }

    if (parse.data.username) {
      const { data: usernameTaken } = await app.supabase
        .from("profiles")
        .select("id")
        .eq("username", parse.data.username)
        .maybeSingle();
      if (usernameTaken) {
        return reply.status(409).send({ error: "Username taken" });
      }
    }

    const { data: inserted, error: insertErr } = await app.supabase
      .from("profiles")
      .insert({
        id: claims.sub,
        email: claims.email,
        username: parse.data.username ?? null,
        role: "USER",
      })
      .select("id, email, role, username")
      .single();

    if (insertErr) return reply.status(500).send({ error: insertErr.message });
    return inserted;
  });

  app.get("/check-username", async (req, reply) => {
    const schema = z.object({ username: usernameSchema });
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ available: false, error: "Invalid username" });
    }
    const { data } = await app.supabase
      .from("profiles")
      .select("id")
      .eq("username", parsed.data.username)
      .maybeSingle();
    return { available: !data };
  });
}
