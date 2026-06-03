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
  app/                          # Expo Router screens (thin — import from src/features)
    _layout.tsx                 # Auth gate + QueryClient + theme
    sign-in.tsx
    (tabs)/
      index.tsx                 # re-exports HomeScreen
      advanced.tsx              # links to DEX / AMM / NFT under app/advanced/
      transactions.tsx, friends.tsx, settings.tsx
    advanced/                   # dex.tsx, amm.tsx, nft.tsx
    wallet/[address].tsx
    amm/[account].tsx
  src/
    api/                        # REST client wrappers
    hooks/                      # TanStack Query hooks (+ query key helpers)
    features/                   # UI by product area
      home/                     # UserHome, AdminHome, StickyActions
      wallet/                   # cards, WalletActionSheet, CreateAdminWalletModal
      payments/                 # SendSheet, SmartTradeSheet, CurrencySelectorSheet
      dex/                      # order book + place order + orders panel
      shared/                   # AssetTable, CurrencyIconImage, TransactionRow, …
    components/ui/              # AppSheet, tab bar icons, haptic tab
    lib/                        # formatters, walletAssets, dex math, supabase, …
    constants/theme.ts
    stores/auth.ts
```

## Auth flow

1. User signs in with Google OAuth or Magic Link via Supabase Auth.
2. Supabase issues a JWT, stored in **Expo SecureStore**.
3. Every request to `api/` carries `Authorization: Bearer <jwt>`.
4. On first sign-in, the app calls `POST /auth/profile` to create the `profiles` row.
5. Admin Home (issuer / treasury / pathfind wallets) appears when `profile.role === 'ADMIN'`.

## OAuth redirect

The app uses scheme `xrplmobile://`. Add the following to Supabase Auth -> URL Configuration:

```
xrplmobile://auth-callback
```

Also add the same URI to your Google OAuth client's authorized redirect URIs.
