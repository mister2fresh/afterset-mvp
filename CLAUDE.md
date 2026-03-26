# Afterset MVP

Fan-capture SaaS for gigging musicians.

## Project structure

```
web/                      # Vite + React SPA (artist dashboard)
  src/routes/             # TanStack Router file-based routes
  src/components/         # Shared components (captures-table, email-template-dialog, keyword-dialog, page-form, pwa-*)
  src/lib/                # Shared utilities (supabase client, api client, auth)
  public/                 # Static assets (SVG logo, PNG icons for PWA)
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
- **Capture pages must fit in the 14KB TCP initial congestion window** — system fonts (4 stacks: modern/editorial/mono/condensed), inline CSS/JS, no external resources
- **Capture page style options:** `font_style` (modern/editorial/mono/condensed), `title_size` (default/large/xl), `layout_style` (centered/stacked), `text_color`, `bg_color` — plus existing `accent_color`, `secondary_color`, `background_style`, `button_style`. 6 presets (Gold, Neon, Ember, Violet, Minimal, Verdant). Template auto-adapts input/muted colors based on bg lightness via `isLightColor()`. Button text contrast is also auto-detected.
- **Domain is `afterset.net`** (not .com) — email subdomain is `send.afterset.net`
- **One email template per capture page** — stored in `email_templates` table, editable from page card dropdown or dedicated Emails tab
- **Email templates are plain text** — rendered to HTML at send/preview time via `renderFollowUpHtml()`, no React Email dependency
- **Mobile-first dashboard layout:** Below 768px (`useIsMobile()`), the sidebar is replaced with a fixed bottom tab bar (5 tabs) + header with avatar dropdown (Settings + Sign out). Desktop sidebar unchanged. Layout uses `fixed inset-0` to prevent nav scrolling.
- **Dialogs are full-screen on mobile:** Base `DialogContent` fills viewport on `<640px`, centered with max-height on `sm:` and up. Individual dialogs set `sm:max-w-*` for desktop sizing only.
- **PWA installable:** `vite-plugin-pwa` with `generateSW` strategy. Manifest at `/manifest.webmanifest`, service worker precaches app shell + static assets, runtime caching for `/api/` (stale-while-revalidate, 5min). Apple PWA meta tags in `index.html`. Custom install prompt (`pwa-install-prompt.tsx`) uses `beforeinstallprompt` event, dismissible with localStorage persistence. SW update toast via Sonner (`pwa-reload-prompt.tsx`). App icons: SVG "A" lettermark + PNGs (32/180/192/512px) in `web/public/`.
- **Capacitor native wrapper:** `capacitor.config.ts` in `web/`, app ID `net.afterset.app`. Splash screen (midnight bg, 2s auto-hide) and push notifications configured. `usePushNotifications` hook in `_authenticated` layout registers device tokens on native platforms via `POST /api/device-tokens`. `device_tokens` table stores tokens per artist with unique constraint on token. Native projects (`ios/`, `android/`) gitignored — regenerated via `npx cap sync`.

## Tech stack details

- **Frontend:** Vite + React 19, TanStack Router (file-based) + TanStack Query, Tailwind CSS v4, Recharts
- **Backend:** Hono on Node.js, Supabase client (`service_role` for fan writes, RLS for artist dashboard)
- **Auth:** Supabase Auth (magic link + OAuth), client-side via `supabase.auth.getSession()`, route protection via TanStack Router `beforeLoad`. New artists redirected to `/onboarding` until `onboarding_completed` is true (checked in `_authenticated` layout's `beforeLoad` via settings API).
- **Background jobs:** Supabase pg_cron for delayed follow-up emails
- **SMS:** Telnyx (Twilio is fallback), GSM-7 encoding only in auto-replies
- **Email:** Resend via `EmailService` abstraction — suppression checks, RFC 8058 unsubscribe, CAN-SPAM footer, webhook handler for bounces/complaints/opens (open tracking via `email.opened` webhook, stored as `opened_at` on `pending_emails`)
- **Email sequences (drip campaigns):** Multiple templates per capture page via `sequence_order` (0–4, max 5 steps). Sequence CRUD at `/api/capture-pages/:id/email-sequence` (GET returns array) and `/api/capture-pages/:id/email-sequence/:order` (PUT/DELETE + preview POST). Step 0 uses `delay_mode` (immediate/1_hour/next_morning), steps 1+ use `delay_days` (sent at 9am artist timezone). Legacy singular endpoints (`/email-template`) still work targeting step 0. `pending_emails.email_template_id` links each queued email to its template; `UNIQUE(fan_capture_id, email_template_id)` prevents resubmit duplicates.
- **SMS keywords:** `sms_keywords` table (separate from `capture_pages`) with `UNIQUE(keyword, phone_number)` for namespace isolation. CRUD at `/api/capture-pages/:id/keyword` (GET/PUT/DELETE) and `/api/capture-pages/:id/keyword/check` (POST, returns availability + suggestions). Batch fetch via `GET /api/capture-pages/keywords`. Keywords stored uppercase, 2–20 chars alphanumeric, reserved words (STOP/HELP/etc.) blocked at API level. Phone number from `TELNYX_PHONE_NUMBER` env var (placeholder until toll-free verification completes).
- **Single-page model:** Artists maintain one (or a few) capture pages and update the title before each show. QR codes, NFC chips, SMS keywords, and the URL slug stay permanent — only the display title changes. `capture_events.page_title` snapshots the title at capture time, preserving per-show context (e.g., "Austin March 28" vs "Nashville April 5") even as the page is reused. This snapshot is the primary mechanism for per-show fan segmentation.
- **Safe page deletion:** `capture_events.capture_page_id` is nullable with `ON DELETE SET NULL`. Deleting a capture page preserves all fan data and capture history. The captures API falls back to the `page_title` snapshot when the page no longer exists. RLS on `capture_events` routes through `fan_captures → artists` (not `capture_pages`) to handle null page references.
- **Captures API:** `GET /api/captures` supports query params: `page_id`, `method`, `date_from`, `date_to`, `search` (email ilike). `GET /api/captures/export` returns CSV with same filters. Both use left joins on `capture_pages` and fall back to `page_title` snapshot for deleted pages.
- **Analytics API:** `GET /api/analytics` returns `total_fans`, `total_pages`, `this_week`, `pages[]` (ranked, with `emails_sent`/`emails_opened`/`open_rate`), `daily[]` (last 30 days). Per-page: `GET /api/capture-pages/:id/analytics` includes `email: { sent, opened, open_rate, steps[] }` with per-step breakdown.
- **Broadcast campaigns:** One-off emails to full fan list or segments. `broadcasts` table stores draft/scheduled/sending/sent lifecycle, segment filters (page_ids, date range, method), and denormalized stats (recipient_count, sent_count, opened_count). `pending_emails.broadcast_id` links broadcast emails to the delivery queue — reuses existing pg_cron + send-batch infrastructure. CRUD at `/api/broadcasts` (GET list, POST create, GET/PUT/DELETE by id). Send flow: `POST /broadcasts/:id/recipients` (dry-run count), `POST /broadcasts/:id/send` (enqueue). Supports `reply_to` (noreply or artist email), scheduling via `scheduled_at`, and 4 preset templates (New Release, Merch Drop, Upcoming Show, Tour Dates). Limits: 1 broadcast/day per artist, 5000 max recipients. Sent broadcasts can be archived (`POST /broadcasts/:id/archive`) to hide from the list while preserving stats; `archived_at` column, filtered out of GET by default (`?archived=true` to include). UI in Emails tab "Email Fans" section above follow-up sequences.

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

# Capacitor (native mobile — run on Mac with Xcode/Android Studio)
cd web && npx cap sync    # Sync web build to native projects
cd web && npx cap open ios      # Open in Xcode
cd web && npx cap open android  # Open in Android Studio
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

Capture pages use system font stacks — no custom/web fonts. Four stacks: modern (sans-serif), editorial (serif), mono (monospace), condensed (sans-serif + uppercase).

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
