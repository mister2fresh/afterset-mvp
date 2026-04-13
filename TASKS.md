# AFTERSET — Tasks & Sprint Tracker
## Interim project management until MCP task server is online

**Last updated:** April 13, 2026 (v82 — Sprint 5 Phase 3 QA cont: Solo capture-methods hidden + broadcast segmentation split Tour/Superstar)
**Current phase:** Sprint 5 — Pricing Tier Enforcement
**Sprint:** Sprint 5 Phase 3 (frontend gates) complete on `sprint-5-pricing-tiers` branch. New primitives: `UpgradePrompt`, `TierComparison`, `UsageMeters`, `PausedEmailsBanner`, `PlanCard` + `useUsage` hook. Gates: Capture Methods section in page-form hidden entirely on Solo (cleaner editor; QR-only is exposed via page-card "Download QR"), sequence steps beyond tier depth render locked, broadcasts gated (Solo) + page segmentation on Tour+ + advanced segmentation (date/method) Superstar-only, CSV export Superstar-only. Paused-email visibility wired across dashboard banner, Tonight tile, and per-page show drill-down. Upgrade contact copy: "Reach out to Matthew at hello@afterset.net". Typecheck/tests/lint green (55/55 passing).
**Next up:** Continue Sprint 5 Phase 3 QA (Tour flows, trial countdown, paused-email seeded data, Superstar segmentation/CSV, sequence editor downgrade lock states). Then Phase 4 (trial banner). First-crossing over-cap artist notification email dispatch still deferred (detection wired via `cap_exceeded_at`, delivery path TBD).

---

## Security Hardening (Audit: April 4, 2026) — All complete, deployed April 11

All 13 findings (4 HIGH, 6 MEDIUM, 3 LOW) fixed and deployed to production. Deployment checklist executed: KV namespace created, Worker secrets set, Supabase Vault configured, migrations applied, Worker deployed. Verified: captures working, rate limiting active, pg_cron using Vault secrets.

---

## Bugs — Found During QA (March 26, 2026)

- [x] **Email heading now shows artist name + page title subtitle** — was working correctly (artist name was "hello"); added page title as muted subtitle below artist name for show context (fixed March 26)
- [x] **No visible unsubscribe link in email body** — added clickable "Unsubscribe" link in email footer alongside existing RFC 8058 List-Unsubscribe headers; CAN-SPAM compliant (fixed March 26)
- [ ] **Redesign analytics captures + open rate data layout** — current layout of captures by show and email open rate data is confusing; improve hierarchy, grouping, and visual clarity of engagement metrics
- [x] **Overview vs Analytics tab overlap** — combined into a single "Tonight / All Shows" tabbed dashboard. Analytics nav removed, `/analytics` redirects to `/dashboard`, help docs updated (completed March 26)
- [x] **Confirmation dialogs on all delete actions** — AlertDialog-based confirmation before all 6 destructive actions: delete capture page, delete broadcast (card + compose dialog), delete email sequence step, remove incentive file, remove SMS keyword (fixed March 26)
- [x] **Capture page social icons layout** — merged streaming + social into single flex-wrap grid; preview updated to show both (fixed March 27)
- [x] **Follow-up email doesn't fill screen on iPhone** — added height:100% on html, min-height:100% on body, min-height:100vh on content wrapper to eliminate white gap on mobile (fixed March 27)
- [x] **Auto-include incentive file in first sequence email** — API auto-enables `include_incentive_link` on upload when exactly 1 email exists; multi-step pages left to artist choice. Email dialog auto-expands first step after page creation for discoverability (fixed March 27)
- [ ] **QA: Capture page + email creation flow** — verify the current flow works well: page creation auto-creates welcome email, email dialog auto-opens after page creation, default email is active out of the box. Test: (1) create new page → email dialog opens automatically, (2) default welcome email is pre-populated and active, (3) artist can customize or dismiss without breaking anything, (4) editing existing page doesn't re-trigger email dialog. Determine if the two-step flow is smooth enough or needs further consolidation.
- [x] **Duplicate emails on capture (9 emails sent)** — race condition in send-batch: non-atomic fetch+claim allowed overlapping pg_cron runs to double-send; also skipped emails looped back to pending forever (fixed March 26)
- [x] **Incentive file not included in emails** — send-batch queried nonexistent `incentive_uploads` table instead of `capture_pages.incentive_file_path` (fixed March 26)
- [x] **Social/streaming icons invisible in sent emails** — inline SVGs stripped by Gmail/Outlook/Yahoo; replaced with styled text links (e.g. "Spotify · Instagram · TikTok") using artist accent color. Download page keeps SVG icons (works in browsers). Preview iframe height bumped 300→500px (fixed April 1)
- [ ] **Broadcast "Preview" dropdown opens edit instead of preview** — the preview option in the broadcast card's `...` dropdown menu navigates to the edit view rather than showing an email preview

---

## Status Key

- `[ ]` — Todo
- `[~]` — In progress
- `[x]` — Done
- `[!]` — Blocked (note blocker in comments)
- `[—]` — Deferred / cut from scope

---

## Decided Architecture (from ADRs)

Reference summary of the five foundational decisions. Full rationale in the ADR docs.

| Component | Decision | Cost | ADR |
|---|---|---|---|
| Database + Auth + Jobs | Supabase Free for dev → Pro at launch. Postgres, Auth (magic link + OAuth), Realtime Broadcast. pg_cron/pg_net Pro-only (Sprint 2+). | $0 dev / $25 prod | ADR-001 |
| Email sending | Resend Pro — shared domain `send.afterset.net` at launch, custom domains at ~200 artists. `EmailService` abstraction wraps all sends. | $20/mo | ADR-002 |
| Capture pages (fan-facing) | Pre-built static HTML on Cloudflare R2 + CDN. ~5KB per page. Form POST to Cloudflare Worker (same origin). | $0/mo | ADR-003 |
| Dashboard + API | Vite + React SPA on Cloudflare Pages (free) + Hono API on Railway Hobby. Single repo (`web/` + `api/`). | $5/mo | ADR-004 |
| SMS text-to-join | Telnyx toll-free number, shared-number keyword routing. Webhook handler on Hono API. `SmsService` abstraction. Twilio is fallback. | ~$2–15/mo | ADR-005 |

**Total monthly cost at launch: ~$50** (Supabase $25 + Resend $20 + Railway $5 + Telnyx ~$2)

**Correction from ADR review:** ADR-002 references `send.afterset.com` — this must be `send.afterset.net` (we only own `afterset.net`). Update DNS records and ADR-002 accordingly.

### Two fan-facing surfaces (important for deployment)

The fan-facing path has two separate codebases deployed to separate platforms:

1. **Capture page HTML** — generated by the Railway API's build pipeline, uploaded to Cloudflare R2, served via Cloudflare CDN.
2. **Capture form submission** — handled by a Cloudflare Worker on the same origin (`afterset.net/api/capture`), writes directly to Supabase via `service_role` key.

These are not a single `git push`. A template bug requires a Railway deploy + R2 rebuild. A submission bug requires a Worker deploy. Keep this in mind for testing and deployment checklists.

---

## Business Setup (Parallel Track)

These tasks have processing time (bank approvals, trademark examination, toll-free verification). Start immediately so they don't gate later sprints. Full rationale in ADR-006.

### Phase A — Do Now (Parallel with Pre-Build)

Start immediately so processing windows don't gate later sprints.

**Estimated cost: ~$800–$830 one-time**

- [ ] **Form Colorado LLC** ($50)
  - File Articles of Organization online at sos.colorado.gov
  - Processing is instant — save state-assigned ID number
  - Draft and sign operating agreement (free template, 30 min)
  - Store operating agreement digitally and physically
- [ ] **Obtain EIN** ($0)
  - Apply at irs.gov/ein immediately after LLC confirmation
  - Must complete in one session (15-minute inactivity timeout)
  - Save/print CP-575 confirmation letter
- [ ] **Open Mercury business bank account** ($0)
  - Requires: Articles of Organization + EIN + government-issued photo ID
  - Apply online — 1–2 day approval
  - Order Mercury business debit card
  - Set up as sole payment method for all business expenses
- [ ] **Set up Stripe as business account**
  - Can register immediately as Individual/Sole Proprietor using SSN
  - Upgrade to LLC + EIN after Mercury is open
  - Connect Stripe payouts to Mercury checking
  - Test a $1 charge and verify payout arrives
- [ ] **File federal trademark — Intent-to-Use** ($700 — Classes 42 + 41)
  - Search USPTO TESS database for conflicting marks
  - File via USPTO Trademark Center (unified filing, $350/class)
  - Use pre-approved ID Manual descriptions to avoid surcharges
  - Class 42: SaaS platform services. Class 41: entertainment/fan engagement services
  - Calendar: expect first Office Action in 3–6 months
  - Calendar: Statement of Use deadline after Notice of Allowance (6-month window, extendable)
- [ ] **File Colorado state trademark** ($30)
  - File electronically via Colorado SOS
  - Supplementary layer — not a substitute for federal
- [ ] **Claim social media handles** ($0)
  - Use Namechk.com to check @afterset availability across all platforms
  - Priority 1 (today): Instagram, TikTok, X, YouTube, LinkedIn company page, Facebook page
  - Priority 2 (this week): Threads, Discord, Bluesky, Reddit
  - Add profile photo, short bio, and afterset.net link to prevent purge
- [ ] **Register defensive domains** ($20–$50)
  - Register afterset.io and afterset.co
  - Point to afterset.net or park with registrar
- [ ] **Begin using ™ symbol** ($0)
  - Add ™ to "Afterset" on landing page, all marketing materials, email signatures
  - Common-law trademark rights begin with use in commerce

### Phase B — Before First Paying Customer ⛔ Gates: Sprint 3 billing + beta invites

Must be complete before accepting payment or collecting fan data. These are launch blockers per ADR-006.

**Estimated cost: ~$540–$770 one-time + ~$47.50/month recurring**

- [ ] **Set up Termly Pro+ and publish Terms of Service** ($20/month) ⛔
  - Generate ToS with SaaS-specific clauses via Termly
  - Must include: clickwrap acceptance (checkbox + "I agree"), acceptable use policy (no spam, no purchased lists, consent required), indemnification clause, limitation of liability (12 months fees paid), account termination + 30-day data export window, payment terms (auto-renewal, cancellation, refunds), dispute resolution (Colorado law)
  - Implement clickwrap on artist signup flow — browsewrap is NOT sufficient
- [ ] **Publish Privacy Policy** (included in Termly Pro+) ⛔
  - Categories of PI collected (emails, names, phone numbers, device info)
  - Collection methods (QR, SMS, NFC, web forms)
  - Third-party processors listed (Supabase, Resend, Telnyx, Stripe)
  - Data retention periods
  - User rights (access, deletion, correction, opt-out)
  - SMS-specific disclosures
  - COPPA statement (not directed to children under 13)
  - Link from: all capture pages, SMS confirmations, email footers, website footer
- [ ] **Get PO Box** (~$5/month) ⛔
  - Required for CAN-SPAM physical address in every email
  - Cheapest USPS option is sufficient
  - Avoids exposing home address in email footers
- [ ] **Build CAN-SPAM compliant email infrastructure** (ADR-002, ADR-006) ⛔
  - Mandatory non-removable email footer in every template: unsubscribe link + physical address + "Sent by [Artist] via Afterset"
  - Unsubscribe mechanism: one-click, no login required, functional for 30 days post-send
  - Process opt-outs immediately (legal requirement: 10 business days; target: instant)
  - Resend handles List-Unsubscribe headers and suppression (ADR-002)
  - Accurate From/Reply-To headers, non-deceptive subject lines
  - Treat ALL emails as commercial (include full CAN-SPAM elements in every email)
- [ ] **Set up Wave bookkeeping** ($0)
  - Create Wave Starter account
  - Manually enter all pre-launch expenses (LLC filing, domain, hosting, legal)
  - Categorize: hosting, domains, SaaS tools, legal, filing fees
  - Begin tracking every dollar in and out from this moment
- [ ] **Bind Hiscox E&O insurance** (~$270/year, ~$22.50/month) ⛔
  - Apply at hiscox.com — professional liability / E&O for technology companies
  - Covers service failure claims, software bugs, missed SLAs
  - Bind BEFORE first paying customer — claims-made policies have no retroactive coverage
  - Ask about TCPA coverage/exclusions during application
  - Save Certificate of Insurance for future B2B contract requests
- [ ] **Register for free DUNS number** ($0)
  - Register at dnb.com to establish business credit file
  - Takes 10 minutes, useful when applying for business credit card later
- [ ] **Accept vendor DPAs** ($0)
  - Sign/accept existing DPAs from Supabase, Stripe, Telnyx, and Resend
  - Same-day task — just click through each vendor's legal page
- [ ] **Schedule targeted attorney consultation** ($300–$500)
  - Book 1–2 hours with a SaaS attorney via ContractsCounsel or UpCounsel
  - Bring Termly-generated ToS and Privacy Policy
  - Ask specifically: (1) "Does my ToS properly allocate TCPA vicarious liability given the RILA exemption applies to my single-reply SMS flow?" (2) "Is my data processor language sufficient for the Colorado Privacy Act?"
  - Can be scheduled for within 30 days of launch — not a day-one blocker

### Phase C — Before SMS Launch ⛔ Gates: Sprint 3 text-to-join

These tasks gate the text-to-join feature (ADR-005, ADR-006). Telnyx handles much of the TCPA compliance burden at the carrier level, but platform-level verification is still required.

**Estimated cost: $0 (toll-free verification and Telnyx auto opt-out are included in ADR-005's Telnyx costs)**

- [ ] **Verify Telnyx toll-free verification is approved** ($0 — already submitted in Sprint 2 per ADR-005) ⛔
  - Toll-free verification replaces 10DLC — no separate registration needed
  - 3–15 business day approval window runs in parallel with Sprint 2 dev work
  - Without verification, carrier traffic may be filtered or blocked
- [ ] **Verify RILA exemption compliance in SMS auto-reply** ⛔
  - Auto-reply must contain ONLY: capture page URL + compliance language
  - Zero promotional content — no merch links, no "follow us on Instagram," no upsells
  - This is the critical constraint that maintains the RILA exemption (FCC 15-72)
  - Confirm reply fits single 160-char GSM-7 segment (per ADR-005)
- [ ] **Build TCPA-compliant call-to-action templates for artists** ⛔
  - Template must include ALL of: artist name, consent to receive automated text, "Consent not required for purchase", message frequency, "Msg & data rates may apply", STOP instructions, Terms and Privacy links
  - Provide as downloadable/copyable assets for posters, slides, social posts
  - Required disclosures are non-negotiable — artists cannot modify them
- [ ] **Verify Telnyx auto opt-out handling** (built-in per ADR-005) ⛔
  - Confirm Telnyx handles STOP/HELP/END/CANCEL/QUIT/UNSUBSCRIBE at carrier level
  - Confirm opt-out triggers immediate suppression (no further messages sent)
  - Confirm HELP response includes brand name and support contact
  - This is provider-delegated — Telnyx does the heavy lifting, platform verifies it works
- [ ] **Build consent logging system** ⛔
  - Log every inbound text: exact timestamp, phone number, keyword, artist ID
  - Log every opt-out: timestamp, method (SMS keyword, email, web form)
  - Retain records for minimum 5 years (TCPA statute of limitations is 4 years)
  - Consent is artist-specific — opt-in for Artist A cannot be used for Artist B
- [ ] **Implement 8 AM–9 PM sending restriction** ⛔
  - Based on recipient's local time zone (not sender's)
  - Queue messages outside window for delivery at 8 AM recipient time
  - Applies to the initial auto-reply if fan texts outside hours
  - This is a TCPA legal requirement, not a best practice
- [ ] **Test full SMS compliance flow end-to-end** ⛔
  - Call-to-action displays all required disclosures → fan texts keyword → auto-reply with URL + compliance language only → STOP immediately opts out → HELP returns support info → consent logged with timestamp
  - Test with real phone numbers on the verified toll-free number
  - Document test results — this is your compliance evidence

### Phase D — Within 90 Days of Launch

Important but not launch-blocking. Per ADR-006, complete before month 3.

**Estimated cost: ~$220–$610 one-time + $55–$175/year monitoring**

- [ ] **Register for Colorado sales tax license** ($16, biennial)
  - File via Colorado Revenue Online
  - SaaS is exempt at state level but taxable in home-rule cities (Denver, etc.)
  - Required if any Colorado customers in home-rule jurisdictions
- [ ] **Publish Data Processing Agreement** ($0 — template)
  - Download free DPA template (Iubenda, GDPR.eu) and customize
  - Separate page on website, incorporated by reference in ToS
  - List all sub-processors publicly (Supabase, Resend, Telnyx, Stripe)
  - Document data breach notification process (48–72 hours to affected artists)
  - Full custom DPA included when engaging attorney at $5K MRR
- [ ] **Set up trademark monitoring** ($55–$175/year)
  - TMReady ($55/year) for basic USPTO database monitoring
  - Set Google Alerts for "Afterset" brand mentions
- [ ] **Initiate afterset.com domain acquisition** ($0–$120 broker fee to start)
  - WHOIS lookup to identify current owner
  - Start with polite direct outreach at $1,500–$2,000 offer
  - Budget $2,000–$10,000 when revenue justifies it (target: $5K MRR)
- [ ] **Document data retention and deletion policy** ($0)
  - Retention periods by data type (fan data, consent records, billing records)
  - Deletion process on artist account termination (30-day export window, then purge)
  - Backup purge timeline (90 days post-deletion)
- [ ] **First CPA consultation for tax planning** ($150–$300)
  - Schedule when first revenue arrives
  - Topics: quarterly estimated taxes, QBI deduction, Section 174 R&D amortization, startup cost classification, home office deduction method

**Revenue-triggered items (not calendar-triggered):**

- [ ] **Add cyber liability insurance** (at 50+ artists, ~$30/month)
  - Hiscox cyber add-on covers breach notification, forensics, legal defense
  - Total insurance at this point: ~$630/year (E&O + Cyber)
- [ ] **Bind General Liability insurance** (at first B2B contract requiring COI, $300–$600/year)
  - Required before most venue, promoter, or enterprise artist contracts
  - Hiscox from ~$30/month, Hartford from ~$17/month
- [ ] **Engage SaaS attorney for full legal package** (at $5K MRR, $2,500–$5,000)
  - Custom ToS with TCPA/CAN-SPAM-specific provisions
  - Custom DPA covering full sub-processor chain and breach notification
  - Strengthened AUP and indemnification clauses
  - At this revenue, the cost is justified and actual usage patterns inform better scoping

---

## Phase 0: Pre-Build Research & Setup (Days 1–5)

### Day 1 — Competitive Research: Capture Tools

- [ ] Sign up for SET.Live free account
  - [ ] Document full artist setup flow (screenshots/notes)
  - [ ] Run through fan-side QR capture flow — time it end to end
  - [ ] Note how they handle QR generation and display
  - [ ] Assess how burst traffic might be handled (architecture clues)
- [ ] Sign up for Laylo free account
  - [ ] Document CRM structure — what data per fan?
  - [ ] Document messaging system (templates, scheduling)
  - [ ] Document analytics dashboard layout and metrics
  - [ ] Walk through artist onboarding flow
- [ ] Sign up for Feature.fm free tier
  - [ ] Test public page load speed (throttled 3G via DevTools)
  - [ ] Document analytics dashboard
  - [ ] Document pre-save flow (closest analog to capture flow)

### Day 2 — Competitive Research: Nurture & Email Tools

- [ ] Sign up for Beacons free account
  - [ ] Document email collection UX on public pages
  - [ ] Document page editor UX (reference for capture page editor)
  - [ ] Test public page load speed (throttled 3G)
- [ ] Sign up for Kit (ConvertKit) free tier
  - [ ] Document simple automation sequence builder
  - [ ] Document template editor UX
  - [ ] Document subscriber management and segmentation

### Day 3 — Architecture Decisions

All five deep research ADRs are complete and accepted. Minor decisions (auth, real-time, AI) were resolved within the deep ADRs and don't need separate write-ups.

#### Deep Research — COMPLETE

- [x] **ADR-001: Database** — Supabase Pro + Micro ($25/mo)
  - PostgREST HTTP bypasses connection pooling for fan captures
  - Queue-buffered write architecture planned at ~200 artists
  - `service_role` key for fan capture INSERTs (bypass RLS + Auth)
  - Custom SMTP for Supabase Auth required day 1 (default: 2 emails/hr)

- [x] **ADR-002: Email Sending** — Resend Pro ($20/mo)
  - Shared `send.afterset.net` domain at launch (~~`send.afterset.com`~~ — corrected, we don't own .com)
  - `EmailService` abstraction wraps all sends for future SES migration
  - List-Unsubscribe + RFC 8058 endpoint required before first fan email
  - Real-time email validation on capture form before first send

- [x] **ADR-003: Capture Page Performance** — Static HTML on Cloudflare R2
  - ~5KB uncompressed, ~3KB Brotli, fits in 14KB TCP initial congestion window
  - System font stack, inline CSS/JS, no external resources
  - Dark theme, 7:1+ contrast, 48×48px touch targets
  - localStorage-first form submission for offline resilience
  - Cloudflare Worker handles form POST on same origin

- [x] **ADR-004: Deployment & Background Jobs** — Split architecture
  - Vite + React SPA → Cloudflare Pages (free)
  - Hono API → Railway Hobby ($5/mo)
  - pg_cron + pg_net for delayed email scheduling (included in Supabase Pro)
  - Single repo: `web/` + `api/`, no monorepo tooling at launch
  - NOT Next.js — SSR provides zero benefit for auth-gated dashboard

- [x] **ADR-005: SMS Text-to-Join** — Telnyx toll-free
  - Single shared US toll-free number with keyword routing
  - 30–45% cheaper than Twilio at every volume tier
  - `SmsService` abstraction, Twilio as designated fallback
  - GSM-7 only (no emoji), STOP/HELP handled by Telnyx auto opt-in/opt-out

#### Minor Decisions — Resolved within ADRs

- [x] **Authentication** — Supabase Auth: magic links + Google OAuth for artists. No fan-side auth. (ADR-001, ADR-004)
- [x] **Real-time vs. Eventually Consistent** — Optimistic confirmation on capture (localStorage-first, "You're in!" immediately). Dashboard uses Supabase Realtime Broadcast for live fan counts. (ADR-001, ADR-003)
- [x] **QR Code generation** — Server-side, cached per page. Downloadable as high-res PNG (300+ DPI). (ADR-003)
- [x] **NFC** — NFC URL shown in page editor with copy button; help topic added
- [x] **AI Processing** — Server-side API route on Hono, rate limited by tier. Minimal in v1 ("suggest email copy" button at most). (Handoff §6.4)
- [x] **Monitoring** — Sentry (free) on both SPA and API. Railway Log Explorer. Supabase `cron.job_run_details`. Free uptime monitor on health endpoint. (ADR-004)

### Day 4 — Project Setup

Full stack: Vite + React + Hono + Cloudflare Pages + Railway (per ADR-004).

- [x] Create new project repo on GitHub (single repo)
- [x] **Set up `web/` — Vite + React SPA** *(completed 2026-03-22)*
  - Vite + React 19 + TypeScript via `pnpm create vite`
  - TanStack Router (file-based routing) + TanStack Query
  - Tailwind CSS v4 (CSS-based `@theme` config, NOT tailwind.config.ts)
  - Recharts installed (shadcn/ui deferred to Sprint 1 dashboard shell)
  - Supabase client wired to env vars (`web/src/lib/supabase.ts`)
- [x] **Set up `api/` — Hono API server** *(completed 2026-03-22)*
  - Hono with Node.js adapter + CORS + request logger
  - Zod, Supabase JS client, Resend SDK installed
  - Health check endpoint at `/api/health` — verified working
  - `tsx watch` for hot-reload dev server
- [x] **Set up monorepo tooling** *(completed 2026-03-22)*
  - pnpm workspace (`web/` + `api/`)
  - Root scripts: `dev:web`, `dev:api`, `build:web`, `build:api`, `lint`, `typecheck`
  - Biome shared config: tabs, double quotes, semicolons, import sorting, `noExplicitAny`
  - TypeScript strict mode in both projects — both pass `tsc --noEmit` clean
  - Vite dev proxy: `/api/*` → localhost:3000
- [x] **Set up environment variables structure** *(completed 2026-03-22)*
  - `web/.env.example`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`
  - `api/.env.example`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `TELNYX_API_KEY`, `SENTRY_DSN`, `PORT`
  - Cloudflare Worker env vars deferred to Cloudflare setup below
- [x] Import design tokens from landing page *(completed 2026-03-22)*
  - Midnight (#0a0e1a), midnight-light (#111827)
  - Honey-gold (#E8C547), electric blue (#3b82f6)
  - Bricolage Grotesque / DM Sans / Space Mono fonts (dashboard only — capture pages use system font stack)
  - Defined as Tailwind v4 `@theme` vars in `web/src/index.css`
- [x] Create `CLAUDE.md` for the app repo *(completed 2026-03-22)*
  - Project structure, commands, design tokens, formatting conventions, MCP rules
- [x] **Configure Supabase project** *(completed 2026-03-23)*
  - [x] Create Supabase project and configure `.env` files with URL + anon key + service role key
  - [x] Upgrade to Supabase **Pro** *(completed 2026-03-23)*
  - [x] Configure custom SMTP with Resend credentials *(completed 2026-03-23 — magic link sends from noreply@send.afterset.net)*
  - [x] Set up `send.afterset.net` domain in Resend: SPF, DKIM, DMARC records *(completed)*
  - [x] Register Google Postmaster Tools for `send.afterset.net` *(completed 2026-03-23)*
- [~] **Configure Cloudflare** *In progress*
  - [x] Add `afterset.net` to Cloudflare (Free plan), import iCloud email DNS records (MX, SPF, DKIM, apple-domain)
  - [x] Set up R2 bucket `afterset-capture-pages` — 4 test pages already uploaded
  - [x] R2 API credentials created and in `.env`
  - [x] Nameserver propagation complete, Cloudflare active on `afterset.net` *(completed 2026-03-23)*
  - [x] Cloudflare Worker serving capture pages from R2 (`GET /c/[slug]`) — deployed and verified live *(completed 2026-03-23)*
  - [ ] Cloudflare Worker for capture form submission (`POST /api/capture`) — Sprint 1 P0 task
  - [ ] Set up Cloudflare Pages project connected to `web/` folder
  - [ ] Verify DNS for `afterset.net` — capture pages at `/c/[slug]`, Worker at `/api/capture`
- [x] **Configure Railway** *(completed 2026-03-26)*
  - Railway Hobby plan, `api/` root directory, public domain: `api-production-496d.up.railway.app`
  - Build: `npm install -g pnpm && pnpm install && pnpm run build` / Start: `npx tsx src/index.ts`
  - Environment variables set (missing: Telnyx/phone secrets — to be added later)
  - pg_cron jobs updated with real Railway URL + BATCH_SEND_SECRET
  - End-to-end email sequence flow verified: fan capture → pending_emails → pg_cron → send-batch → Resend → email delivered
- [ ] Configure Sentry on both SPA and API — verify error capture from each
- [x] Install and configure shadcn/ui *(completed 2026-03-22 — Radix Nova preset, Tailwind v4, brand-themed dark mode)*
- [ ] Create `docs/CONVENTIONS.md`:
  - TypeScript strict mode, no `any`
  - All components: explicit prop types
  - API routes: Zod input validation
  - Capture pages: <14KB compressed, <2s on 3G, Lighthouse mobile >90
  - Focus-visible styles on all interactive elements
  - Design token adherence (dashboard uses brand fonts, capture pages use system stack)
  - Auth abstraction: `getCurrentUser()` and `requireAuth()` never reference Supabase directly

### Day 5 — Validation Tests & Sprint Planning

Run ADR validation tasks before committing to the stack.

- [ ] **Load test PostgREST** (ADR-001 validation — BLOCKING)
  - Create Supabase Pro staging project
  - Simulate 500 concurrent HTTP INSERTs via the exact path: Cloudflare Worker → PostgREST
  - Pass criteria: <500ms p99, 0% error rate at 500 concurrent
  - If throttle found: add queue immediately. If throttle <100 req/sec: evaluate Neon.
- [ ] **Test Supabase Auth SMTP** (ADR-001 + ADR-002 validation)
  - Send test magic link via Resend SMTP
  - Verify delivery in <30 seconds
- [ ] **Test Resend batch API** (ADR-002 validation)
  - Send 200 emails via batch endpoint
  - Pass criteria: all delivered, <2s total API time, no 429s
- [ ] **Test pg_cron + pg_net** (ADR-004 validation)
  - Create test cron job that POSTs to Railway API every 60 seconds
  - Verify `cron.job_run_details` records success/failure
  - Test: what happens when Railway is down? Verify pg_net records the failure.
- [ ] **Test full delayed email flow end-to-end** (ADR-004 validation)
  - Insert pending email with `send_at = NOW() + INTERVAL '2 minutes'`
  - Wait. Verify pg_cron → Railway → Resend → email arrives.
- [ ] **Build and test capture page prototype** (ADR-003 validation)
  - Implement HTML template from ADR-003 spec
  - Measure: uncompressed <6KB, Brotli compressed <4KB
  - Upload to R2, test full CDN path
  - Run WebPageTest: Moto G Power, Chrome, slow 3G — target <2,000ms total load
- [ ] **Test dark-theme legibility** (ADR-003 validation)
  - Screenshot capture page at 10% screen brightness on phone
  - Verify all text, email input, and submit button clearly visible
- [ ] Create `docs/DATA-MODEL.md` with initial schema and types
- [ ] Finalize Sprint 1 task breakdown with acceptance criteria
- [ ] Push to GitHub

---

## Sprint 1: Core Capture Flow (Weeks 1–2)

**Goal:** An artist can create a capture page, generate a QR code, and a fan can scan it and submit their email.

**Stack context:** Dashboard is Vite + React SPA on Cloudflare Pages. API is Hono on Railway. Capture pages are static HTML on Cloudflare R2. Form submission via Cloudflare Worker → Supabase.

**Status:** Complete — all P0 and P1 tasks shipped. Capture pages live on afterset.net, fan submissions flowing to Supabase, dashboard shows captures with per-page filtering, Worker rate limited.

**Business parallel:** Start 10DLC brand registration during Sprint 1 (Business Phase C). The 10–15 business day approval window is the critical path for Sprint 3 SMS launch. Also ensure Business Phase A (LLC, EIN, bank) is complete — 10DLC requires legal business name matching IRS records.

### P0 — Must ship

- [x] **Database schema + migrations** ✓ deployed 2026-03-22
  - Tables: `artists`, `capture_pages`, `fan_captures`, `capture_events`, `pending_emails`, `email_suppression_list`
  - `capture_events` table logs full interaction history (entry method per visit); `fan_captures` is deduplicated roster
  - Row-level security policies per artist (dashboard queries only — fan capture path uses `service_role`)
  - Upsert constraint on `(artist_id, email)` in `fan_captures` for dedup across entry methods
  - Partial index on `pending_emails(status, send_at) where status = 'pending'` for job polling
  - SMS tables (`sms_keywords`, `sms_consent_log`, `sms_opt_outs`) deferred to Sprint 3
  - Remaining: Types generated via Supabase CLI and exported, RLS tested with seed rows
  - *Acceptance:* Schema deployed, RLS tested with 100K seed rows (<100ms query with indexing), types available in app.

- [x] **Auth setup (Supabase Auth)** ✓ completed 2026-03-22
  - Magic link for artist signup/login (Google OAuth deferred — no GCP project yet)
  - Session management via `supabase.auth.getSession()` + `onAuthStateChange()`
  - Route protection via TanStack Router `beforeLoad` guard (`_authenticated` layout route)
  - Auth abstraction layer: `getUser()`, `signInWithMagicLink()`, `signOut()` in `web/src/lib/auth.ts` — no Supabase references outside lib/
  - *Acceptance:* Artist can sign up, log in, see dashboard shell. Magic link arrives in <30s. ✓ tested

- [x] **Artist dashboard shell** ✓ completed 2026-03-22
  - Vite + React SPA with TanStack Router
  - Collapsible sidebar layout (shadcn Sidebar component) with mobile sheet overlay
  - Routes: /dashboard (overview), /pages (capture pages), /fans, /analytics, /settings
  - Empty states for all sections with contextual guidance
  - shadcn/ui installed (Radix Nova preset, Tailwind v4) with brand-themed dark mode
  - Design tokens from landing page applied (Bricolage Grotesque, honey-gold, midnight)
  - *Acceptance:* Authenticated artist sees dashboard with navigation. Empty states guide next actions. ✓

- [x] **Capture page creator (dashboard)** ✓ completed 2026-03-22
  - Form: title, value exchange message, streaming platform links, social links, color/accent picker
  - Generates unique slug (server-side, with collision avoidance)
  - Saves to Supabase via Hono API (auth middleware auto-creates artist record on first request)
  - Edit support: pre-populated dialog with PATCH to update existing pages
  - Delete support via card dropdown menu
  - Build pipeline trigger deferred to next task
  - *Acceptance:* Artist creates a page, sees it in dashboard, can edit and delete. ✓

- [x] **Capture page customization (dashboard)** ✓ completed 2026-03-22
  - 6 theme presets (Gold, Neon, Ember, Violet, Minimal, Verdant) — one-click fills all style options
  - Individual override knobs: accent/secondary color pickers, text/bg color pickers, background effect (solid/gradient/glow), button style (rounded/pill/sharp), font style (modern/editorial/mono/condensed), title size (Sm/Md/Lg), layout (side-by-side/stacked)
  - Migration: `secondary_color`, `background_style`, `button_style`, `font_style`, `title_size`, `layout_style`, `text_color`, `bg_color` columns on `capture_pages`
  - *Acceptance:* Artist picks a preset or customizes individual knobs. Settings persist and display on page cards. ✓
  - [x] **Polish: visual differentiation between presets** ✅ March 25, 2026 — stronger gradients/glow, 4 font stacks, 3 title sizes, stacked layout, custom text/bg colors (light mode support), smart contrast for button text, fade-in animation, hover/active states

- [x] **Capture page live preview (dashboard)** ✓ completed 2026-03-22
  - Inline preview component in the page creator/editor dialog (above theme presets)
  - Shows title, value exchange text, email input, CTA button, streaming link indicators
  - Reflects accent/secondary color, background style, and button style in real time
  - *Acceptance:* Artist sees a representative preview updating live as they change theme settings. ✓
  - [x] **Polish: preview reflects new style options** ✅ March 25, 2026 — preview now mirrors font style, title size, layout, text/bg colors, and smart contrast

- [x] **Capture page build pipeline** ✓ completed 2026-03-22
  - `buildPage()` in `api/src/lib/build-page.ts`: reads page from Supabase → generates HTML via template → Brotli 11 compress → uploads to R2 (`c/{slug}/index.html`)
  - HTML template in `api/src/lib/capture-template.ts`: dark theme, system font stack, inline CSS/JS, SVG icons for streaming + social links, form with fetch submission
  - R2 client in `api/src/lib/r2.ts`: S3-compatible via `@aws-sdk/client-s3`
  - Routes in `api/src/routes/build.ts`: `POST /:id/build` (single page), `POST /rebuild-all` (all active pages)
  - Auto-triggers on page create and update (fire-and-forget from capture-pages route)
  - Retry on upload failure (3 attempts), build timestamp comment in HTML
  - R2 bucket: `afterset-capture-pages` (Cloudflare, East North America)
  - Generated pages ~2.7–2.8KB uncompressed (well within 14KB budget)
  - *Acceptance:* Build runs in <10s. R2 files confirmed present. ✓ CDN serving deferred to public capture page task.

- [x] **Public capture page (`afterset.net/c/[slug]`)** ✓ completed 2026-03-23
  - [x] Static HTML generated and uploaded to R2 (build pipeline complete)
  - [x] Dark theme, system font stack, 7:1+ contrast, 48×48px touch targets
  - [x] Single email input, streaming/social buttons, value exchange messaging, entry method tracking
  - [x] Cloudflare Worker serving pages from R2 at `afterset.net/c/[slug]` — deployed and verified live
  - [x] CDN routing verified end-to-end (nameservers propagated, pages load in browser)
  - Build pipeline updated: R2 stores uncompressed HTML, Cloudflare CDN handles compression at edge
  - *Acceptance:* Page loads <2s on slow 3G. Total payload <14KB compressed. Dark theme legible at 10% brightness.

- [x] **Cloudflare Worker for fan email submission** ✓ completed 2026-03-23
  - POST endpoint at `afterset.net/api/capture` (same origin as capture page)
  - Validates email format
  - Writes to `fan_captures` via Supabase `service_role` key (bypasses RLS + Auth)
  - Upserts on `(artist_id, email)` — handles duplicates gracefully, returns 200 OK regardless
  - Writes to `capture_events` and `pending_emails`
  - Capture template updated with hidden `slug` and `entry_method` inputs + JS sets entry_method from `?v=` query param
  - Tested end-to-end on `afterset.net/c/shoes`
  - *Acceptance:* Fan submits email, it appears in artist's fan list. Duplicate submissions handled silently.

- [x] **QR code generation + download** ✓ completed 2026-03-23
  - Server-side generation via `qrcode` lib, 1200x1200 PNG (300 DPI at 4"), error correction H
  - Cached in R2 at `c/{slug}/qr.png`, generated alongside HTML in `buildPage`
  - QR encodes `https://afterset.net/c/[slug]?v=q` — never shortener URLs
  - API endpoint `GET /capture-pages/:id/qr.png` serves cached PNG, `?download=1` triggers file download
  - Dashboard shows QR thumbnail on each page card with download button
  - Old QR cleaned up from R2 on slug change
  - *Acceptance:* Artist can view and download a print-quality QR code that resolves to their capture page.

### P1 — Should ship

- [x] **Incentive file upload (dashboard)** ✓ completed 2026-03-22
  - Artist uploads a file as the incentive fans receive after submitting their email
  - Accepted formats: audio (MP3, WAV, FLAC, AAC, OGG, M4A, AIFF), image (PNG, JPG, GIF), video (MP4, MOV, WebM), document (PDF), archive (ZIP). Max 250MB per file.
  - Upload flow: API generates signed upload URL → client uploads directly to Supabase Storage (file never transits Railway)
  - Stored in Supabase Storage (`incentives` bucket, private). Path: `{artist_id}/{capture_page_id}/{filename}`. Signed download URLs generated on demand.
  - One incentive file per capture page — uploaded in the capture page creator/editor. Uploading a new file deletes the old one.
  - New columns on `capture_pages`: `incentive_file_path`, `incentive_file_name`, `incentive_file_size`, `incentive_content_type` (migration required)
  - Dashboard shows file name, size, type icon, and replace/remove options. Upload progress indicator.
  - *Acceptance:* Artist uploads a file in the page creator, sees it attached, can replace or remove it. File persists in Supabase Storage.
  - **Note:** Delivery to fans happens in Sprint 2 via the follow-up email (signed download link included in email template).

- [x] **Capture confirmation screen (in-page)** *(done 2026-03-23)*
  - "You're in!" displayed immediately via localStorage-first pattern (before network responds)
  - Shows incentive-specific message ("We'll send a track to your inbox") or generic ("We'll be in touch soon")
  - `fetch()` POST fires with `keepalive: true` and 10-second `AbortController` timeout
  - On page reload, retries any unsent submissions from localStorage queue (`afterset_q`)
  - *Acceptance:* Fan sees confirmation within 200ms of tapping submit, even on poor connectivity.

- [x] **Basic capture list (dashboard)** *(done 2026-03-23)*
  - Artist sees all captured fans (email, date, source page, capture method)
  - Sortable table on /fans route, per-page filtering via ?page_id= query param
  - Capture count + link on each page card
  - *Acceptance:* Artist can see a list of fans who signed up, with basic metadata.

- [x] **Capture form rate limiting** *(done 2026-03-23)*
  - In-memory IP+slug rate limiting on the Worker: 5 submissions per IP per minute per capture page
  - Returns 429 with friendly message to the fan
  - *Acceptance:* Legitimate fans unaffected. Bot submitting 100 emails in a minute gets blocked after 5.

- [x] **Mobile performance validation** *(done 2026-03-23)*
  - Capture page 2.7KB transferred, well under 14KB budget
  - 2.07s on throttled slow 3G — acceptable for MVP (bottleneck is TCP/TLS, not payload)
  - Added favicon suppressor (`<link rel="icon" href="data:,">`) to eliminate 10KB wasted request
  - *Acceptance:* Manual DevTools throttle test confirms performance. Favicon fix saves ~10KB.

---

## Sprint 2: Follow-Up & Analytics (Weeks 3–4)

**Goal:** Automated follow-up emails send after capture. Artist sees basic analytics. Telnyx verification submitted (long lead time).

**Business parallel:** Business Phase B (ToS, Privacy Policy, PO Box, insurance) must be complete before Sprint 3 ships billing and beta invites. PO Box address is needed for CAN-SPAM email footer in this sprint. CAN-SPAM compliance tasks in Phase B overlap with the Resend integration below — build them together.

### P0

- [x] **Resend email integration** *(done 2026-03-23)*
  - `EmailService` abstraction in `api/src/lib/email/` — `ResendEmailService` wraps Resend SDK with suppression checks, `List-Unsubscribe` + `List-Unsubscribe-Post` header injection, CAN-SPAM footer
  - RFC 8058 one-click unsubscribe: `POST /api/email/unsubscribe` (HMAC-signed tokens, no DB lookup)
  - Browser fallback: `GET /api/email/unsubscribe` returns confirmation HTML
  - Resend webhook receiver: `POST /api/email/webhooks/resend` — handles `email.bounced`, `email.complained`, `email.delivered` with Svix signature verification via SDK
  - Suppression list: `isSuppressed()` / `addSuppression()` / `filterSuppressed()` — checked transparently inside `send()` and `sendBatch()`
  - Migration: `provider_message_id` column on `pending_emails` for webhook correlation
  - *Acceptance:* System can send a fan email with proper headers, unsubscribe works, bounces update suppression list.
  - **Requires setup before testing:** see env vars and Resend dashboard config below

- [x] **Follow-up email template editor (dashboard)** *(done 2026-03-23)*
  - `email_templates` table: one per capture page, subject/body/delay_mode/include_incentive_link/is_active
  - API routes: `GET/PUT/DELETE /api/capture-pages/:id/email-template` + preview endpoint
  - Email HTML renderer: `renderFollowUpHtml()` — clean email with incentive download CTA
  - Dashboard: `EmailTemplateDialog` accessible from PageCard dropdown + dedicated "Emails" sidebar tab
  - Emails tab shows all pages grouped by configured/unconfigured with template preview cards
  - Delay modes: immediate, 1 hour, next morning (9am)
  - Live email preview in sandboxed iframe
  - *Acceptance:* Artist creates and previews a follow-up email template tied to a capture page. Incentive download link works and expires after 7 days.

- [x] **Delayed email trigger via pg_cron** *(done 2026-03-23)*
  - Configurable delay per capture page: immediate, 1 hour, next morning (9am in artist's timezone)
  - **Artist timezone stored in profile and used in `send_at` calculation** — `NOW()` is UTC, naive date math sends "next morning" emails at 1am Pacific
  - pg_cron polls `pending_emails` every 60 seconds: `WHERE send_at <= NOW() AND status = 'pending' LIMIT 50`
  - pg_net POSTs batch to Railway API endpoint `/api/emails/send-batch`
  - Railway calls Resend batch API (100 emails/call, 2 calls/sec)
  - Updates status to `sent` or `failed`. Retry job every 5 minutes for `failed` (up to 3 attempts).
  - **Log latency on the email send endpoint** — catch intermittent Railway slowness that pg_net timeouts might mask
  - *Acceptance:* Fan captured at 9pm Pacific, email arrives at 9am Pacific next morning (if configured). Failed sends retry. Latency logged.

- [x] **Per-page analytics (dashboard)** *(done 2026-03-23)*
  - Captures per page/gig
  - Capture method breakdown (QR vs. direct link — text-to-join added in Sprint 3)
  - Time-series chart of captures (Recharts)
  - *Acceptance:* Artist sees capture count and method breakdown per page.

### P1

- [x] **Dashboard overview** *(done 2026-03-23)*
  - Live stat cards (Total Fans, Capture Pages, This Week) wired to `/api/analytics`
  - Growth-over-time area chart (last 30 days, Recharts)
  - Top 5 performing pages with progress bars
  - Recent captures table (last 10, compact view)
  - Empty state with "Get Started" CTA when no fans yet
  - *Acceptance:* Artist's home dashboard shows at-a-glance metrics.

- [x] **Fan list with filtering** *(done 2026-03-23)*
  - Filter by: capture page (dropdown), date range (date inputs), capture method (dropdown)
  - Search by email (real-time text input)
  - Active filter badges with individual clear buttons
  - Result count displayed when filters active
  - API supports all filter params: `page_id`, `method`, `date_from`, `date_to`, `search`
  - *Acceptance:* Artist can filter their fan list to find fans from a specific gig or date.

- [x] **CSV export** *(done 2026-03-23)*
  - `GET /captures/export` endpoint returns CSV with same filter support as list endpoint
  - Export button on fan list page, respects current filters
  - Columns: Email, Page, Method, Date
  - *Acceptance:* Downloaded CSV opens correctly in Excel/Sheets with all fields.

- [ ] **Submit Telnyx toll-free verification (EARLY — Sprint 3 critical path)**
  - [ ] Create account at telnyx.com — sign up, verify email
  - [ ] Add payment method (credit card required before provisioning numbers)
  - [ ] Buy a toll-free number — Numbers → Search, filter by toll-free (833 or 844 prefix, ~$1/month)
  - [ ] Enable SMS on the number — in the number's settings, add SMS capability ($0.10/month add-on)
  - [ ] Create a Messaging Profile — this is where the webhook URL goes later (`https://api.afterset.net/webhooks/sms`)
  - [ ] Submit toll-free verification — provide: business name, use case ("fan engagement — fans text a keyword to receive a link to an artist's capture page"), estimated monthly volume, sample message content
  - 3–15 business day approval window. Runs in parallel with Sprint 2 dev work. Removes Sprint 3 timing risk.
  - *Acceptance:* Verification submitted. Number provisioned. Approval pending.

### P2

- [x] **Sequential email sequences (drip campaigns)** *(done 2026-03-23)*
  - `email_templates` refactored: dropped one-per-page constraint, added `sequence_order` + `delay_days` columns
  - `pending_emails` linked to specific template via `email_template_id`, with `UNIQUE(fan_capture_id, email_template_id)` for resubmit dedup
  - Worker queues all active templates at capture time; step 0 uses `delay_mode`, step 1+ sends N days later at 9am artist timezone
  - Sequence CRUD API: `GET/PUT/DELETE /capture-pages/:id/email-sequence/:order` with monotonic delay_days validation
  - Frontend: sequence editor dialog with collapsible steps, add/delete, per-step preview
  - Analytics: per-step sent/opened/open_rate breakdown on page analytics
  - *Acceptance:* Artist creates a 3-email sequence; fans receive each email at the configured intervals.

- [x] **Email open tracking** *(done 2026-03-23)*
  - Resend `email.opened` webhook updates `opened_at` on `pending_emails` (first-open-only, idempotent)
  - Overview API returns `emails_sent`, `emails_opened`, `open_rate` per page
  - Per-page analytics API returns `email: { sent, opened, open_rate }`
  - Dashboard + Analytics pages display open rate per page
  - *Acceptance:* Analytics dashboard shows open rate percentage per capture page.

---

## Sprint 3: Text-to-Join + Polish (Weeks 5–6)

**Goal:** Second capture method live. Product ready for first users.

**Business gates:** Business Phase B ⛔ must be complete (ToS, Privacy Policy, insurance bound) before billing goes live or beta invites go out. Business Phase C ⛔ must be complete (10DLC approved, TCPA compliance tested) before text-to-join goes live. TCPA exposure is $500–$1,500 per unsolicited message with no cap.

### P0

- [!] **Telnyx text-to-join integration** *(blocked by: toll-free verification from Sprint 2 + 10DLC approval from Business Phase C)*
  - Configure Telnyx messaging profile: auto opt-in/opt-out for STOP/HELP/END/CANCEL/QUIT/UNSUBSCRIBE
  - Webhook URL: `https://api.afterset.net/webhooks/sms`
  - Fan texts keyword → Hono API matches keyword in `sms_keywords` table → auto-reply with capture page URL
  - Reply template: GSM-7 only, single 160-char segment, no emoji/smart quotes
  - Brand identification ("Afterset") in every reply
  - Fallback response for unrecognized keywords
  - Keyword cache in memory on Railway (refresh on artist changes)
  - `SmsService` abstraction wrapping Telnyx — Twilio implementation built only if needed
  - **TCPA requirements baked into implementation:**
    - Auto opt-out must honor ALL of: STOP, UNSUBSCRIBE, CANCEL, QUIT, END, OPT OUT, OPTOUT, OPT-OUT, REVOKE, STOPALL
    - Immediately cease all marketing messages on any keyword match
    - Send ONE opt-out confirmation (within 5 minutes, zero promotional content)
    - Not configurable by artists — platform-enforced at code level
    - Handle HELP keyword with support information
    - Implement 8 AM–9 PM sending restriction based on recipient's local timezone (TCPA legal requirement)
    - Queue messages outside window for delivery at 8 AM recipient time
  - **Consent logging (5-year retention):**
    - Log every opt-in: exact timestamp, phone number, keyword used, consent language displayed, artist ID
    - Log every opt-out: timestamp, method (SMS keyword, email, web form, other)
    - Maintain internal do-not-text database
    - Consent is artist-specific — opt-in for Artist A cannot be used for Artist B
  - *Acceptance:* Fan texts keyword, receives link within 5 seconds, opens capture page, submits email — full flow works. All TCPA requirements verified (see compliance sign-off below).

- [x] **Keyword management (dashboard)** *(done 2026-03-24)*
  - Artist claims keyword per capture page (typically stage name or band abbreviation)
  - Case-insensitive (stored uppercase), 2–20 chars, alphanumeric only
  - Reserved keywords blocked (STOP, HELP, END, CANCEL, QUIT, UNSUBSCRIBE, START, INFO, YES, NO)
  - First-come-first-served conflict resolution with alternative suggestions
  - Keyword + toll-free number displayed in dashboard alongside QR code
  - *Acceptance:* Artist sets unique keyword. System rejects duplicates/reserved words and suggests alternatives.

- [ ] **SMS compliance sign-off gate** ⛔ *(must pass before text-to-join goes live)*
  - [ ] 10DLC registration approved (Business Phase C)
  - [ ] TCPA-compliant call-to-action templates available for artists (Business Phase C)
  - [ ] TCPA-compliant auto-reply contains all required disclosures (Business Phase C)
  - [ ] STOP/HELP/all opt-out keywords tested with real phone numbers
  - [ ] Consent logging verified — records contain all required fields, retention set to 5 years
  - [ ] 8 AM–9 PM timezone restriction tested across time zones
  - [ ] Full end-to-end flow documented as compliance evidence
  - *Acceptance:* All boxes checked. Compliance evidence saved. SMS feature can ship.*

### P1

- [x] **Capture method attribution** *(already implemented in Sprint 2)*
  - Fan captures tagged with method: QR (`?v=q`), text-to-join (`?v=s`), direct link (`?v=d`)
  - Analytics updated to reflect all three methods
  - *Acceptance:* Analytics breakdown shows all capture methods accurately.

- [x] **Onboarding flow** *(done 2026-03-24)*
  - 3-step full-screen wizard: profile (name + timezone) → create first page (full PageForm) → success (QR download + live preview)
  - `onboarding_completed` boolean on artists table; auth layout redirects to `/onboarding` if false
  - PageForm extracted to shared component (`web/src/components/page-form.tsx`) used by both onboarding and pages route
  - *Acceptance:* New artist completes onboarding and has a working capture page within 5 minutes.

- [ ] **Pricing / billing integration (Stripe)** *(blocked by: Business Phase B — ToS + Privacy Policy must be published)*
  - Free / Pro ($12) / Band ($25) tiers
  - Enforce limits: free = 3 pages, 100 captures/month, QR only
  - Stripe Checkout for upgrades
  - *Acceptance:* Free user hits limit, sees upgrade prompt. Payment works. Pro features unlock.

- [ ] **Manual QA — full feature clickthrough** *(checklist: `QA-CHECKLIST.md`)*
  - 12-section end-to-end test covering: auth, onboarding, dashboard, capture pages, email sequences, broadcasts, fans, analytics, settings, fan-facing capture page, cross-cutting (nav, responsive, errors, loading), QR code flow
  - Excludes SMS inbound (not yet live)
  - Bug log table at bottom of checklist for tracking issues
  - *Acceptance:* All checkboxes pass. Bugs logged and triaged.

- [ ] **Landing page update**
  - Swap waitlist CTA for signup/login CTA
  - Update copy to reflect live product
  - *Acceptance:* afterset.net drives signups to the live app.

### P2

- [x] **Error handling & edge case polish** *(done 2026-03-24)*
  - Global toast notification system (sonner) for all mutation errors via MutationCache
  - Query error states with retry on all pages (dashboard, pages, fans, emails, analytics)
  - Silent failure fixes: CSV export, QR download, QR preview
  - Double-click prevention on page delete
  - *Remaining:* Offline/poor-signal behavior on capture pages (test localStorage retry at a real venue)
  - *Acceptance:* No blank screens, no silent failures. Every error has a user-facing message.

- [x] **High-impact UI polish** *(done 2026-03-24)*
  - Login: spam folder hint, resend magic link button, expiry note
  - Broadcasts: info banner explaining why fields are disabled on non-draft broadcasts
  - Onboarding: email skip button demoted to subtle text link with guidance
  - Settings: timezone auto-detect promoted from tiny link to proper button
  - *Acceptance:* No user confusion on these flows.

- [x] **Broadcast archive** *(done 2026-03-24)*
  - `archived_at` column on broadcasts table (soft delete)
  - Archive/unarchive API endpoints (`POST /broadcasts/:id/archive`, `/unarchive`)
  - GET /broadcasts excludes archived by default (`?archived=true` to include)
  - "Show archived" toggle in Emails tab UI
  - Archived cards shown at reduced opacity with "Unarchive" option
  - *Acceptance:* Sent broadcasts can be cleaned up without losing stats.

- [x] **Medium/low-impact UI polish** ✅ March 24, 2026
  - Empty states: guide users on what to do next (dashboard, analytics, fans)
  - Email sequence steps: visually distinguish step 0 (immediate) from delayed steps
  - Broadcast filters: auto-update recipient count on filter change
  - Character counts: show inline with labels (45/200 format)
  - Keyword availability: loading spinner during debounce
  - Dialog scroll shadows for long content
  - Broadcast stats: label open rate, explain recipients vs sent
  - Analytics loading: contextual message instead of bare spinner
  - Theme preset buttons: larger swatches or mini previews
  - Nav active state: stronger contrast
  - Capture page edit: keyword section moved to top, collapsible streaming/social links, link persistence across pages
  - Dialog overlay: darkened for better readability

- [ ] **Invite waitlist users to beta**
  - Email waitlist via Kit with beta access instructions
  - Include founding member pricing offer (50% off Pro for life, first 100)
  - *Acceptance:* Waitlist users receive email and can sign up for the live product.

---

## Sprint 5 — Pricing Tier Enforcement

Adds all gates needed to enforce the Solo / Tour / Superstar tier structure defined in `PRICING.md`. No Stripe integration — changing an artist's `tier` column (via dev switcher, direct Supabase row edit, or eventual Stripe webhook) automatically gates/ungates features. Planning decisions captured in `memory/project_sprint_5_decisions.md`.

**Design invariants:**
- Effective tier computed at request time via `getEffectiveTier()` — no cron needed for trial expiry
- Fan captures are never rejected — over-cap captures persist, marked with `cap_exceeded_at` (historical marker only, no behavioral gating)
- Over-cap fans are informational only — visible, counted in analytics, emailed normally (subject to email cap). Decision 5A.
- Email skips are tracked — `pending_emails.skip_reason` (`email_cap` / `tier_locked` / `stale`) surfaces why a row didn't send, shown in usage meter, banner, per-page stats
- Pending emails use 7-day staleness cap — `claim_pending_emails()` filters `send_at > NOW() - interval '7 days'` so ancient emails don't fire on catch-up
- Worker duplicates a ~15-line slice of tier config in `worker/src/tier.ts`; parity test blocks drift with API
- All monthly caps use artist timezone, matching existing `getTodayRange(tz)` pattern
- NFC captures on Solo soft-accept as `entry_method='direct'` — never reject (physical tags in the wild). Decision 2d.
- No waitlist DB or notify-me flow — upgrade CTAs show static "Reach out to Matthew at hello@afterset.net" contact text until Stripe lands. Decision 4.
- Existing artists grandfathered to `superstar` with `trial_ends_at=NULL` in the migration. Decision 1.
- Downgrades preserve data: sequence steps locked in editor, SMS keywords kept, broadcast history kept, NFC soft-accepted. Decision 2.

### Phase 1 — Foundation

All other phases depend on this. Estimated: 2–3 hours.

- [x] **Migration: tier columns + tracking markers** — `20260413000000_pricing_tiers.sql` ships `tier_level` enum, `artists.tier`+`trial_ends_at`, `fan_captures.cap_exceeded_at`, `pending_emails.skip_reason`+`skip_reason_at`, grandfathers existing artists to `superstar`, updates `claim_pending_emails()` with 7-day staleness cap. ✅ 2026-04-13
- [x] **Tier config module** — `api/src/lib/tier.ts` (`TIER_LIMITS`, `getEffectiveTier()`, `getTierLimits()`, `isTrialActive()`), `getMonthRange(tz)` added to `api/src/lib/timezone.ts`. ✅ 2026-04-13
- [x] **Worker tier slice + parity test** — `worker/src/tier.ts` slim copy, `api/tests/tier-parity.test.ts` asserts overlapping fields match. 3 passing tests. ✅ 2026-04-13
- [x] **Auth middleware: include tier in Artist type** — `tier` + `trial_ends_at` on `Artist`, auto-create sets `trial_ends_at` to +30d. ✅ 2026-04-13
- [x] **Settings API: expose tier info** — GET returns `tier`, `trial_ends_at`, `effective_tier`, `is_trial`. PATCH never accepts tier. `ArtistSettings` extended with `Tier` union. ✅ 2026-04-13
- [x] **Dev tier switcher endpoint** — `POST /api/dev/set-tier { tier, trialDays? }`, mounted only when `NODE_ENV !== 'production'`. ✅ 2026-04-13
- [x] **Frontend `useTier` hook** — reads cached `["settings"]` query, returns `{ tier, effectiveTier, trialEndsAt, isTrial, limits, isLoading }`. ✅ 2026-04-13
- [x] **Pricing display config** — `web/src/lib/pricing.ts` with `TIER_DISPLAY`, `TIER_LIMITS`, `COPY` exports; header comment documents landing-page→this-file→api/tier.ts source-of-truth chain. ✅ 2026-04-13

### Phase 2 — Backend Gates

Each task is independent. All depend on Phase 1. Estimated: 4–5 hours total.

- [x] **Capture method gating (Worker)** — `worker/src/index.ts` computes effective tier from joined artist row, rejects SMS on Solo (403 + upgrade payload), soft-accepts NFC by rewriting to `entry_method='direct'`. QR/direct always allowed. ✅ 2026-04-13
- [x] **Fan count cap (Worker)** — `maybeMarkOverCap()` runs post-insert: counts month-to-date `fan_captures` for the artist, stamps `cap_exceeded_at = NOW()` on the new row when over limit. Superstar short-circuits via `Number.isFinite(fanCap)` check. ✅ 2026-04-13
- [~] **First-crossing notification (Worker)** — detection wired (cap marker set on first over-cap row of the month). Email dispatch deferred — `pending_emails` schema currently routes via `email_template_id`/`broadcast_id`, so system-notification delivery needs a separate channel or schema addition. Tracked inline in `maybeMarkOverCap()` comment. Rolled forward as Phase 3/4 follow-up.
- [x] **Email volume cap + skip tracking** — `send-batch.ts` now runs `markStaleRows()` (7-day send_at sweep → `skip_reason='stale'`) before claiming, then `partitionByTier()` batches artist tier fetches + template sequence_order fetches + per-artist monthly sent counts to classify claimed rows. Over-cap rows release back to `pending` with `skip_reason='email_cap'`; out-of-tier rows release with `skip_reason='tier_locked'`. Successful sends clear skip markers. `broadcasts.ts` `POST /:id/send` pre-checks via `checkMonthlyEmailCap`. ✅ 2026-04-13
- [x] **Sequence depth gating (API + Worker + skip tracking)** — `email-templates.ts` `PUT /:id/email-sequence/:order` blocks when `order >= getTierLimits().sequenceDepth` (403 + upgrade). Worker's `queueSequenceEmails()` filters templates by tier depth at capture time. `send-batch.ts` partition logic flags over-depth rows as `tier_locked`. ✅ 2026-04-13
- [x] **Broadcast gating** — `broadcasts.ts` POST blocks Solo (403 + upgrade). PUT strips advanced filters (date + method) for Tour, keeps page-id filter; Superstar keeps all. Send path enforces `checkMonthlyBroadcastLimit()` + `checkMonthlyEmailCap()`. Historical broadcasts remain visible across tiers. ✅ 2026-04-13 (segmentation split refined 2026-04-13)
- [x] **CSV export gating** — `captures.ts` `GET /export` returns 403 + upgrade payload when `hasCsvExport` is false (Solo/Tour). ✅ 2026-04-13
- [x] **Storage cap** — `incentive.ts` `POST /:id/incentive/upload-url` sums existing `incentive_file_size` (excluding the page being replaced) and returns 413 with used/limit MB when the new upload would exceed the tier cap. ✅ 2026-04-13
- [x] **Usage tracking endpoint** — new `api/src/routes/usage.ts` mounted at `/api/usage` returns `{ tier, effective_tier, is_trial, fans, emails, broadcasts, storage }` for the current month. `emails.paused_by_reason` breaks out `email_cap` / `tier_locked` / `stale`. Uses 8 parallel Supabase count queries. ✅ 2026-04-13

### Phase 3 — Frontend Gates

Depend on Phase 1 + corresponding Phase 2 backend gates. Estimated: 4–5 hours total.

- [x] **Tier comparison component** ✅ 2026-04-13 — `web/src/components/tier-comparison.tsx` shipped; current tier highlighted with honey-gold border
- [x] **Upgrade prompt component** ✅ 2026-04-13 — `web/src/components/upgrade-prompt.tsx` shipped with `compact` + full variants, deep-links to /settings
- [x] **SMS keyword gating** ✅ 2026-04-13 — `KeywordSection` is now wrapped: on Solo, the entire "Capture Methods" `EditorSection` in `page-form.tsx` is hidden (cleaner editor; QR is the only Solo capture method anyway, exposed via the page-card "Download QR" button). NFC URL section + page-card NFC/SMS buttons also hidden for Solo
- [x] **Sequence editor locked steps** ✅ 2026-04-13 — steps beyond `limits.sequenceDepth` render with dashed border + Lock badge + disabled expand; at-limit shows UpgradePrompt for next tier
- [x] **Broadcast gating (frontend)** ✅ 2026-04-13 — Solo hides New Broadcast button + shows full UpgradePrompt; Tour shows "X / 4 broadcasts used" counter. Compose dialog: Tour can expand "Filter recipients" → page picker only (date + method panel replaced inline with Superstar UpgradePrompt); Solo gets a "Tour" badge on the disabled filter button + compact upgrade pitch
- [x] **CSV export locked button** ✅ 2026-04-13 — Export button shows Lock icon + Superstar badge when not allowed; click toasts upgrade message and early-returns
- [x] **Usage meters + paused indicators** ✅ 2026-04-13 — `web/src/components/usage-meters.tsx` + `useUsage` hook; 4 meters (fans/emails/broadcasts/storage); color-coded green→yellow @75%→red @100%; paused count + reason tooltip; QA fix: bars hidden entirely when limit is unlimited
- [x] **Paused emails banner** ✅ 2026-04-13 — `web/src/components/paused-emails-banner.tsx` mounted on dashboard above tabs; details Dialog breaks down by reason
- [x] **Tonight tile paused indicator** ✅ 2026-04-13 — Follow-Up Emails card on Tonight tab shows paused count with AlertTriangle when >0; backend `analytics.ts` extended to query `skip_reason`
- [x] **Per-page paused stats** ✅ 2026-04-13 — `EmailSequenceSteps` in show drill-down shows per-step paused counts; per-page analytics endpoint returns `paused` per step
- [x] **Settings plan card + dev switcher** ✅ 2026-04-13 — `web/src/components/plan-card.tsx` rendered above Account card; usage meters, tier comparison, upgrade copy, compliance footnote; dev-only red-bordered tier switcher posts to `/dev/set-tier`. QA fix: Solo overview drill-down content now upgrade-prompts instead of expanding ShowDrillDown; "Select a show" subtitle hidden on Solo
- [x] **Help topic: why emails might not send** ✅ 2026-04-13 — "Why might my fans not receive emails?" added to `help-topics.ts` under Emails & Sequences

### Phase 4 — Trial Flow

Depends on Phases 1 + 2. Estimated: 1 hour.

- [ ] **Trial banner** — new `web/src/components/trial-banner.tsx`: dismissible banner in authenticated layout when `isTrial === true`. "Your Tour-level free trial ends in X days." Yellow at 7 days, red at 3 days. Links to Settings Plan section. Rendered in `web/src/routes/_authenticated.tsx`
- [ ] **Trial expiry handling** — `getEffectiveTier()` already handles this (returns `solo` when trial expires). Existing sequence steps, SMS keywords, broadcast history, NFC setup all preserved per Decision 2. Pending emails for now-locked sequence steps get `skip_reason='tier_locked'` at next send-batch run. NFC captures soft-accept as `direct`. No grace period for MVP

### Not in scope (separate workstreams)

- Stripe integration + payment UI (upgrade CTAs show static contact info placeholder)
- Admin panel for managing tiers (dev switcher + direct Supabase row edits cover this pre-Stripe)
- Upgrade requests DB table / notify-me flow (not needed until Stripe lands with paying users)
- Layered messaging for consecutive over-cap months (communication-only, add if abuse patterns emerge)
- Hard gate on over-cap fan re-engagement (revisit only if informational-only cap proves exploitable)
- Analytics tier gating (revisit when analytics are more developed)
- SMS webhook handler (prerequisite for Tour's text-to-join promise)
- Superstar email overage billing (needs Stripe metered billing)

---

## Open Decisions Tracker

| # | Decision | Resolution | Status |
|---|---|---|---|
| 1 | Text-to-Join in v1 or v1.5? | **v1 (Sprint 3)** — Telnyx toll-free, keyword routing | Resolved |
| 2 | NFC in v1? | **Shipped** — NFC URL in page editor + help docs | Resolved |
| 3 | Built-in email vs. integration layer? | **Built-in (Resend)** with `EmailService` abstraction. Kit/Mailchimp CSV export in v1.1. | Resolved |
| 4 | Custom domains for capture pages | **`afterset.net/c/[slug]` for v1.** Custom domains (CF4SaaS) at 200+ artists. | Resolved |
| 5 | Email sending domain | **`send.afterset.net`** (corrected from ADR-002's `.com` reference — we only own `.net`) | Resolved |
| 6 | Managed services model (Ring 2) | After 10–20 paying users | Open |
| 7 | Multi-industry timing (Ring 3) | After 500 paying musician users | Open |
| 8 | Founding member pricing deployment | 50% off Pro for life, email-only, first 100 | Open |
| 9 | SMS reply URL shortener conflict | ADR-003 bans shorteners on entry method URLs (800ms penalty). ADR-005 requires GSM-7 single segment (160 chars). TCPA compliance reply needs terms/privacy links that may not fit without short URLs. **Key question:** does the shortener ban apply only to the capture page URL (which the fan is waiting to load) or to all URLs in the SMS reply (including legal disclosure links the fan taps later)?  Options: (A) No shorteners ever — use `afterset.net/t` and `afterset.net/p` as short first-party paths for terms/privacy. (B) Allow shortener for legal links only, ban remains for capture page URL. (C) Accept 2-segment message for the confirmation reply. | **Needs decision** |

---

## Known Risks & Accepted Trade-offs

Documented during the ADR critical review. These are not blockers — they have mitigations.

| Risk | Severity | Mitigation | Status |
|---|---|---|---|
| TCPA vicarious liability from artist misuse | High | Platform-enforced opt-out handling (artists can't disable). Consent logging with 5-year retention. Indemnification clause in ToS. Attorney review within 90 days. | Business Phase B + C |
| Supabase is a single point of total failure | High (at scale), Low (at 50 artists) | Accept at launch. localStorage captures survive outages. Health endpoint monitors Supabase status. | Accepted |
| Undocumented PostgREST rate limit | High | Load test in Day 5 (blocking validation). If throttle found, add queue immediately. If <100 req/sec, evaluate Neon. | Validation pending |
| Two fan-facing deployment surfaces | Medium | Document in deployment checklist. Separate testing for Worker vs. build pipeline. | Accepted |
| Resend is ~3 years old (69 incidents since Feb 2024) | Medium | `EmailService` abstraction enables provider swap. Auth emails have no fallback at launch — accept risk. | Accepted |
| Railway is a startup | Low | Hono runs on Cloudflare Workers, Fly.io, any Node.js host. Migration is a deployment config change. | Accepted |

---

## Post-Launch Backlog (Unprioritized)

These are not scheduled. Pull from here once Sprints 1–3 ship.

- [ ] Kit / Mailchimp CSV export + direct integration (v1.1)
- [x] NFC tap-to-capture — shipped
- [ ] Gig calendar with auto-generated capture pages (Layer 2)
- [ ] Financial tracking alongside fan data (Layer 3)
- [ ] AI-powered "suggest email copy" button (Hono API route, rate limited by tier)
- [ ] Custom domains for capture pages (CF4SaaS at 200+ artists)
- [ ] Team / band member accounts (Band tier)
- [x] Mobile native app consideration — see Sprint 4 below
- [ ] MCP task server — build when file-based tracking outgrows itself
- [ ] Per-artist custom sending domains (Resend Scale at ~200 artists)
- [ ] SES migration for cost optimization (at 500K–1M emails/month)
- [ ] Dedicated-number-per-artist SMS (Telnyx, at 500+ Pro artists)
- [ ] **Incentive type research** — research what fan incentives statistically perform best for email capture (free downloads, discount codes, exclusive content, early access, etc.) to inform product design
- [ ] Link-based incentives — artist pastes a URL (mint page, exclusive video, playlist) instead of uploading a file
- [ ] Discount code incentives — artist enters a code + optional storefront URL, delivered to fan after capture
- [ ] NFT / crypto incentives — claim links, token gates, allowlist spots (Sound.xyz, Catalog, Mint Songs integration)

---

## Sprint 4 — Mobile-First + PWA

**Goal:** Make the dashboard mobile-optimized and installable as a PWA, with a path to App Store / Play Store via Capacitor.

### Phase 1 — Mobile UX (P0)

- [x] **Bottom tab navigation** — Replace hamburger sidebar with persistent 5-tab bottom bar on mobile (Overview, Pages, Emails, Fans, Analytics). Settings moves to profile avatar in header. Sidebar remains on desktop. ✅ 2026-03-25
- [x] **Card view for captures table** — On mobile (<768px), render captures/fans as stacked cards instead of horizontal-scroll table. ✅ 2026-03-25
- [x] **Touch target audit** — Ensure all buttons, links, and interactive elements are ≥44px tap targets. ✅ 2026-03-25
- [x] **Mobile-optimized dialogs** — Full-screen sheets on mobile instead of centered dialogs (page form, email template editor, broadcast composer). ✅ 2026-03-25
- [x] **Responsive typography pass** — Verify text sizing, truncation, and readability on 320px–428px viewports. ✅ 2026-03-25

### Phase 2 — PWA Setup (P0)

- [x] **Web app manifest** — `manifest.json` with app name, icons (192/512px), `display: standalone`, theme color `#0a0e1a`, background color `#0a0e1a`. ✅ 2026-03-25
- [x] **Service worker via vite-plugin-pwa** — Cache app shell + static assets for offline access. Runtime caching for API responses (stale-while-revalidate for dashboard data). ✅ 2026-03-25
- [x] **Apple PWA meta tags** — `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, splash screen images. ✅ 2026-03-25
- [x] **App icons** — Generate full icon set (favicon, apple-touch-icon, PWA icons) from Afterset logo. SVG "A" lettermark (honey-gold on midnight). ✅ 2026-03-25
- [x] **Install prompt** — Custom "Add to Home Screen" banner for first-time mobile visitors. SW update toast via Sonner. ✅ 2026-03-25

### Phase 3 — App Store Distribution (P2, when ready)

- [x] **Add Capacitor** — `@capacitor/core` + `@capacitor/ios` + `@capacitor/android` installed. `capacitor.config.ts` in `web/`. ✅ 2026-03-25
- [x] **Push notifications** — `@capacitor/push-notifications` installed. `usePushNotifications` hook registers device token on native platforms. `POST /api/device-tokens` API endpoint + `device_tokens` migration. ✅ 2026-03-25
- [x] **Native splash screen** — `@capacitor/splash-screen` configured (midnight bg, 2s duration, auto-hide). ✅ 2026-03-25
- [ ] **Apply `device_tokens` migration** — `supabase db push` to create the table in Supabase.
- [ ] **Generate native projects** — Run `pnpm build:web && cd web && npx cap add ios && npx cap add android && npx cap sync` on Mac with Xcode + Android Studio installed.
- [ ] **iOS push notification setup** — Enable Push Notifications capability in Xcode, configure APNs key in Apple Developer portal.
- [ ] **Android push notification setup** — Create Firebase project, add `google-services.json` to `android/app/`.
- [ ] **Apple Developer Account** — $99/yr, submit to App Store.
- [ ] **Google Play Console** — $25 one-time, submit to Play Store.

---

## Notes

- This file is the interim task tracker. Update statuses here directly.
- When a task is blocked, mark `[!]` and add a comment below it explaining the blocker.
- ADR docs live in the project knowledge. Copy to `docs/adrs/` in the app repo on Day 4.
- The landing page (afterset.net) remains a separate Next.js deployment on Vercel — unaffected by the dashboard stack choice.
- Capture pages use system font stack for performance. Dashboard uses brand fonts (Bricolage Grotesque, DM Sans, Space Mono). They will look different — this is intentional.
- **Business Setup runs as a parallel track.** Items marked ⛔ are hard gates — the sprint they reference cannot ship without them. Business Phase A should start immediately (Day 1). Business Phase C (toll-free verification) should start during Sprint 2 for the approval window. Full rationale in ADR-006.
- **Cost summary:** ~$50/mo infrastructure + ~$47.50/mo recurring business costs + ~$1,340–$1,600 one-time business setup (Phases A+B) + ~$220–$610 within 90 days (Phase D).
