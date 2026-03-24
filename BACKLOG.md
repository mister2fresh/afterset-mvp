# Afterset — Feature Backlog

Future feature requests and ideas. Not scheduled — pull from here once current sprint work ships.

## Email & Messaging

- [ ] **Broadcast campaigns** — artist-initiated one-off emails to full fan list or segments (by capture page, date range, method). Compose with existing plain-text renderer, send now or schedule, campaign history with open rates. Ships in Emails tab alongside drip sequences. **V1 required.**
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

- [ ] **Add email setup step to onboarding wizard** — after page creation, guide artist through configuring their first follow-up email before the success screen

## Dashboard & Analytics

- [ ] **Date range picker + period comparison** — let artists slice analytics by week/month/custom range; compare periods ("this week vs last week")
- [ ] **Trend deltas on stat cards** — "+23% captures this week" arrows showing direction of change
- [ ] **Email funnel visualization** — Sent → Delivered → Opened → Clicked drop-off chart per sequence step
- [ ] **Best time to capture heatmap** — captures by day-of-week and hour; helps artists understand when fans engage
- [ ] **Page comparison** — select 2-3 pages side-by-side to compare theme/incentive/sequence performance
- [ ] **Cohort view** — group fans by capture date (e.g., "March 15 show"), track email engagement over time per cohort
- [ ] **Capture method effectiveness** — conversion rates per method (QR scans vs completions, SMS clicks vs completions)
- [ ] **Geography breakdown** — approximate city from IP at Worker level; map or top-cities list
- [ ] **Device breakdown** — mobile vs desktop from User-Agent; informs signage placement decisions
- [ ] **Gig calendar with auto-generated capture pages** (Layer 2)
- [ ] **Financial tracking alongside fan data** (Layer 3)

## Platform

- [ ] **Light mode / theme toggle** — lighter palette option for the dashboard; persist preference in artist settings
- [ ] **Custom domains for capture pages** — CF4SaaS at 200+ artists
- [ ] **Team / band member accounts** — Band tier
- [ ] **Mobile native app consideration**
- [ ] **MCP task server** — build when file-based tracking outgrows itself

## Research

- [ ] **Incentive type research** — research what fan incentives statistically perform best for email capture (free downloads, discount codes, exclusive content, early access, etc.) to inform product design
