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
   |  Supabase   |    service role       |  Supabase DB   |  |  XRPL       |
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
- **Backend:** Node 20 + Fastify + `xrpl` SDK + `@supabase/supabase-js` (service role) + Pino + zod + jose (JWT)
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

After signing in once, run `npm run bootstrap` in `api/` to create the issuer and treasury wallets via the XRPL Testnet faucet. Then promote your demo account in SQL:

```sql
update public.profiles set role = 'ADMIN' where email = 'you@example.com';
```

The Admin tab will appear automatically in the mobile app on next sign-in.

## Repo layout

```
xrpl_mobile/
  mobile/             # Expo app (React Native)
  api/                # Fastify backend (Docker)
    db/               # SQL schema + setup notes
    scripts/          # bootstrap.ts (idempotent issuer/treasury setup)
  .github/workflows/  # CI: typecheck + build for both folders
```

## Screenshots

Add iOS simulator captures to [`docs/screenshots/`](./docs/screenshots/) and reference them here once captured. See `docs/screenshots/README.md` for the recommended set (Home, Trade, AMM, NFT, Admin).

## Disclaimers

- **Testnet only.** Use the Testnet faucet; never fund this app from mainnet.
- **Custodial.** XRPL seeds are stored encrypted at rest in Supabase; the API has the encryption key in env. This is a deliberate trade-off for a portfolio demo - production custody requires KMS / HSM / multi-sig.
- **Not affiliated** with the XRP Ledger Foundation or Ripple.
