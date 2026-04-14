# Afterset MVP

Fan-capture SaaS for gigging musicians.

## Project structure

```
web/                      # Vite + React SPA (artist dashboard)
  src/routes/             # TanStack Router file-based routes
  src/components/         # Shared components (captures-table, stat-card, show-drill-down, daily-chart, broadcast-engagement, dashboard-tonight, dashboard-all-shows, email-template-badge, sequence-step-editor, inline-sequence-editor, keyword-dialog, nfc-setup-dialog, page-form, theme-editor, broadcast-compose-dialog, pwa-*)
  src/lib/                # Shared utilities (supabase client, api client, auth, types, timezones)
  public/                 # Static assets (SVG logo, PNG icons for PWA)
api/                      # Hono API server (Node.js)
  src/routes/             # Hono route modules (capture-pages, email-templates, captures, email, etc.)
  src/lib/                # Shared utilities (html-utils, timezone, download-page, download-token, icons, build-page, supabase, errors)
  src/lib/email/          # EmailService abstraction, Resend provider, template renderer, suppression
  src/middleware/          # Auth + rate-limit middleware (Bearer token → artist context, in-memory rate limiting)
worker/                   # Cloudflare Worker (serves capture pages from R2)
  src/index.ts            # Worker entry point
supabase/migrations/      # SQL migrations (applied via `supabase db push`)
afterset/docs/adr/        # Architecture Decision Records (001–006)
afterset/docs/research/   # Research that informed ADRs
TASKS.md                  # Sprint tracker and task breakdown
PRICING.md                # Tier structure, cost analysis, enforcement checklist
BACKLOG.md                # Future feature requests and ideas
CRASHCOURSE.md            # Quick-start crash course for new developers
QA-CHECKLIST.md           # Manual QA checklist for page + email flow
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
- **One email template per capture page** — stored in `email_templates` table. Email sequence editor is inline in the `PageForm` (edit mode), not a separate dialog. A default follow-up email (sequence step 0) is auto-created when a new capture page is created via the API. After page creation, the edit dialog auto-opens so artists see the inline sequence editor. Page cards show a red warning badge if no email template exists. The Emails tab is exclusively for broadcasts. **Unified save:** the page form's "Save Changes" button saves both page data and any dirty email step changes. Existing email steps have no separate Save button — changes auto-save on collapse (switching steps, collapsing section, or clicking Save Changes). New email steps use an explicit "Add" button for creation.
- **Email templates are plain text** — rendered to HTML at send/preview time via `renderFollowUpHtml()`, no React Email dependency. Emails inherit the capture page's theme (`accent_color`, `bg_color`, `text_color`, `button_style`) via `toEmailTheme()` and include the artist's social/streaming links as styled text links (`Spotify · Instagram · TikTok`) via `renderTextLinkGrid()` from `api/src/lib/icons.ts` — inline SVGs are stripped by email clients, so emails use text links while the download page uses SVG icon circles via `renderIconGrid()`. Broadcasts use the artist's most recently updated capture page for theming and links. Auto-detects body text and button text contrast based on background/accent lightness. Email header shows artist name as `<h1>` with capture page title as muted subtitle for show context. Footer includes visible clickable unsubscribe link (in addition to RFC 8058 `List-Unsubscribe` headers). Download page also shows social/streaming SVG icons below the download button.
- **Tabbed dashboard (Tonight / All Shows):** `/dashboard` route uses shadcn `Tabs` with two sub-tabs. "Tonight" (default) calls `GET /analytics/tonight` with 30s auto-refetch, shows live fan count with vs-average comparison, capture methods, and recent sign-up feed. "All Shows" absorbs the former Analytics page: captures-by-show with drill-down, 30-day chart, broadcast engagement. The separate Analytics nav item has been removed; `/analytics` redirects to `/dashboard`.
- **Mobile-first dashboard layout:** Single component tree in `_authenticated.tsx` — no JS-driven layout branching. Mobile header + bottom tab bar (4 tabs: Overview, Pages, Emails, Fans) use `md:hidden`; desktop sidebar (6 items) + header use `hidden md:flex`. `SidebarProvider` constrained to `h-svh overflow-hidden` to anchor bottom nav. `beforeLoad` only redirects to login on auth errors (401 / "Not authenticated"), not on transient network failures.
- **In-app Help tab:** `/help` route with searchable, categorized help topics in accordion UI. Content defined in `web/src/lib/help-topics.ts` (structured data). Supports Loom video embeds (`/share/` → `/embed/` auto-conversion) and self-hosted `<video>` via optional `videoUrl` per topic. 6 categories: Getting Started, Capture Pages, Emails & Sequences, SMS Keywords, Analytics, Account & Settings.
- **Dialogs are full-screen on mobile:** Base `DialogContent` fills viewport on `<640px`, centered with max-height on `sm:` and up. Individual dialogs set `sm:max-w-*` for desktop sizing only.
- **PWA installable:** `vite-plugin-pwa` with `generateSW` strategy. Manifest at `/manifest.webmanifest`, service worker precaches app shell + static assets, runtime caching for `/api/` (stale-while-revalidate, 5min). Apple PWA meta tags in `index.html`. Custom install prompt (`pwa-install-prompt.tsx`) uses `beforeinstallprompt` event, dismissible with localStorage persistence. SW update toast via Sonner (`pwa-reload-prompt.tsx`). App icons: SVG "A" lettermark + PNGs (32/180/192/512px) in `web/public/`.
- **Capacitor native wrapper:** `capacitor.config.ts` in `web/`, app ID `net.afterset.app`. Splash screen (midnight bg, 2s auto-hide) and push notifications configured. `usePushNotifications` hook in `_authenticated` layout registers device tokens on native platforms via `POST /api/device-tokens`. `device_tokens` table stores tokens per artist with unique constraint on token. Native projects (`ios/`, `android/`) gitignored — regenerated via `npx cap sync`.

## Pricing tiers (Sprint 5 — in progress)

Three tiers: **Solo** ($12/mo), **Tour** ($25/mo), **Superstar** ($100/mo), plus an **inactive** effective state for expired-trial / no-plan artists. Free trial = 1 month at Tour level. Full cost analysis and enforcement checklist in `PRICING.md`. Implementation tasks in `TASKS.md` Sprint 5. Key gates: capture method (Solo = QR only), fan cap (500/5K/unlimited per month), email cap (1K/10K/50K hidden), sequence depth (1/3/5 steps), broadcasts (0/4mo/unlimited), CSV export (Superstar only), storage (500MB/2GB/10GB). Tier is computed at request time via `getEffectiveTier()` — no cron for trial expiry. Fan captures are never rejected on over-cap but ARE rejected on inactive (only hard-reject case). `"inactive"` is a computed effective tier, not stored in DB (which only holds `solo | tour | superstar`); UI code dealing with buyable plans uses `PurchasableTier = Exclude<Tier, "inactive">`. Stripe integration is a separate workstream.

**Phase 1 foundation shipped (2026-04-13):** `TIER_LIMITS` + `getEffectiveTier()` + `isTrialActive()` live in `api/src/lib/tier.ts`; slim slice duplicated in `worker/src/tier.ts` with `api/tests/tier-parity.test.ts` asserting drift. `artists.tier` + `trial_ends_at` columns grandfather existing artists to `superstar`. `pending_emails.skip_reason` + `skip_reason_at` track why rows are held back (`email_cap` / `tier_locked` / `stale`). `claim_pending_emails()` enforces a 7-day staleness cap. `POST /api/dev/set-tier` endpoint (mounted only when `NODE_ENV !== 'production'`) + `useTier()` hook + `web/src/lib/pricing.ts` (display copy + `TIER_LIMITS` mirror) unblock Phase 3 UI.

**Phase 2 backend gates shipped (2026-04-13):** Worker (`worker/src/index.ts`) enforces capture method (Solo SMS → 403, Solo NFC → soft-accept as `direct`) and marks over-cap fan rows with `cap_exceeded_at` via `maybeMarkOverCap()` — captures never reject. Sequence depth filtering trims queued templates at capture time. `send-batch.ts` runs `markStaleRows()` pre-claim, then `partitionByTier()` classifies rows into sendable / `email_cap` / `tier_locked` buckets; skipped rows release back to `pending` with skip markers for next-batch retry. `email-templates.ts` PUT blocks sequence steps beyond tier depth. `broadcasts.ts` gates creation on Solo; on Tour, `stripAdvancedFilters()` clears `filter_date_from/to` + `filter_method` while preserving `filter_page_ids` (page/show segmentation is the core Tour use case); Superstar keeps all filters. Send path enforces `checkMonthlyBroadcastLimit()` + `checkMonthlyEmailCap()`. `captures.ts` export is Superstar-only. `incentive.ts` upload checks aggregate storage against tier cap (413 on overflow). New `api/src/routes/usage.ts` exposes `GET /api/usage` → month-scoped `{ fans, emails, broadcasts, storage }` with `paused_by_reason` breakdown. Tier limits expose `hasPageSegmentation` (Tour+) and `hasAdvancedSegmentation` (Superstar) as the two segmentation flags. First-crossing over-cap artist notification email dispatch deferred — detection wired, delivery channel TBD.

**Phase 3 frontend gates shipped (2026-04-13):** New primitives `web/src/components/upgrade-prompt.tsx`, `tier-comparison.tsx`, `usage-meters.tsx` + `web/src/hooks/use-usage.ts`. Visible gates: the entire "Capture Methods" `EditorSection` in `page-form.tsx` is hidden on Solo (KeywordSection + NfcSection both inside; cleaner editor since QR is the only Solo capture method, surfaced via the page-card "Download QR" button). Page-card NFC + Text-to-Join buttons also hidden on Solo in `pages.tsx`. Sequence steps beyond `limits.sequenceDepth` render with dashed border + Lock badge; expanding opens `SequenceStepEditor` in read-only mode (subject/body `readOnly`, toggles disabled, Delete/Save hidden, Preview kept) with a lock banner + upgrade target so artists can still view/copy/preview their own drafts after a downgrade. Backend send-batch sequence-depth filtering is authoritative, so a stuck `is_active` on a locked step never fires. At-limit (steps === depth) shows UpgradePrompt. `emails.tsx` swaps the New Broadcast button for an UpgradePrompt on Solo and shows "X / 4 used" for Tour. `broadcast-compose-dialog.tsx` exposes the page-picker filter for Tour+ (`canSegmentByPage`); Tour gets the page-picker only — date/method filters are hidden entirely (no nested Superstar prompt on a screen Tour already paid for); Superstar keeps the full panel. Solo gets a "Tour" badge on the disabled filter button + compact upgrade pitch. Filter toggle label auto-switches between "All fans" and "Filtered recipients" based on whether any filter is active. `BroadcastCard` shows `Edit` + `Preview` as card buttons (drafts) or `Preview` full-width (sent/scheduled); 3-dot menu holds only `Delete` (drafts) or `Archive` (sent). Preview supports an `initialPreview` flag to open the dialog directly into rendered-HTML mode (with a loader + placeholder copy for empty drafts), skipping the editor flash. `fans.tsx` Export CSV button shows Lock + Superstar badge for non-Superstar and toasts on click. Paused-email visibility wired across surfaces: `paused-emails-banner.tsx` above dashboard tabs, Tonight tile gets a Follow-Up Emails card with paused indicator, per-step paused counts in `EmailSequenceSteps`. Settings leads with `plan-card.tsx` (current tier badge, monthly price, trial countdown, embedded usage meters + tier comparison, upgrade contact copy "Reach out to Matthew at hello@afterset.net", dev-only red-bordered tier switcher posting to `/dev/set-tier`). Solo overview's "Captures by Show" rows toggle but drill-down content is replaced with UpgradePrompt — per-page analytics fetch is disabled (`enabled: canDrillDown`). Help topic "Why might my fans not receive emails?" added under Emails & Sequences. **Gating philosophy:** prefer hiding gated UI on shared screens; only render UpgradePrompt when the user actively pursued the gated feature (clicked a row, opened the broadcast composer). Plan card on /settings consolidates the upgrade pitch.

**Phase 4 inactive tier shipped (2026-04-14):** Post-trial Solo artists with an expired `trial_ends_at` now resolve to effective tier `"inactive"` (instead of silently falling through to Solo). All-zero `inactive` row in `TIER_LIMITS` across api/web/worker; `tier-parity.test.ts` asserts drift. Worker (`worker/src/index.ts`) fetches artist tier in parallel with R2 (`Promise.all`) via `lookupPagePausedContext()`; on inactive, `GET /c/:slug` serves a branded ~2KB "signup paused — follow {artist} on {socials}" HTML page (midnight bg, honey-gold social links, status 200, `Cache-Control: no-store`, `X-Frame-Options: DENY`, meta noindex) and `POST /c/:slug` returns 403 `{ inactive: true }` before any tier-limits access. `api/src/middleware/require-active.ts` (`requireActive`) wired per-route on every mutation in `capture-pages`, `email-templates`, `broadcasts`, `sms-keywords`, `incentive`, `build`, `settings` — preview/availability-check routes intentionally ungated so artists can still view. `partitionByTier()` in `send-batch.ts` gained a `no_plan` bucket that releases rows back to `pending` with `skip_reason='no_plan'` (resumes on upgrade). `POST /dev/set-tier` schema accepts `trialDays: -365..365`; negative sets `trial_ends_at` in the past to simulate expiry. Dashboard: `InactiveBanner` (`web/src/components/inactive-banner.tsx`) mounts above `<Outlet />` in `_authenticated.tsx` on every authenticated route (red warning + "Start subscription" link to /settings). `PlanCard` on inactive shows destructive "No active plan" badge, hides price + usage meters, switches CTA container to red with "Start a subscription — hello@afterset.net"; TierComparison still rendered so artists see what to buy. `DevTierSwitcher` adds "Expire trial" button posting `{ tier: "solo", trialDays: -1 }`. Pages list (`pages.tsx`): "New Page" button disabled, per-card status Badge shows destructive "Paused" (overriding Active/Inactive), inline title edit and Delete menu item disabled. Data remains fully viewable — this is a read-only state, not a lockout. **No grace period:** expiry is immediate at `trial_ends_at`. Trial warning emails (7d/3d/1d) explicitly deferred to Stripe lifecycle integration. **Stored vs. computed:** DB `artists.tier` only holds `solo | tour | superstar`; `"inactive"` is always computed by `getEffectiveTier()`.

## Tech stack details

- **Frontend:** Vite + React 19, TanStack Router (file-based) + TanStack Query, Tailwind CSS v4, Recharts
- **Backend:** Hono on Node.js, Supabase client (`service_role` for fan writes, RLS for artist dashboard)
- **Auth:** Supabase Auth (magic link + OAuth), client-side via `supabase.auth.getSession()`, route protection via TanStack Router `beforeLoad`. New artists redirected to `/onboarding` until `onboarding_completed` is true (checked in `_authenticated` layout's `beforeLoad` via settings API).
- **Background jobs:** Supabase pg_cron for delayed follow-up emails
- **SMS:** Telnyx (Twilio is fallback), GSM-7 encoding only in auto-replies
- **Email:** Resend via `EmailService` abstraction — suppression checks, RFC 8058 unsubscribe, CAN-SPAM footer, webhook handler for bounces/complaints/opens (open tracking via `email.opened` webhook, stored as `opened_at` on `pending_emails`)
- **Email sequences (drip campaigns):** Multiple templates per capture page via `sequence_order` (0–4, max 5 steps). Sequence CRUD at `/api/capture-pages/:id/email-sequence` (GET returns array) and `/api/capture-pages/:id/email-sequence/:order` (PUT/DELETE + preview POST). Step 0 uses `delay_mode` (immediate/1_hour/next_morning), steps 1+ use `delay_days` (sent at 9am artist timezone). Legacy singular endpoints (`/email-template`) still work targeting step 0. `pending_emails.email_template_id` links each queued email to its template; `pending_emails.capture_event_id` links to the specific capture event. `UNIQUE(capture_event_id, email_template_id)` deduplicates per-event (not per-fan), so returning fans get fresh emails on each new capture. Send-batch uses atomic `claim_pending_emails()` Postgres function (FOR UPDATE SKIP LOCKED) to prevent race conditions from overlapping pg_cron runs.
- **SMS keywords:** `sms_keywords` table (separate from `capture_pages`) with `UNIQUE(keyword, phone_number)` for namespace isolation. CRUD at `/api/capture-pages/:id/keyword` (GET/PUT/DELETE) and `/api/capture-pages/:id/keyword/check` (POST, returns availability + suggestions). Batch fetch via `GET /api/capture-pages/keywords`. Keywords stored uppercase, 2–20 chars alphanumeric, reserved words (STOP/HELP/etc.) blocked at API level. Phone number from `TELNYX_PHONE_NUMBER` env var (placeholder until toll-free verification completes).
- **NFC tap-to-capture:** Page editor (edit mode) shows the NFC tag URL (`afterset.net/c/{slug}?v=n`) with a copy button. Worker accepts `?v=n` query param and stores `entry_method='nfc'`. Dashboard displays NFC captures with distinct badge/color. Help topic covers NTAG213 tag programming. Page card has an "NFC Tap" button that opens a 3-step setup walkthrough dialog (`NfcSetupDialog`).
- **Three capture method buttons on page card (tier-aware):** Each page card shows the QR image + stacked buttons. Solo: Download QR only. Tour/Superstar: Download QR, Text-to-Join (opens `KeywordDialog`), NFC Tap (opens `NfcSetupDialog`).
- **Single-page model:** Artists maintain one (or a few) capture pages and update the title before each show. QR codes, NFC chips, SMS keywords, and the URL slug stay permanent — only the display title changes. `capture_events.page_title` snapshots the title at capture time, preserving per-show context (e.g., "Austin March 28" vs "Nashville April 5") even as the page is reused. This snapshot is the primary mechanism for per-show fan segmentation.
- **URL slug is set explicitly, not derived from title:** In create mode, artists choose their page URL (`afterset.net/c/{slug}`) separately from the show title. Slug is permanent (validated via `GET /capture-pages/check-slug/:slug` availability check); title is transient and updated per gig. This separation is enforced in the `PageForm` component — slug field appears only in create mode.
- **Untagged data is never hidden:** Show-scoped views are additive, never gating. Captures without a `show_id` degrade gracefully into time-based views and always appear as a visible "Untagged" bucket in aggregates. Artists should never wonder where their fans went.
- **Safe page deletion:** `capture_events.capture_page_id` is nullable with `ON DELETE SET NULL`. Deleting a capture page preserves all fan data and capture history. The captures API falls back to the `page_title` snapshot when the page no longer exists. RLS on `capture_events` routes through `fan_captures → artists` (not `capture_pages`) to handle null page references.
- **Captures API:** `GET /api/captures` supports query params: `page_id`, `method`, `date_from`, `date_to`, `search` (email ilike). `GET /api/captures/export` returns CSV with same filters. Both use left joins on `capture_pages` and fall back to `page_title` snapshot for deleted pages.
- **Analytics API:** `GET /api/analytics` queries through `fan_captures!inner` (not `capture_page_id`) to include fans from deleted pages. Returns `total_fans`, `total_pages`, `this_week`, `pages[]` (grouped by `page_title` snapshot, ranked, with `latest_capture`, `methods[]`, `daily[]`, `emails_sent`/`emails_opened`/`open_rate`), `daily[]` (last 30 days). Per-page: `GET /api/capture-pages/:id/analytics` includes `email: { sent, opened, open_rate, steps[] }` with per-step breakdown. `GET /api/analytics/tonight` returns today-scoped data for the artist's most recently updated page: `page_title`, `page_id`, `new_fans`, `methods` (qr/sms/nfc/direct counts), `avg_per_show`, `recent[]` (last 20 captures with fan name/email), `email_status` (entered/sent/opened/open_rate). Uses artist timezone for "today" boundaries.
- **Incentive download page:** Follow-up emails link to `/download/{token}` on the Hono API instead of raw Supabase signed URLs. HMAC-signed token (`DOWNLOAD_HMAC_SECRET`) encodes capture page ID + 7-day expiry. The download page renders with the artist's capture page color scheme (accent, bg, text, button style, background style), shows file type icon + filename, and uses `<a download>` for better mobile behavior. iOS hint shown via UA detection. Expired tokens show a branded expiry page. Route is public (no auth), mounted outside `/api/*`. Token creation in `api/src/lib/download-token.ts`, page HTML in `api/src/lib/download-page.ts`, route in `api/src/routes/download.ts`. Artists can customize the download page via `download_heading` and `download_description` fields on `capture_pages`. The page form shows a dedicated "Download Page" `EditorSection` (only when an incentive file exists) with a live mini preview using the page's theme, text inputs, and an "Open Full Preview" button (`GET /api/capture-pages/:id/download-preview`). The email preview also shows a "Preview Download Page" button when the email includes an incentive link.
- **Broadcast campaigns:** One-off emails to full fan list or segments. `broadcasts` table stores draft/scheduled/sending/sent lifecycle, segment filters (page_ids, date range, method), and denormalized stats (recipient_count, sent_count, opened_count). `pending_emails.broadcast_id` links broadcast emails to the delivery queue — reuses existing pg_cron + send-batch infrastructure. CRUD at `/api/broadcasts` (GET list, POST create, GET/PUT/DELETE by id). Send flow: `POST /broadcasts/:id/recipients` (dry-run count), `POST /broadcasts/:id/send` (enqueue). Supports `reply_to` (noreply or artist email), scheduling via `scheduled_at`, and 4 preset templates (New Release, Merch Drop, Upcoming Show, Tour Dates). Tier gating: Solo blocked entirely; Tour gets page/show segmentation only (filter by capture page); Superstar gets advanced segmentation (date range + entry method). Server-side `stripAdvancedFilters()` enforces this on POST/PUT/send so direct API calls can't bypass the UI gate. Other limits: monthly broadcast cap per tier (0 / 4 / unlimited), enforced on both `POST /broadcasts` (creation) and `POST /broadcasts/:id/send` so artists don't build a broadcast they can't send — the Emails page swaps the New Broadcast button for a disabled "Limit reached" state when `usage.broadcasts.used >= usage.broadcasts.limit`. 5000 max recipients per send. Sent broadcasts can be archived (`POST /broadcasts/:id/archive`) to hide from the list while preserving stats; `archived_at` column, filtered out of GET by default (`?archived=true` to include). UI in Emails tab "Email Fans" section above follow-up sequences.
- **Email From/Reply-To behavior:** FROM address is dynamic via `buildFrom()` in `resend-service.ts` — `hello@send.afterset.net` when a reply-to is present, `noreply@send.afterset.net` otherwise. Broadcast compose dialog's "My email" button sets `replyTo` to the logged-in artist's email (`getUser()?.email`), which persists on the `broadcasts` row and is forwarded to Resend at send time. Follow-up sequence emails do not set a reply-to, so their FROM stays `noreply@`. **Resend SDK gotcha:** the Node SDK uses camelCase `replyTo` (not snake_case `reply_to`); passing `reply_to` silently drops the header. Neither `hello@` nor `noreply@` has an inbound MX, so if a fan's mail client ignores Reply-To and replies to FROM directly, it bounces — Cloudflare Email Routing on `send.afterset.net` is a pending backlog item.

## Commands

```bash
# Development
pnpm dev:web              # Vite SPA at localhost:5173
pnpm dev:api              # Hono API at localhost:3000 (tsx watch)

# Build
pnpm build:web            # tsc + vite build → web/dist/
pnpm build:api            # tsc --noEmit (typecheck gate; production runs via tsx)

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
