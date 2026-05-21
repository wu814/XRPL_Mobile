# Deploying `api/` to Railway

This service is containerized via [`Dockerfile`](./Dockerfile). Railway auto-detects the Dockerfile and builds the image for each push.

## One-time setup

1. Push the `xrpl_mobile` repo to GitHub.
2. Sign in to https://railway.app and click **New Project -> Deploy from GitHub repo**.
3. Select the `xrpl_mobile` repo.
4. In **Settings -> Source**:
   - **Root Directory:** `api`
   - **Builder:** Dockerfile (auto-detected)
5. In **Settings -> Networking**, generate a public domain. Note the URL (e.g. `https://xrpl-mobile-api-production.up.railway.app`).
6. Add **Variables** (Settings -> Variables) - copy from [`.env.example`](./.env.example):

   | Variable | Where to find it |
   |----------|------------------|
   | `PORT` | `3001` |
   | `NODE_ENV` | `production` |
   | `LOG_LEVEL` | `info` |
   | `SUPABASE_URL` | Supabase Project Settings -> API |
   | `SUPABASE_SECRET_KEY` | Supabase Project Settings -> API (secret key) |
   | `SEED_ENCRYPTION_KEY` | `openssl rand -base64 48` |
   | `XRPL_NETWORK` | `wss://s.altnet.rippletest.net:51233` |
   | `XRPL_FAUCET_URL` | `https://faucet.altnet.rippletest.net/accounts` |
   | `CORS_ORIGINS` | Comma-separated list of allowed origins (Expo dev URL + production app URL) |

7. Trigger a redeploy. Railway will run `docker build .` from `api/` then start the container with `node dist/server.js`.

> JWTs from Supabase Auth are verified against the project's public JWKS endpoint (`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`), so no JWT signing secret needs to be stored in Railway. Rotating signing keys in the Supabase dashboard takes effect without a redeploy.

## Pointing the mobile app at Railway

In `mobile/.env` (or `mobile/app.json -> extra`):

```
EXPO_PUBLIC_API_URL=https://your-railway-domain.up.railway.app
```

Restart the Expo dev server so Metro picks up the new env.

## Health check

Railway uses `GET /health` which returns:

```json
{ "status": "ok", "uptime": 12.345 }
```

Configure this in Railway's **Settings -> Health Checks** if you want an explicit probe.

## Logs

Railway's dashboard streams stdout. Pino emits structured JSON logs in production - paste a line into a JSON viewer for readability, or use Railway's filter UI.
