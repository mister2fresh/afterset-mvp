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
- [ ] **Capture method effectiveness** — conversion rates per method (QR scans vs completions, SMS clicks vs completions)
- [ ] **Geography breakdown** — approximate city from IP at Worker level; map or top-cities list
- [ ] **Device breakdown** — mobile vs desktop from User-Agent; informs signage placement decisions
- [ ] **Gig calendar with title history** — log of past show titles per page; helps artists recall when/where they played (Layer 2)
- [ ] **Financial tracking alongside fan data** (Layer 3)

## Platform

- [ ] **Light mode / theme toggle** — lighter palette option for the dashboard; persist preference in artist settings
- [ ] **Custom domains for capture pages** — CF4SaaS at 200+ artists
- [ ] **Team / band member accounts** — Band tier
- [ ] **Mobile native app consideration**
- [ ] **MCP task server** — build when file-based tracking outgrows itself
- [ ] **Feature branch workflow for /ship** — update ship skill to create feature branch + PR by default instead of pushing directly to main; prevents parallel Claude Code sessions from conflicting on staging area

## Research

- [ ] **Incentive type research** — research what fan incentives statistically perform best for email capture (free downloads, discount codes, exclusive content, early access, etc.) to inform product design
