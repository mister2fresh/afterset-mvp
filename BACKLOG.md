# Afterset — Feature Backlog

Future feature requests and ideas. Not scheduled — pull from here once current sprint work ships.

## Email & Messaging

- [x] **Broadcast campaigns** — shipped March 24, 2026. CRUD + send/schedule, segment filters, 4 preset templates, reply-to toggle, open tracking.
- [x] **Move follow-up sequences into capture pages, keep Emails tab for broadcasts only** — shipped March 31, 2026. Inline sequence editor in PageForm (edit mode), Emails tab refactored to broadcasts-only.
- [ ] **AI-powered "suggest email copy" button** — Hono API route, rate limited by tier
- [ ] **Per-artist custom sending domains** — Resend Scale plan, triggers at ~200 artists
- [ ] **SES migration** — cost optimization at 500K–1M emails/month
- [ ] **Dedicated-number-per-artist SMS** — Telnyx, triggers at 500+ Pro artists

## Social & Streaming Links

- [ ] **"Follow All" button on capture page** — single CTA that opens all streaming/social profiles, reducing friction vs tapping each icon individually
- [x] **Show social/streaming icons on all fan communications** — shipped March 31, 2026. Icons added to follow-up emails, broadcast emails, and download page via shared `api/src/lib/icons.ts` module.
- [ ] **Move social/streaming text links to email footer** — currently positioned directly under the CTA button, looks tacky. Move to bottom of email with more spacing/separation from body content.
- [ ] **Link click tracking** — redirect endpoint (`GET /l/:token`) that logs clicks and 302s to the real URL. HMAC token encodes platform, source (capture page / download page / email), page ID, and optional fan ID. New `link_clicks` table: `artist_id`, `fan_id`, `platform` (spotify/instagram/tiktok/etc.), `source` (capture_page/download_page/email), `source_id`, `clicked_at`. Covers all three surfaces: SVG icon links on capture pages (via Worker), SVG icon links on download pages (via API), and text links in follow-up/broadcast emails. Gives artists insight into which platforms their fans actually engage with.

## Integrations

- [ ] **Kit / Mailchimp CSV export + direct integration** (v1.1)
- [ ] **Link-based incentives** — artist pastes a URL (mint page, exclusive video, playlist) instead of uploading a file
- [ ] **Discount code incentives** — artist enters a code + optional storefront URL, delivered to fan after capture
- [ ] **NFT / crypto incentives** — claim links, token gates, allowlist spots (Sound.xyz, Catalog, Mint Songs integration)

## Capture Methods

- [x] **NFC tap-to-capture** — NFC URL in page editor + help topic

## Onboarding

- [x] **Add email setup step to onboarding wizard** — shipped March 24, 2026. New step 3 "Follow-Up Email" between page creation and ready screen; inline editor with subject, body, delay mode, incentive toggle, preview, and skip option.
- [ ] **Interactive onboarding tutorial** — guided walkthrough of the capture page form with tooltip arrows pointing to each section (theme, links, keyword, incentive) explaining what it does. Tutorial-style, step-by-step progression with dismissible overlays. Makes onboarding educational without blocking artists who want to skip ahead.

## Dashboard & Analytics

- [x] **Rename "Top Pages" to "Captures by Show"** — shipped March 26, 2026. Grouped by title snapshot, full drill-down (method breakdown, daily trend, email stats) for all entries including deleted pages, inline within single card.
- [ ] **Expanded reports** — sortable/filterable show list by capture method, timeframe, and engagement rate; exportable report views; top-level sort controls on "Captures by Show" section
- [ ] **Date range picker + period comparison** — let artists slice analytics by week/month/custom range; compare periods ("this week vs last week")
- [ ] **Trend deltas on stat cards** — "+23% captures this week" arrows showing direction of change
- [x] **Branded fan-facing theme consistency** — follow-up emails now inherit artist's capture page colors (accent, bg, text, button style); shipped March 26, 2026
- [ ] **Broadcast email theme editor** — let artists override the inherited theme per broadcast (color pickers for accent, bg, text + button style) instead of always pulling from their latest capture page
- [ ] **Rich text email editor** — replace plain-text body textarea with a rich text editor (bold, italic, links, lists) for broadcasts and follow-up templates; renders to inline-styled HTML for email client compatibility
- [ ] **Fan-facing preview tab** — preview tab in page form editor showing capture page, email, and download page side by side; let artists customize download page copy (button text, heading, description)
- [ ] **Email funnel visualization** — Sent → Delivered → Opened → Clicked drop-off chart per sequence step
- [ ] **Best time to capture heatmap** — captures by day-of-week and hour; helps artists understand when fans engage
- [ ] **Page comparison** — select 2-3 pages side-by-side to compare theme/incentive/sequence performance
- [ ] **Cohort view** — group fans by capture date (e.g., "March 15 show"), track email engagement over time per cohort
- [ ] **Page view tracking + capture rate** — track page loads in the Cloudflare Worker (lightweight counter or `page_views` table); enables "X% of visitors became fans" capture rate KPI on the Tonight dashboard tab
- [ ] **Capture method effectiveness** — conversion rates per method (QR scans vs completions, SMS clicks vs completions)
- [ ] **Geography breakdown** — extract `cf-ipcity` header from Cloudflare Worker, store alongside captures; top-cities list + map (see `afterset/docs/research/geolocation-strategy.md`)
- [ ] **Device breakdown** — mobile vs desktop from User-Agent; informs signage placement decisions
- [ ] **Gig calendar with title history** — log of past show titles per page; helps artists recall when/where they played (Layer 2)
- [ ] **Financial tracking alongside fan data** (Layer 3)

## Show / Venue Tagging

> **Decision (2026-04-11):** No fan-side geolocation. Artist tags venue at gig creation via Google Places Autocomplete. Full rationale in `afterset/docs/research/geolocation-strategy.md`.

**Goal:** Let artists associate captures with a venue so the dashboard can show per-venue and per-city analytics. The artist knows the venue — don't ask the fan.

**User story:** Artist creates/updates a show → searches for venue by name (Google Places Autocomplete, no location permission needed) → confirms → all captures during that show inherit the venue.

### Phase 1 — Data Model

- [ ] Add `venues` table: `id`, `google_place_id`, `name`, `address`, `city`, `state`, `country`, `latitude`, `longitude`, `created_at`
- [ ] Add `shows` table: `id`, `artist_id`, `venue_id` (FK), `started_at`, `ended_at`, `is_active`, `created_at`, `updated_at`
- [ ] Add optional `show_id` FK to captures. Null = captured outside a tagged show.
- [ ] `getActiveShow(artistId)` — returns active show or null; enforces one active show per artist
- [ ] Existing captures work with show_id = null (no breaking changes)
- [ ] Deduplicate venues by `google_place_id` — artists playing the same venue share one record

### Phase 2 — Google Places Autocomplete (Artist Dashboard)

- [ ] Integrate Google Places Autocomplete (New) in React SPA — text search, IP-based biasing, no device permissions
- [ ] Use Text Search Essentials (IDs Only) tier — free and unlimited
- [ ] On venue select: store `place_id`, name, address, city, state, country, lat/lng in `venues` table
- [ ] Cache aggressively — indie artists play the same 5–20 venues repeatedly
- [ ] Optional "Use my location" button via Web Geolocation API for artist convenience (not required)

### Phase 3 — "I'm at a Show" UI

- [ ] One-tap flow: button → venue search autocomplete → select → show created, Tonight tab activates
- [ ] Recent venues list for quick re-selection (most artists rotate 5–20 venues)
- [ ] On confirm → show record created, Tonight tab activates
- [ ] Manual entry fallback if venue not in Google Places
- [ ] Dark theme: midnight bg, honey-gold confirm button

### Phase 4 — IP-Based Fan Geography (Phase 2 of geo strategy)

- [ ] Extract `cf-ipcity` header in Cloudflare Worker on fan capture — free, no client code
- [ ] Store approximate city alongside capture event
- [ ] Top-cities list / map on analytics dashboard
- [ ] Update privacy policy to disclose IP-derived city collection

### Phase 5 — Dashboard Wiring

- [ ] Tonight tab: show header from active show, KPIs scoped to active showId, capture rate, recent fan feed
- [ ] All Shows tab: aggregate KPIs, fan growth chart, show-by-show performance table
- [ ] Show table columns: Date, Venue, City, Fans Captured, Capture Rate, Avg Open Rate
- [ ] Row expand → email sequence performance for that show's fan cohort
- [ ] Top cities / venues leaderboard

### Phase 6 — Edge Cases, Empty States, Polish

- [ ] Auto-close shows after 8 hours of inactivity; notification on next app open
- [ ] Unattached captures (show_id = null) → "Untagged captures" row in All Shows table
- [ ] Allow starting new show after ending current one (one-active constraint)
- [ ] Venue name correction on completed shows
- [ ] Empty states: Tonight (no active show → large "I'm at a show" button), All Shows (no shows → illustration + message)
- [ ] Prompt "Were you at a show?" if captures come in without an active show

## UX Polish

- [ ] **Sticky save button in page editor** — pin save button to bottom of dialog so it's always visible while scrolling the long form
- [ ] **Progressive disclosure in page editor** — collapsible sections to reduce visual overwhelm (see memory: project_page_editor_simplify)

## Auth & Account Recovery

- [ ] **Google / Apple OAuth login** — add as linked auth method via Supabase `signInWithOAuth()`; doubles as recovery path if artist loses email access and reduces magic-link friction
- [ ] **Phone number as backup login** — let artists link a phone number in settings; use Supabase `signInWithOtp({ phone })` via Telnyx as fallback auth method
- [ ] **Admin account recovery process** — document manual identity verification + email change workflow via Supabase dashboard for support escalations

## Platform

- [ ] **Light mode / theme toggle** — lighter palette option for the dashboard; persist preference in artist settings
- [ ] **Custom domains for capture pages** — CF4SaaS at 200+ artists
- [ ] **Team / band member accounts** — Band tier
- [ ] **Mobile native app consideration** — Capacitor not justified for location features alone (venue search is a text problem); revisit only if push notifications, offline, or NFC scanning become requirements
- [ ] **MCP task server** — build when file-based tracking outgrows itself
- [ ] **Feature branch workflow for /ship** — update ship skill to create feature branch + PR by default instead of pushing directly to main; prevents parallel Claude Code sessions from conflicting on staging area
- [ ] **Stripe integration** — subscription billing for Solo/Tour/Superstar tiers; webhook handler to update `artists.tier` on payment events; Superstar email overage via metered billing
- [ ] **Grandfathering / founding member pricing** — lock early adopters into discounted rate when pricing changes; needs `founding_member` flag or price_id tracking in Stripe

## Research

- [ ] **Incentive type research** — research what fan incentives statistically perform best for email capture (free downloads, discount codes, exclusive content, early access, etc.) to inform product design
