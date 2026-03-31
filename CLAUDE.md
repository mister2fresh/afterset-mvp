# Afterset MVP

Fan-capture SaaS for gigging musicians.

## Project structure

```
web/                      # Vite + React SPA (artist dashboard)
  src/routes/             # TanStack Router file-based routes
  src/components/         # Shared components (captures-table, stat-card, show-drill-down, daily-chart, broadcast-engagement, dashboard-tonight, dashboard-all-shows, email-template-dialog, sequence-step-editor, inline-sequence-editor, keyword-dialog, page-form, pwa-*)
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
- **One email template per capture page** — stored in `email_templates` table. Email sequence editor is inline in the `PageForm` (edit mode), not a separate dialog. A default follow-up email (sequence step 0) is auto-created when a new capture page is created via the API. After page creation, the edit dialog auto-opens so artists see the inline sequence editor. Page cards show a red warning badge if no email template exists. The Emails tab is exclusively for broadcasts.
- **Email templates are plain text** — rendered to HTML at send/preview time via `renderFollowUpHtml()`, no React Email dependency. Emails inherit the capture page's theme (`accent_color`, `bg_color`, `text_color`, `button_style`) via `toEmailTheme()` and include the artist's social/streaming icon grid (from `api/src/lib/icons.ts` shared module). Broadcasts use the artist's most recently updated capture page for theming and links. Auto-detects body text and button text contrast based on background/accent lightness. Email header shows artist name as `<h1>` with capture page title as muted subtitle for show context. Footer includes visible clickable unsubscribe link (in addition to RFC 8058 `List-Unsubscribe` headers). Download page also shows social/streaming icons below the download button.
- **Tabbed dashboard (Tonight / All Shows):** `/dashboard` route uses shadcn `Tabs` with two sub-tabs. "Tonight" (default) calls `GET /analytics/tonight` with 30s auto-refetch, shows live fan count with vs-average comparison, capture methods, and recent sign-up feed. "All Shows" absorbs the former Analytics page: captures-by-show with drill-down, 30-day chart, broadcast engagement. The separate Analytics nav item has been removed; `/analytics` redirects to `/dashboard`.
- **Mobile-first dashboard layout:** Below 768px (`useIsMobile()`), the sidebar is replaced with a fixed bottom tab bar (4 tabs: Overview, Pages, Emails, Fans) + header with avatar dropdown (Help + Settings + Sign out). Desktop sidebar has 6 items (4 main tabs + Help + Settings). Layout uses `fixed inset-0` to prevent nav scrolling.
- **In-app Help tab:** `/help` route with searchable, categorized help topics in accordion UI. Content defined in `web/src/lib/help-topics.ts` (structured data). Supports Loom video embeds (`/share/` → `/embed/` auto-conversion) and self-hosted `<video>` via optional `videoUrl` per topic. 6 categories: Getting Started, Capture Pages, Emails & Sequences, SMS Keywords, Analytics, Account & Settings.
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
- **Email sequences (drip campaigns):** Multiple templates per capture page via `sequence_order` (0–4, max 5 steps). Sequence CRUD at `/api/capture-pages/:id/email-sequence` (GET returns array) and `/api/capture-pages/:id/email-sequence/:order` (PUT/DELETE + preview POST). Step 0 uses `delay_mode` (immediate/1_hour/next_morning), steps 1+ use `delay_days` (sent at 9am artist timezone). Legacy singular endpoints (`/email-template`) still work targeting step 0. `pending_emails.email_template_id` links each queued email to its template; `pending_emails.capture_event_id` links to the specific capture event. `UNIQUE(capture_event_id, email_template_id)` deduplicates per-event (not per-fan), so returning fans get fresh emails on each new capture. Send-batch uses atomic `claim_pending_emails()` Postgres function (FOR UPDATE SKIP LOCKED) to prevent race conditions from overlapping pg_cron runs.
- **SMS keywords:** `sms_keywords` table (separate from `capture_pages`) with `UNIQUE(keyword, phone_number)` for namespace isolation. CRUD at `/api/capture-pages/:id/keyword` (GET/PUT/DELETE) and `/api/capture-pages/:id/keyword/check` (POST, returns availability + suggestions). Batch fetch via `GET /api/capture-pages/keywords`. Keywords stored uppercase, 2–20 chars alphanumeric, reserved words (STOP/HELP/etc.) blocked at API level. Phone number from `TELNYX_PHONE_NUMBER` env var (placeholder until toll-free verification completes).
- **Single-page model:** Artists maintain one (or a few) capture pages and update the title before each show. QR codes, NFC chips, SMS keywords, and the URL slug stay permanent — only the display title changes. `capture_events.page_title` snapshots the title at capture time, preserving per-show context (e.g., "Austin March 28" vs "Nashville April 5") even as the page is reused. This snapshot is the primary mechanism for per-show fan segmentation.
- **URL slug is set explicitly, not derived from title:** In create mode, artists choose their page URL (`afterset.net/c/{slug}`) separately from the show title. Slug is permanent (validated via `GET /capture-pages/check-slug/:slug` availability check); title is transient and updated per gig. This separation is enforced in the `PageForm` component — slug field appears only in create mode.
- **Untagged data is never hidden:** Show-scoped views are additive, never gating. Captures without a `show_id` degrade gracefully into time-based views and always appear as a visible "Untagged" bucket in aggregates. Artists should never wonder where their fans went.
- **Safe page deletion:** `capture_events.capture_page_id` is nullable with `ON DELETE SET NULL`. Deleting a capture page preserves all fan data and capture history. The captures API falls back to the `page_title` snapshot when the page no longer exists. RLS on `capture_events` routes through `fan_captures → artists` (not `capture_pages`) to handle null page references.
- **Captures API:** `GET /api/captures` supports query params: `page_id`, `method`, `date_from`, `date_to`, `search` (email ilike). `GET /api/captures/export` returns CSV with same filters. Both use left joins on `capture_pages` and fall back to `page_title` snapshot for deleted pages.
- **Analytics API:** `GET /api/analytics` queries through `fan_captures!inner` (not `capture_page_id`) to include fans from deleted pages. Returns `total_fans`, `total_pages`, `this_week`, `pages[]` (grouped by `page_title` snapshot, ranked, with `latest_capture`, `methods[]`, `daily[]`, `emails_sent`/`emails_opened`/`open_rate`), `daily[]` (last 30 days). Per-page: `GET /api/capture-pages/:id/analytics` includes `email: { sent, opened, open_rate, steps[] }` with per-step breakdown. `GET /api/analytics/tonight` returns today-scoped data for the artist's most recently updated page: `page_title`, `page_id`, `new_fans`, `methods` (qr/sms/nfc/direct counts), `avg_per_show`, `recent[]` (last 20 captures with fan name/email), `email_status` (entered/sent/opened/open_rate). Uses artist timezone for "today" boundaries.
- **Incentive download page:** Follow-up emails link to `/download/{token}` on the Hono API instead of raw Supabase signed URLs. HMAC-signed token (`DOWNLOAD_HMAC_SECRET`) encodes capture page ID + 7-day expiry. The download page renders with the artist's capture page color scheme (accent, bg, text, button style, background style), shows file type icon + filename, and uses `<a download>` for better mobile behavior. iOS hint shown via UA detection. Expired tokens show a branded expiry page. Route is public (no auth), mounted outside `/api/*`. Token creation in `api/src/lib/download-token.ts`, page HTML in `api/src/lib/download-page.ts`, route in `api/src/routes/download.ts`.
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
