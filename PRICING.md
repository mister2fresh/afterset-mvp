# Pricing Tier Handoff — MVP Implementation Notes

**Date:** 2026-04-11
**Context:** Landing page pricing is being updated to the structure below. This document captures the cost analysis, enforcement points, and implementation recommendations for the MVP repo.

---

## Final Tier Structure

| | Solo ($12/mo) | Tour ($25/mo) | Superstar ($100/mo) |
|---|---|---|---|
| Capture methods | QR only | QR + Text-to-Join + NFC | QR + Text-to-Join + NFC |
| Fan cap | 500/mo | 5,000/mo | Unlimited |
| Follow-up emails | 1 (immediate only) | 3-step sequences | 5-step sequences |
| Broadcasts | None | 4/mo | Unlimited |
| Broadcast targeting | — | Send to all + segment by show | + method & date filters |
| Analytics | Tonight + All Shows | + per-show drill-down | + period trends, venue reports |
| Data export | None | None | CSV + API |
| Support | Community | Email | Priority |

**Free trial:** 1 month at Tour level for all new signups.

---

## Email Volume — Cost Analysis

Resend pricing: $20/mo for 50K emails, $0.90/1K overage.

### Per-tier worst case

| Tier | Fans | Sequences | Broadcasts | Max emails/mo | Resend cost | Margin |
|---|---|---|---|---|---|---|
| Solo | 500 | 1 step × 4 shows = 2,000 | 0 | 2,000 | ~$0 (within 50K shared pool) | ~$12 |
| Tour | 5,000 | 3 steps × 4 shows = 60,000 | 4 × 5,000 = 20,000 | 80,000 | ~$47 | **-$22** |
| Superstar | 20,000+ | 5 steps × 4 shows = 400,000 | unlimited | 500,000+ | ~$425 | **-$325** |

### Realistic case (average active artist)

| Tier | Fans | Sequences | Broadcasts | Likely emails/mo | Resend cost | Margin |
|---|---|---|---|---|---|---|
| Solo | 100 | 1 × 2 shows = 200 | 0 | 200 | ~$0 | ~$12 |
| Tour | 1,000 | 3 × 2 shows = 6,000 | 2 × 1,000 = 2,000 | 8,000 | ~$0 (within pool) | ~$25 |
| Superstar | 5,000 | 5 × 3 shows = 75,000 | 4 × 5,000 = 20,000 | 95,000 | ~$60 | ~$40 |

### Recommendation: Monthly email caps (not shown on landing page)

| Tier | Email cap | Overage |
|---|---|---|
| Solo | 1,000/mo | Hard cap — captures still work, emails pause until next cycle |
| Tour | 10,000/mo | Hard cap — same behavior |
| Superstar | 50,000/mo | $1/1,000 emails over cap (mirrors industry standard) |

These caps keep every tier profitable at realistic usage. Tour worst-case (80K) can't happen because the 10K email cap kicks in well before that. Superstar overage pricing means the artist pays proportionally as they scale.

**Enforcement points:**
- Sequence sends: Check monthly email count before `claim_pending_emails()` in the email worker
- Broadcasts: Check count before scheduling in `broadcasts.ts`
- Overage billing: Needs Stripe metered billing or usage-based add-on (not built)

---

## SMS Cost Analysis

Telnyx: $1.10/mo number lease + $0.0055/segment inbound + $0.0055/segment reply.

| Volume | Monthly cost | Notes |
|---|---|---|
| 200 msg/mo (launch) | ~$3.50 | Absorbed into Tour subscription |
| 2,000 msg/mo (growth) | ~$23 | Still within Tour margin at realistic usage |
| 20,000 msg/mo (scale) | ~$221 | Needs attention — consider per-SMS overage at scale |

SMS is only available on Tour+ so the $25/mo and $100/mo price points absorb this. At scale (20K+ msgs), consider adding SMS to the overage model or capping monthly SMS captures per tier.

---

## Storage Cost Analysis

Supabase storage for incentive file uploads (250MB max per file).

| Tier | Suggested cap | Rationale |
|---|---|---|
| Solo | 500MB total | ~2 files, hobbyist |
| Tour | 2GB total | Enough for a catalog of downloads |
| Superstar | 10GB total | Power user with video content |

Not enforced today. Enforcement: check total storage in `beforeUpload` middleware.

---

## Enforcement Implementation Checklist

These are the gates needed in the MVP to enforce the tier structure:

### Tier field
- [ ] Add `tier` column to `artists` table (enum: solo/tour/superstar/trial)
- [ ] Add `trial_ends_at` timestamp (nullable, set to NOW() + 30 days on signup)
- [ ] Middleware/helper: `getEffectiveTier(artist)` — returns trial tier if within window, else paid tier

### Capture method gating
- [ ] Worker: Check artist tier before accepting SMS/NFC captures (QR/direct always allowed)
- [ ] Frontend: Hide SMS keyword management for Solo tier
- [ ] Frontend: Show upgrade prompt when Solo artist tries to access Text-to-Join or NFC settings

### Fan count caps
- [ ] Worker: Before inserting `fan_captures`, count current month's new fans for artist
- [ ] If over cap: Still accept the capture event (don't lose the fan), but mark as `capped: true` and trigger upgrade notification
- [ ] Dashboard: Show "X of 500 fans captured this month" progress bar

### Email caps
- [ ] Email worker: Before `claim_pending_emails()`, check monthly send count against tier cap
- [ ] If over cap: Skip claiming, log `email_cap_reached` event
- [ ] Superstar overage: Track overage count for billing (needs Stripe metered billing integration)
- [ ] Dashboard: Show email usage meter

### Sequence depth
- [ ] `email_templates` route: Reject `sequence_order > 0` for Solo, `> 2` for Tour
- [ ] Frontend: Show locked steps with upgrade prompt in inline-sequence-editor.tsx

### Broadcast gating
- [ ] Solo: Block broadcast creation entirely (upgrade prompt)
- [ ] Tour: Change `DAILY_BROADCAST_LIMIT` to monthly, set to 4
- [ ] Tour: Page/show segmentation only; hide date + method filters in broadcast-compose-dialog.tsx
- [ ] Superstar: Unlock advanced segmentation (date + method) + unlimited sends

### CSV export gating
- [ ] `captures/export` route: Check tier, return 403 for Solo/Tour with upgrade message
- [ ] Frontend: Show locked export button with "Superstar" badge

### Storage caps
- [ ] Upload route: Check total storage used by artist against tier cap
- [ ] Return 413 with upgrade message if over cap

---

## Upgrade Triggers (in priority order)

These are the moments to show upgrade prompts in the product:

1. **Fan cap hit** — Most visceral. "You captured 501 fans this month — 1 fan is waiting. Upgrade to keep capturing."
2. **SMS keyword attempt on Solo** — "Text-to-Join is available on Tour. Upgrade to let fans text to join."
3. **Sequence step locked** — "Add steps 2-3 to your follow-up sequence with Tour."
4. **Broadcast attempt on Solo** — "Send announcements to your full fan list with Tour."
5. **Export attempt on Solo/Tour** — "Export your fan data with Superstar."
6. **Email cap hit** — "You've sent 10,000 emails this month. Upgrade for higher limits."
7. **Advanced segmentation attempt on Tour** — "Filter by signup date or entry method with Superstar."

---

## Landing Page Selling Points to Highlight

From MVP research — these are real, shipped differentiators worth marketing:

- **Pages load in under 14KB** — first TCP round-trip. No other fan capture tool is this fast.
- **Works offline** — localStorage queue for captures when venue WiFi drops. Syncs when back online.
- **Permanent QR codes** — slug never changes. Print once, use forever. Only the display title updates.
- **Per-show re-engagement** — returning fans get the full email sequence again at each new show (dedup is per capture_event, not per fan).

---

## Open Questions for MVP

1. **Trial→paid conversion flow:** What happens when the 30-day trial ends? Grace period? Downgrade to Solo? Lock account?
2. **Stripe integration:** Not built. Needed for paid tiers + Superstar overage metering.
3. **SMS webhook:** Inbound handler (POST /api/webhooks/sms) is not built. Must ship before Tour tier can deliver on text-to-join promise.
4. **Grandfathering:** If pricing changes later, are early adopters locked in? This affects the founding member email offer.
