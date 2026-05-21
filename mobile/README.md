# `mobile/` - Expo (React Native) app for `xrpl_mobile`

Custodial XRPL Testnet mobile client. Talks only to the [`api/`](../api/README.md) backend via REST + Bearer JWT obtained from Supabase Auth.

## Stack

- **Expo (managed)** + Expo Router + TypeScript
- **NativeWind** (Tailwind for RN)
- **TanStack Query** + **Zustand**
- **react-hook-form** + **zod**
- **Supabase JS** (auth-only) + **expo-secure-store**
- **axios** for the REST client

## Setup

```bash
cp .env.example .env
# fill in EXPO_PUBLIC_API_URL, EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY

npm install
npm run ios     # or `npm run android`
```

When running against a remote API (e.g. Railway), set `EXPO_PUBLIC_API_URL` to the public URL. When running both api and mobile locally, use `http://YOUR-LAN-IP:3001` so the simulator can reach it (`localhost` won't work from a physical device).

## Layout

```
mobile/
  app/
    _layout.tsx                     # Auth gate + QueryClient + theme
    sign-in.tsx                     # Google + Magic Link
    (tabs)/
      _layout.tsx                   # Bottom tabs
      index.tsx                     # Home (wallets list)
      trade.tsx, amm.tsx, nft.tsx, friends.tsx, settings.tsx, admin.tsx
    wallet/[address].tsx            # Wallet detail
    amm/[account].tsx               # AMM pool detail
  src/
    api/                            # Axios + endpoint wrappers
    hooks/                          # TanStack Query hooks
    components/
    lib/
      supabase.ts                   # auth-only client
      api/client.ts                 # Axios with Bearer header injection
      secureStore.ts                # Expo SecureStore adapter
      formatters.ts                 # Pure TS helpers (duplicated from xrpl_mvp)
      env.ts, queryClient.ts
    stores/auth.ts                  # Zustand auth state
```

## Auth flow

1. User signs in with Google OAuth or Magic Link via Supabase Auth.
2. Supabase issues a JWT, stored in **Expo SecureStore**.
3. Every request to `api/` carries `Authorization: Bearer <jwt>`.
4. On first sign-in, the app calls `POST /auth/profile` to create the `profiles` row.
5. The Admin tab is conditionally rendered when `profile.role === 'ADMIN'`.

## OAuth redirect

The app uses scheme `xrplmobile://`. Add the following to Supabase Auth -> URL Configuration:

```
xrplmobile://auth-callback
```

Also add the same URI to your Google OAuth client's authorized redirect URIs.
