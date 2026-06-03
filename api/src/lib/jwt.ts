import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { env } from "./env.js";

// Supabase exposes its JWT signing keys (asymmetric and/or migrated legacy
// symmetric) at the JWKS discovery endpoint. jose caches the keys in memory
// and refetches on unknown `kid`, so this object is safe to keep at module
// scope.
const jwks = createRemoteJWKSet(
  new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`),
);

const issuer = `${env.SUPABASE_URL}/auth/v1`;

interface SupabaseClaims {
  sub: string;
  email?: string;
  payload: JWTPayload;
}

export async function verifySupabaseJwt(token: string): Promise<SupabaseClaims> {
  const { payload } = await jwtVerify(token, jwks, {
    issuer,
    clockTolerance: "30s",
  });

  if (typeof payload.sub !== "string") {
    throw new Error("JWT missing sub claim");
  }

  return {
    sub: payload.sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
    payload,
  };
}
