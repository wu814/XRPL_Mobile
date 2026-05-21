import fp from "fastify-plugin";
import type { FastifyError, FastifyRequest } from "fastify";
import { verifySupabaseJwt } from "../lib/jwt.js";

export interface AuthUser {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
  username: string | null;
}

declare module "fastify" {
  interface FastifyInstance {
    requireAuth: (req: FastifyRequest) => Promise<AuthUser>;
    requireAdmin: (req: FastifyRequest) => Promise<AuthUser>;
  }
  interface FastifyRequest {
    authUser?: AuthUser;
  }
}

class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export const authPlugin = fp(async (app) => {
  const requireAuth = async (req: FastifyRequest): Promise<AuthUser> => {
    if (req.authUser) return req.authUser;

    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw new HttpError(401, "Missing bearer token");
    }
    const token = header.slice("Bearer ".length).trim();

    let claims: { sub: string; email?: string };
    try {
      claims = await verifySupabaseJwt(token);
    } catch (err) {
      req.log.warn({ err: (err as Error).message }, "JWT verification failed");
      throw new HttpError(401, "Unauthorized");
    }

    const { data: profile, error } = await app.supabase
      .from("profiles")
      .select("id, email, role, username")
      .eq("id", claims.sub)
      .maybeSingle();

    if (error) {
      req.log.error({ err: error.message }, "Failed to load profile");
      throw new HttpError(500, "Failed to load profile");
    }

    if (!profile) {
      throw new HttpError(404, "Profile not found - call POST /auth/profile after sign-in");
    }

    const user: AuthUser = {
      id: profile.id as string,
      email: profile.email as string,
      role: (profile.role as "USER" | "ADMIN") ?? "USER",
      username: (profile.username as string | null) ?? null,
    };
    req.authUser = user;
    return user;
  };

  const requireAdmin = async (req: FastifyRequest): Promise<AuthUser> => {
    const user = await requireAuth(req);
    if (user.role !== "ADMIN") {
      throw new HttpError(403, "Forbidden - admin only");
    }
    return user;
  };

  app.decorate("requireAuth", requireAuth);
  app.decorate("requireAdmin", requireAdmin);

  app.setErrorHandler((err: FastifyError | HttpError, req, reply) => {
    if (err instanceof HttpError) {
      return reply.status(err.statusCode).send({ error: err.message });
    }
    const status = (err as FastifyError).statusCode ?? 500;
    if (status >= 500) {
      req.log.error({ err: err.message, stack: (err as Error).stack }, "Unhandled error");
    }
    return reply.status(status).send({ error: err.message ?? "Internal error" });
  });
});

export { HttpError };
