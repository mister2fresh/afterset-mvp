# Afterset — Feature Backlog

Future feature requests and ideas. Not scheduled — pull from here once current sprint work ships.

## Email & Messaging

- [x] **Broadcast campaigns** — shipped March 24, 2026. CRUD + send/schedule, segment filters, 4 preset templates, reply-to toggle, open tracking.
- [ ] **AI-powered "suggest email copy" button** — Hono API route, rate limited by tier
- [ ] **Per-artist custom sending domains** — Resend Scale plan, triggers at ~200 artists
- [ ] **SES migration** — cost optimization at 500K–1M emails/month
- [ ] **Dedicated-number-per-artist SMS** — Telnyx, triggers at 500+ Pro artists

## Integrations

- [ ] **Kit / Mailchimp CSV export + direct integration** (v1.1)
- [ ] **Link-based incentives** — artist pastes a URL (mint page, exclusive video, playlist) instead of uploading a file
- [ ] **Discount code incentives** — artist enters a code + optional storefront URL, delivered to fan after capture
- [ ] **NFT / crypto incentives** — claim links, token gates, allowlist spots (Sound.xyz, Catalog, Mint Songs integration)

## Capture Methods

- [ ] **NFC tap-to-capture** (v1.2)

## Onboarding

- [x] **Add email setup step to onboarding wizard** — shipped March 24, 2026. New step 3 "Follow-Up Email" between page creation and ready screen; inline editor with subject, body, delay mode, incentive toggle, preview, and skip option.

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
- [ ] **Geography breakdown** — approximate city from IP at Worker level; map or top-cities list
- [ ] **Device breakdown** — mobile vs desktop from User-Agent; informs signage placement decisions
- [ ] **Gig calendar with title history** — log of past show titles per page; helps artists recall when/where they played (Layer 2)
- [ ] **Financial tracking alongside fan data** (Layer 3)

## Show Location Tagging (Geo-Based)

**Goal:** Let artists tag a "show" with one tap using GPS, so all fan captures during that show are automatically grouped by venue. Zero typing required in the happy path.

**Why:** The dashboard architecture (Tonight / All Shows) depends on show-scoped data. Without frictionless show creation, the per-show stats table, capture rate comparisons, and city leaderboards have no data to display. This is the missing input layer.

**User story:** Between soundcheck and doors, the artist taps "I'm at a show" → grants location → sees a suggested venue name → confirms with one tap → all QR captures for the rest of the night attach to that show.

### Phase 1 — Data Model / Schema

- [ ] Add `shows` table: `id`, `artist_id`, `venue_name`, `city`, `state`, `country`, `latitude`, `longitude`, `started_at`, `ended_at`, `is_active`, `created_at`, `updated_at`
- [ ] Add optional `show_id` FK to captures. Null = captured outside a tagged show.
- [ ] `getActiveShow(artistId)` — returns active show or null; enforces one active show per artist
- [ ] `getShowStats(showId)` — total captures, QR scans, page views, capture rate
- [ ] Existing captures work with show_id = null (no breaking changes)

### Phase 2 — Geolocation + Venue Lookup

- [ ] `getCurrentPosition()` — wraps browser Geolocation API, returns lat/lng or structured error (denied, unavailable, timeout)
- [ ] `suggestVenue(lat, lng)` — calls geocoding/places API, returns 1–3 nearest venue-like results (name, address, city, state, country, distance)
- [ ] Evaluate providers: Google Places (most accurate, costs money), Mapbox (generous free tier), OSM/Nominatim (free, weaker on venue names)
- [ ] Cache venue lookups by rounded lat/lng (3 decimal places ≈ 110m radius)

### Phase 3 — "I'm at a Show" UI

- [ ] One-tap flow: button → geolocation → venue suggestion card → confirm
- [ ] Venue suggestion card: venue name (large), address (small), city/state. Actions: "That's right" / "Not quite" (edit)
- [ ] On confirm → show record created, Tonight tab activates
- [ ] On "Not quite" → inline edit fields pre-filled with geo results
- [ ] Location denial fallback → manual entry with IP-based city suggestion
- [ ] No venue found → show street address, let artist type name, pre-fill city/state
- [ ] Dark theme: midnight bg, honey-gold confirm button

### Phase 4 — Dashboard Wiring (Tonight / All Shows)

- [ ] Tonight tab: show header from active show, KPIs scoped to active showId, capture rate, recent fan feed, email sequence status
- [ ] All Shows tab: aggregate KPIs, fan growth chart (captures per show), show-by-show performance table
- [ ] Show table columns: Date, Venue, City, Fans Captured, QR Scans, Capture Rate, Avg Open Rate
- [ ] Row expand → email sequence performance for that show's fan cohort
- [ ] Top cities / venues leaderboard

### Phase 5 — Edge Cases, Empty States, Polish

- [ ] No GPS → manual entry with IP-based city
- [ ] Auto-close shows after 8 hours of inactivity; notification on next app open
- [ ] Unattached captures (showId = null) → "Untagged captures" row in All Shows table
- [ ] Allow starting new show after ending current one (one-active constraint)
- [ ] Venue name correction on completed shows
- [ ] Empty states: Tonight (no active show → large "I'm at a show" button), All Shows (no shows → illustration + message), single show (hide leaderboard)
- [ ] Prompt "Were you at a show?" if captures come in without an active show

## Platform

- [ ] **Light mode / theme toggle** — lighter palette option for the dashboard; persist preference in artist settings
- [ ] **Custom domains for capture pages** — CF4SaaS at 200+ artists
- [ ] **Team / band member accounts** — Band tier
- [ ] **Mobile native app consideration**
- [ ] **MCP task server** — build when file-based tracking outgrows itself
- [ ] **Feature branch workflow for /ship** — update ship skill to create feature branch + PR by default instead of pushing directly to main; prevents parallel Claude Code sessions from conflicting on staging area

## Research

- [ ] **Incentive type research** — research what fan incentives statistically perform best for email capture (free downloads, discount codes, exclusive content, early access, etc.) to inform product design
