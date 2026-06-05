# Database setup (new Supabase project)

These steps are manual. Run them once when bootstrapping a fresh Supabase project for this app.

## 1. Create the project

Sign in at https://supabase.com and create a new project. Pick the closest region. Save the **publishable key**, **secret key**, and the project URL into the `api/.env` file (see `api/.env.example`). Legacy dashboard labels “anon” / “service_role” map to publishable / secret — see [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys).

The API verifies user JWTs against the project's public JWKS endpoint (`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`), so no JWT signing secret is needed in `.env`. New Supabase projects (created on or after Oct 1, 2025) use asymmetric signing keys by default; older projects can migrate via **Project Settings -> JWT signing keys -> Migrate JWT secret**.

## 2. Apply the schema

Open Supabase dashboard -> SQL Editor -> New query. Paste the contents of [`schema.sql`](./schema.sql) and run. This creates:

- Extensions: `pgcrypto`
- Enums: `role_type`, `wallet_type`, `friend_request_status`
- Tables: `profiles`, `wallets`, `amms`, `friend_requests`, `favorites`, `nfts_meta`
- RLS enabled (default deny; service role bypasses)

## 3. Configure Auth providers

Authentication -> Providers:

- **Google**: enable, paste OAuth client ID + secret. Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.

Authentication -> URL Configuration -> add the Expo redirect:

- `xrplmobile://auth-callback`

## 4. Generate a seed encryption key

This key encrypts XRPL seeds at rest via `pgp_sym_encrypt`. Generate a 32+ byte random string:

```bash
openssl rand -base64 48
```

Put it in `api/.env` as `SEED_ENCRYPTION_KEY`. Never commit it.

## 5. Bootstrap admin

After the API is running and you have signed in once with your demo Google account so a `profiles` row exists, mark yourself admin:

```sql
update public.profiles set role = 'ADMIN' where email = 'you@example.com';
```

Or call `POST /admin/promote` once an existing admin has been created (chicken-and-egg: the first admin must be set via SQL).

## 6. Create issuer + treasury (+ pathfind) wallets

Once you are `ADMIN` and the API is running, create system wallets from the mobile Home tab (**Create Wallet**), or call `POST /wallets` with `walletType: "issuer" | "treasury" | "pathfind"`. Each request funds a new wallet via the XRPL Testnet faucet, encrypts the seed, inserts a row into `wallets` with `user_id` null, and applies issuer/treasury XRPL flags when applicable.

Alternatively, `POST /admin/bootstrap` (admin auth) creates issuer and treasury in one call if they do not already exist.

## 7. Migrating existing projects

If your Supabase project was created before pathfind support landed, re-run `schema.sql` (it's idempotent) or apply just the enum migration:

```sql
alter type wallet_type add value if not exists 'pathfind';
```
