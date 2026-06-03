# xrpl_mobile

Custodial **XRPL Testnet** mobile app (React Native + Expo) backed by a containerized Fastify API on Railway. End-to-end TypeScript, single repo, two services.

> **Testnet only. Custodial demo.** This project is built as a portfolio piece, not a wallet you should use for real funds. Private XRPL seeds are stored server-side, encrypted at rest with `pgcrypto`. The mobile app never sees seeds.

## Architecture

```
+-------------------+   HTTPS + Bearer JWT    +----------------------------+
|  mobile/  (Expo)  |  ---------------------> |  api/  (Fastify, Docker)   |
+---------+---------+                         +---+----------+-------------+
          |                                       |          |
          | Supabase Auth (Google / Magic Link)   |          | xrpl SDK
          v                                       v          v
   +-------------+                       +----------------+  +-------------+
   |  Supabase   |    secret key         |  Supabase DB   |  |  XRPL       |
   |  Auth       | <-------------------- |  (Postgres +   |  |  Testnet    |
   +-------------+                       |   pgcrypto)    |  +-------------+
                                         +----------------+
```

- `mobile/` - Expo Router app, TypeScript, NativeWind, TanStack Query, Zustand. See [`mobile/README.md`](./mobile/README.md).
- `api/` - Fastify on Node 20, ports 35+ XRPL helpers from the original web app. See [`api/README.md`](./api/README.md) and [`api/RAILWAY.md`](./api/RAILWAY.md).
- `api/db/` - SQL schema + setup notes for a fresh Supabase project. See [`api/db/README.md`](./api/db/README.md).

## Features

| Area | Mobile screen | API surface |
|------|---------------|-------------|
| Auth | `sign-in.tsx` + auth gate | `/auth/me`, `/auth/profile` |
| Wallets | Home tab + `wallet/[address]` | `/wallets/...` |
| DEX | Trade tab | `/dex/offers/...` |
| AMM | AMM tab + `amm/[account]` | `/amm/...` |
| NFT | NFT tab | `/nft/...` |
| Friends | Friends tab (sub-tabs: Friends / Requests / Favorites) | `/friends/...` |
| Admin | Admin tab (gated by `profiles.role = 'ADMIN'`) | `/admin/...` |

## Stack at a glance

- **Mobile:** React Native (Expo) + Expo Router + TypeScript + NativeWind + TanStack Query + Zustand + react-hook-form + zod
- **Backend:** Node 20 + Fastify + `xrpl` SDK + `@supabase/supabase-js` (secret key) + Pino + zod + jose (JWT)
- **Database:** Supabase Postgres (UUID schema, `pgcrypto`-encrypted seeds, RLS default-deny)
- **Auth:** Supabase Auth (Google OAuth + Email Magic Link) + Expo SecureStore for JWT persistence
- **Deploy:** Railway (Docker container for `api/`)
- **Ledger:** XRPL Testnet (`wss://s.altnet.rippletest.net:51233`)

## Quick start

```bash
# 1. Set up Supabase (one-time, see api/db/README.md)
# 2. Backend
cd api
cp .env.example .env       # fill in keys
npm install
npm run dev

# 3. Mobile (in another terminal)
cd mobile
cp .env.example .env       # set EXPO_PUBLIC_*
npm install
npm run ios                # or npm run android
```

After signing in once, promote your demo account in SQL:

```sql
update public.profiles set role = 'ADMIN' where email = 'you@example.com';
```

Sign in again, then on the Home tab use **Create Wallet** to add issuer, treasury, and pathfind wallets (Testnet faucet + XRPL flags are applied automatically). The admin Home screen appears when `profiles.role = 'ADMIN'`.

## Hosting with Railway

**Railway** is a hosted platform that runs your **`api/`** service on the public internet. It is not used for the mobile app or Supabase — only the Fastify backend.

When you connect this repo to Railway (see [`api/RAILWAY.md`](./api/RAILWAY.md)):

1. Railway watches your GitHub repo and, on each push, runs `docker build` using [`api/Dockerfile`](./api/Dockerfile).
2. It starts the resulting container with your env vars (Supabase secret key, encryption key, XRPL URLs, `CORS_ORIGINS`, etc.).
3. Railway assigns a public HTTPS URL (e.g. `https://your-app.up.railway.app`) and routes traffic to port `3001` inside the container.
4. You set `EXPO_PUBLIC_API_URL` in `mobile/.env` to that URL so phones and simulators call the hosted API instead of `localhost`.

Locally you run the same API with `npm run dev`. On Railway you run the **production build** (`node dist/server.js`) inside Docker — the same artifact you can test with `docker run` on your machine.

**What stays elsewhere:** Supabase (auth + Postgres) and XRPL Testnet are external services; Railway only hosts the Node process that talks to them.

## Docker (optional, local)

Docker is **not** required for day-to-day development. Cloners should use `npm run dev` in `api/` (see Quick start above).

Use Docker locally when you want to:

- Run the **same production image** Railway deploys, before pushing
- Avoid relying on your machine’s Node version for a smoke test
- Confirm `npm run build` and the container start cleanly (e.g. after changing `Dockerfile` or dependencies)

```bash
cd api
cp .env.example .env    # same keys as npm run dev
npm install
docker build -t xrpl-mobile-api .
docker run -p 3001:3001 --env-file .env xrpl-mobile-api
# GET http://localhost:3001/health
```

Stop `npm run dev` first if port 3001 is already in use. After code changes, rebuild the image. Full notes: [`api/README.md`](./api/README.md#build--docker).

## Repo layout

```
xrpl_mobile/
  mobile/             # Expo app (React Native)
  api/                # Fastify backend (Docker)
    db/               # SQL schema + setup notes
  .github/workflows/  # CI: typecheck + build for both folders
```

## Screenshots

Add iOS simulator captures to [`docs/screenshots/`](./docs/screenshots/) and reference them here once captured. See `docs/screenshots/README.md` for the recommended set (Home, Trade, AMM, NFT, Admin).

## Disclaimers

- **Testnet only.** Use the Testnet faucet; never fund this app from mainnet.
- **Custodial.** XRPL seeds are stored encrypted at rest in Supabase; the API has the encryption key in env. This is a deliberate trade-off for a portfolio demo - production custody requires KMS / HSM / multi-sig.
- **Not affiliated** with the XRP Ledger Foundation or Ripple.
