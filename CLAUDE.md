# Afterset MVP

Fan-capture SaaS for gigging musicians.

## Project structure

```
web/                      # Vite + React SPA (artist dashboard)
  src/routes/             # TanStack Router file-based routes
  src/components/         # Shared components (captures-table, email-template-dialog)
  src/lib/                # Shared utilities (supabase client, api client, auth)
api/                      # Hono API server (Node.js)
  src/routes/             # Hono route modules (capture-pages, email-templates, captures, email, etc.)
  src/lib/email/          # EmailService abstraction, Resend provider, template renderer, suppression
  src/middleware/          # Auth middleware (Bearer token → artist context)
worker/                   # Cloudflare Worker (serves capture pages from R2)
  src/index.ts            # Worker entry point
supabase/migrations/      # SQL migrations (applied via `supabase db push`)
afterset/docs/adr/        # Architecture Decision Records (001–006)
afterset/docs/research/   # Research that informed ADRs
TASKS.md                  # Sprint tracker and task breakdown
BACKLOG.md                # Future feature requests and ideas
biome.json                # Shared Biome config (linter + formatter)
pnpm-workspace.yaml       # pnpm workspace definition
```

## Decided architecture

| Component | Stack | Deployment | Cost |
|---|---|---|---|
| Database + Auth + Jobs | Supabase Pro (Postgres, Auth, pg_cron, Realtime) | Supabase-managed | $25/mo |
| Email | Resend Pro, shared domain `send.afterset.net` | — | $20/mo |
| Capture pages (fan-facing) | Pre-built static HTML (~5KB), form POST to Worker | Cloudflare R2 + CDN + Worker | $0/mo |
| Dashboard (artist-facing) | Vite + React SPA | Cloudflare Pages (free) | $0/mo |
| API | Hono (Node.js) | Railway Hobby | $5/mo |
| SMS text-to-join | Telnyx toll-free, keyword routing | Webhook on Hono API | ~$2/mo |

## Key conventions (from ADRs)

- **Service abstractions from day 1:** `EmailService` (ADR-002) and `SmsService` (ADR-005) wrap providers for future swapability
- **Fan-facing path bypasses the app server:** capture form POSTs to a Cloudflare Worker using Supabase `service_role` key — not through the Hono API
- **Two separate fan-facing deploys:** R2 static HTML (template changes) and Cloudflare Worker (submission logic)
- **Capture pages must fit in the 14KB TCP initial congestion window** — system fonts, inline CSS/JS, no external resources
- **Domain is `afterset.net`** (not .com) — email subdomain is `send.afterset.net`
- **One email template per capture page** — stored in `email_templates` table, editable from page card dropdown or dedicated Emails tab
- **Email templates are plain text** — rendered to HTML at send/preview time via `renderFollowUpHtml()`, no React Email dependency

## Tech stack details

- **Frontend:** Vite + React 19, TanStack Router (file-based) + TanStack Query, Tailwind CSS v4, Recharts
- **Backend:** Hono on Node.js, Supabase client (`service_role` for fan writes, RLS for artist dashboard)
- **Auth:** Supabase Auth (magic link + OAuth), client-side via `supabase.auth.getSession()`, route protection via TanStack Router `beforeLoad`
- **Background jobs:** Supabase pg_cron for delayed follow-up emails
- **SMS:** Telnyx (Twilio is fallback), GSM-7 encoding only in auto-replies
- **Email:** Resend via `EmailService` abstraction — suppression checks, RFC 8058 unsubscribe, CAN-SPAM footer, webhook handler for bounces/complaints
- **Email templates:** CRUD at `/api/capture-pages/:id/email-template` (GET/PUT/DELETE + preview POST), delay modes (immediate/1_hour/next_morning), optional incentive download link

## Commands

```bash
# Development
pnpm dev:web              # Vite SPA at localhost:5173
pnpm dev:api              # Hono API at localhost:3000 (tsx watch)

# Build
pnpm build:web            # tsc + vite build → web/dist/
pnpm build:api            # tsc → api/dist/

# Worker (Cloudflare)
pnpm dev:worker           # wrangler dev (local Worker)
pnpm deploy:worker        # wrangler deploy (push to Cloudflare)

# Quality
pnpm test                 # Vitest run (api tests)
pnpm lint                 # Biome check --write across all packages
pnpm typecheck            # tsc --noEmit across all packages
```

## Design tokens

| Token | Value | Usage |
|---|---|---|
| `midnight` | `#0a0e1a` | Primary background |
| `midnight-light` | `#111827` | Card/surface background |
| `honey-gold` | `#E8C547` | Brand accent, CTAs |
| `electric-blue` | `#3b82f6` | Secondary accent, links |
| `font-display` | Bricolage Grotesque | Headlines (dashboard only) |
| `font-sans` | DM Sans | Body text (dashboard only) |
| `font-mono` | Space Mono | Code/data (dashboard only) |

Capture pages use system font stack — no custom fonts.

## Security

- NEVER pass secrets (API keys, tokens, service role keys) as CLI arguments or in URLs — they leak into shell history and process lists
- To verify a secret is set, check for its presence (e.g., `grep -c SUPABASE_SERVICE_ROLE_KEY .env`) without printing the value
- To test authenticated endpoints, ask the user to run the command interactively (`!` prefix) or use environment variable references (`$VAR`) — never inline the value

## Formatting

- Biome: tabs, double quotes, semicolons, 100-char line width
- Import sorting enforced by Biome assist
- `routeTree.gen.ts` is auto-generated — excluded from lint/format

## MCP: Context7 (Library Documentation)

Context7 is connected via `.mcp.json` and provides live, version-specific documentation for any library or framework.

**Rules:**
- Always use Context7 MCP tools to look up current API signatures, patterns, and examples BEFORE writing or planning code that uses external libraries.
- This applies to ALL libraries in our stack: Hono, Supabase (`@supabase/supabase-js`, `@supabase/ssr`), Cloudflare Workers, TanStack Router, TanStack Query, Tailwind CSS v4, Zod, Resend, Telnyx, Recharts, and shadcn/ui.
- If Context7 returns no results for a library, say so — do not fall back to guessing from training data without flagging it.
- When a prompt includes a specific library version (e.g. "Hono v4", "Next.js 16"), pass that version context to Context7.
