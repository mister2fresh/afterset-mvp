# Afterset

Fan-capture SaaS for gigging musicians. Artists create capture pages, collect fan emails at shows via QR/NFC/SMS, and send automated follow-up email sequences.

## Prerequisites

- [Node.js](https://nodejs.org/) (v20+)
- [pnpm](https://pnpm.io/) (v9+)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for local development and migrations)
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (for Cloudflare Worker development/deployment)

## First-run setup

```bash
# Install dependencies
pnpm install

# Create environment files from examples
cp api/.env.example api/.env
cp web/.env.example web/.env
# Then fill in the values — see "Environment variables" below

# Start Supabase locally (Postgres, Auth, Studio)
supabase start

# Apply database migrations
supabase db push
```

## Environment variables

### API (`api/.env`)

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `RESEND_API_KEY` | Resend email sending key |
| `RESEND_WEBHOOK_SECRET` | Resend webhook signing secret |
| `TELNYX_PHONE_NUMBER` | Telnyx toll-free number for SMS |
| `BATCH_SEND_SECRET` | Shared secret for pg_cron send-batch webhook |
| `UNSUBSCRIBE_HMAC_SECRET` | HMAC key for unsubscribe token signing |
| `DOWNLOAD_HMAC_SECRET` | HMAC key for download token signing |
| `CAN_SPAM_ADDRESS` | Physical mailing address for CAN-SPAM footer |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID (R2 uploads) |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | R2 access key |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | R2 secret key |
| `CLOUDFLARE_R2_BUCKET` | R2 bucket name (default: `afterset-capture-pages`) |
| `API_BASE_URL` | Public API URL (default: `http://localhost:3000`) |
| `PORT` | API server port (default: `3000`) |

### Web (`web/.env`)

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public key |

### Worker (`worker/wrangler.toml`)

`SUPABASE_URL` is set in `wrangler.toml`. `SUPABASE_SERVICE_ROLE_KEY` must be set as a Wrangler secret:

```bash
cd worker && npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

## Local development

Start any combination of services depending on what you're working on:

```bash
pnpm dev:web              # Vite SPA → http://localhost:5173
pnpm dev:api              # Hono API → http://localhost:3000
pnpm dev:worker           # Cloudflare Worker (local)
```

The web app proxies API requests to `localhost:3000`. Supabase local services run on ports 54321–54327 (Studio UI at `localhost:54323`).

Auth uses Supabase magic links — in local dev, check the Inbucket email UI at `localhost:54324`.

## Build & quality

```bash
pnpm build:web            # tsc + vite build → web/dist/
pnpm build:api            # tsc --noEmit (typecheck gate; production runs via tsx)
pnpm test                 # Vitest (API tests)
pnpm lint                 # Biome check --write across all packages
pnpm typecheck            # tsc --noEmit across all packages
```

## Deployment

| Component | Platform | Command |
|---|---|---|
| API | Railway | Deploys on push to `main` |
| Web (dashboard) | Cloudflare Pages | Deploys on push to `main` |
| Worker (fan-facing) | Cloudflare Workers | `pnpm deploy:worker` |
| Database | Supabase | `supabase db push` for migrations |

## Architecture

Three packages in a pnpm workspace:

- **`web/`** — Vite + React 19 SPA (artist dashboard). TanStack Router + Query, Tailwind CSS v4, Recharts.
- **`api/`** — Hono on Node.js. Handles auth, CRUD, email sending, analytics, SMS keywords. Runs via `tsx` in both dev and production.
- **`worker/`** — Cloudflare Worker. Serves pre-built static capture pages from R2 and handles fan email submissions (bypasses the API for speed).

Fan-facing capture pages are static HTML (~5KB) stored in Cloudflare R2. The Worker serves them and processes form submissions directly to Supabase, keeping the critical fan-facing path independent of the API server.

See `afterset/docs/adr/` for full Architecture Decision Records.
