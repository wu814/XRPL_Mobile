# `api/` - Fastify backend for `xrpl_mobile`

Custodial XRPL Testnet backend. The mobile app talks only to this service via REST + Bearer JWT.

## Stack

- **Fastify** + TypeScript (Node 20)
- **`xrpl`** SDK (Testnet WebSocket)
- **`@supabase/supabase-js`** (service role)
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

After applying the schema and signing in once via the mobile app, run:

```bash
npm run bootstrap
```

This creates issuer + treasury wallets via the Testnet faucet, encrypts their seeds, and inserts them into `wallets`.

Then promote your demo email to `ADMIN`:

```sql
update public.profiles set role = 'ADMIN' where email = 'you@example.com';
```

## Build / Docker

```bash
npm run build                       # TS -> dist/
docker build -t xrpl-mobile-api .
docker run -p 3001:3001 --env-file .env xrpl-mobile-api
```

## Deploy

See [`RAILWAY.md`](./RAILWAY.md).

## Endpoint inventory

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/health` | Liveness |
| `GET` | `/auth/me` | Current profile |
| `POST` | `/auth/profile` | Idempotent profile creation after first sign-in |
| `GET` | `/auth/check-username` | Username availability |
| `GET / POST / DELETE` | `/wallets[/...]` | List, create, delete, info, lines, objects, flags, authorize-deposit |
| `POST` | `/trustlines` | Set trustline |
| `POST` | `/transactions/xrp \| /iou` | Direct payments |
| `POST / GET / DELETE` | `/dex/offers[/...]` | DEX offer create / cancel / list / book |
| `GET / POST / DELETE` | `/amm[/...]` | AMM list / create / info / liquidity / swap |
| `POST / GET` | `/nft[/...]` | Mint-and-list / buy / by-account |
| `GET / POST / DELETE` | `/friends[/...]` | Friend graph + favorites |
| `POST / GET` | `/admin[/...]` | Bootstrap, issue, fund, promote (ADMIN only) |

## Custody disclaimer

XRPL seeds are stored **encrypted at rest** with `pgp_sym_encrypt` and a key supplied via `SEED_ENCRYPTION_KEY`. The mobile client never sees seeds. This is appropriate for a Testnet demo; **do not adapt to mainnet** without redesigning custody (HSM, KMS, multi-sig, etc.).
