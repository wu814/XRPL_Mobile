# Database setup (new Supabase project)

These steps are manual. Run them once when bootstrapping a fresh Supabase project for this app.

## 1. Create the project

Sign in at https://supabase.com and create a new project. Pick the closest region. Save the **anon key**, **service role key**, **JWT secret**, and the project URL into the `api/.env` file (see `api/.env.example`).

## 2. Apply the schema

Open Supabase dashboard -> SQL Editor -> New query. Paste the contents of [`schema.sql`](./schema.sql) and run. This creates:

- Extensions: `pgcrypto`
- Enums: `role_type`, `wallet_type`, `friend_request_status`
- Tables: `profiles`, `wallets`, `amms`, `friend_requests`, `favorites`, `nfts_meta`
- RLS enabled (default deny; service role bypasses)

## 3. Configure Auth providers

Authentication -> Providers:

- **Google**: enable, paste OAuth client ID + secret. Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
- **Email**: enable Magic Link. Disable password sign-up if you want passwordless only.

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

## 6. Bootstrap issuer + treasury wallets

Once the API has env vars set, run:

```bash
cd api
npm run bootstrap
```

This creates one issuer wallet and one treasury wallet via the XRPL Testnet faucet, encrypts their seeds, and inserts them into `wallets` with `wallet_type = 'issuer' | 'treasury'`.
