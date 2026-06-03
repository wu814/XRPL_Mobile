# `api/` - Fastify backend for `xrpl_mobile`

Custodial XRPL Testnet backend. The mobile app talks only to this service via REST + Bearer JWT.

## Stack

- **Fastify** + TypeScript (Node 20)
- **`xrpl`** SDK (Testnet WebSocket)
- **`@supabase/supabase-js`** (secret key / elevated server client)
- **`pgcrypto`** for encrypted seeds at rest
- **Pino** structured logs

## Local development

```bash
cp .env.example .env
# fill in Supabase keys, JWT secret, encryption key, etc.

npm install
npm run dev   # tsx watch on src/server.ts
```

API listens on `http://localhost:3001` by default. Health check at `GET /health`.

## Database

See [`db/README.md`](./db/README.md) and [`db/schema.sql`](./db/schema.sql).

After applying the schema and signing in once via the mobile app, promote your demo email to `ADMIN`:

```sql
update public.profiles set role = 'ADMIN' where email = 'you@example.com';
```

Then create issuer, treasury, and pathfind wallets from the mobile Home tab (**Create Wallet**), or call `POST /wallets` with `walletType` as an admin. Wallets are funded via the Testnet faucet; issuer and treasury XRPL flags are set automatically.

## Build / Docker

**When to use:** Optional for local work. Prefer `npm run dev` for feature development (hot reload). Use Docker to mirror the **production** process Railway runs: compile TypeScript, install production deps, start `node dist/server.js` in a clean Node 20 image.

**Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) and a filled-in `api/.env` (same variables as local dev).

```bash
npm run build                       # optional on host; the image runs build inside Docker
docker build -t xrpl-mobile-api .
docker run -p 3001:3001 --env-file .env xrpl-mobile-api
```

- Health check: `GET http://localhost:3001/health`
- Only one process should bind port 3001 (stop `npm run dev` before `docker run`)
- Rebuild the image after changing `src/`, `Dockerfile`, or `package.json`

The Supabase client passes the `ws` package as Realtime transport so Node 20 in the container works (native WebSocket is Node 22+).

## Deploy

Production deploy uses this Dockerfile on **[Railway](https://railway.app)** — Railway builds and runs the container on push. See [`RAILWAY.md`](./RAILWAY.md).

## Endpoint inventory

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/health` | Liveness |
| `GET` | `/auth/me` | Current profile |
| `POST` | `/auth/profile` | Idempotent profile creation after first sign-in |
| `GET` | `/auth/check-username` | Username availability |
| `GET / POST / DELETE` | `/wallets[/...]` | List, create, delete, info, lines, authorize-deposit |
| `POST` | `/trustlines` | Set trustline |
| `POST` | `/transactions/xrp \| /iou` | Direct payments |
| `POST / GET / DELETE` | `/dex/offers[/...]` | DEX offer create / cancel / list / book |
| `GET / POST / DELETE` | `/amm[/...]` | AMM list / create / info / liquidity / swap |
| `POST / GET` | `/nft[/...]` | Mint-and-list / buy / by-account |
| `GET / POST / DELETE` | `/friends[/...]` | Friend graph + favorites |
| `POST / GET` | `/admin[/...]` | Wallets list, one-shot issuer/treasury setup, issue, promote (ADMIN only) |

## Custody disclaimer

XRPL seeds are stored **encrypted at rest** with `pgp_sym_encrypt` and a key supplied via `SEED_ENCRYPTION_KEY`. The mobile client never sees seeds. This is appropriate for a Testnet demo; **do not adapt to mainnet** without redesigning custody (HSM, KMS, multi-sig, etc.).
