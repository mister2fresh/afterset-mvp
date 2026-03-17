# ADR-002: Email Sending — Resend (with shared-to-custom domain migration path)

**Status:** Accepted
**Date:** March 17, 2026
**Author:** Afterset team
**Affects:** Fan follow-up delivery, capture page UX (email validation), Supabase Auth SMTP, compliance architecture, template system, multi-tenant isolation

---

## Decision

**Resend Pro ($20/mo)** as the email sending provider for both fan follow-up emails and Supabase Auth SMTP. Fan emails send from a **shared Afterset subdomain** (`send.afterset.com`) at launch, with a planned migration to **optional per-artist custom domains** at ~200 artists. An **`EmailService` abstraction layer** wraps all sending operations from day one, enabling a cost-optimization migration to Amazon SES at scale without rewriting application code.

**Critical day-1 configuration:** Configure Resend SMTP credentials in Supabase Auth dashboard (Supabase's default rate limit is 2 emails/hour without custom SMTP — per ADR-001). Set up `send.afterset.com` with SPF, DKIM, and DMARC records. Register Google Postmaster Tools for domain reputation monitoring. Implement real-time email validation on the capture form before the first fan email is ever sent.

---

## Context

Afterset's follow-up email is the product's first post-capture touchpoint. A fan scans a QR code at a live show, enters their email, and receives a single automated email delivering a value exchange (free download link, exclusive content). If that email doesn't reach the inbox, the entire value proposition breaks — the fan got nothing for their effort, and the artist lost the connection.

The email workload has two distinct types:

1. **Fan follow-up emails** (fan-facing, critical path): One email per captured fan, sent after a configurable delay (immediate, 1 hour, or next morning). Must have high deliverability. Volume scales linearly with fan captures.
2. **Auth/system emails** (artist-facing): Magic link login, password reset, billing receipts. Low volume, standard transactional patterns. Delivered via Supabase Auth's custom SMTP integration.

### Scale projections

| Phase | Artists | Fan emails/month | Auth emails/month | Total/month |
|---|---|---|---|---|
| Launch (month 1–2) | ~50 | ~5,000 | ~500 | ~5,500 |
| Traction (month 6) | 200+ | ~60,000 | ~2,000 | ~62,000 |
| Growth (year 1) | 1,000 | ~300,000 | ~10,000 | ~310,000 |
| Scale (year 2+) | 10,000 | ~3,000,000 | ~100,000 | ~3,100,000 |

### Why this decision carries significant downstream weight

The sending domain becomes part of every artist's fan relationship. DKIM signatures, From addresses, and domain reputation are visible to fans and to email providers. Switching domains mid-flight means re-warming a new domain (4–8 weeks), potential inbox placement drops during transition, and broken trust with artists whose emails stop landing. The compliance architecture (CAN-SPAM, GDPR, unsubscribe handling) must be designed around the provider's capabilities from the start.

### The structural tailwind

Research revealed a critical insight: **entertainment and music emails have the highest engagement rates and lowest spam complaint rates of any email category.** Mailchimp benchmarks show music at 21.88% open rate for marketing emails; MailerLite reports 38.98%. Click-through rates for media/entertainment are the highest of any industry at 4.48–4.62%. Spam complaint rates sit at 0.005% — 20× below Gmail's 0.1% recommended threshold. [VERIFIED — Mailchimp, MailerLite, GetResponse]

Afterset's emails have an even stronger profile because they are triggered by explicit user action (QR scan + email entry). Welcome/triggered emails average 45–83% open rates. A reasonable projection for Afterset's fan follow-ups is **50–70% open rates**. This engagement profile is itself the strongest deliverability signal to Gmail's algorithms — stronger than any provider's IP reputation. [VERIFIED for benchmarks; INFERRED for Afterset projections]

### Constraints

- Solo developer — DX and integration speed are high priority.
- Deployment platform is not locked (currently Vercel, but Railway/Fly.io/AWS are open options per ADR-001).
- Fan follow-up emails are commercial under CAN-SPAM (contain download links, promotional content).
- GDPR applies to any EU/EEA fan regardless of where the show occurs.
- Email cost must stay well under $1/artist/month to preserve margin on $12–25/mo pricing.
- Many gigging musicians do not own custom domains — the onboarding flow cannot require one.

---

## Options Considered

### Option A: Resend — SELECTED

**What it is:** Developer-focused email API (YC W23), built by the React Email team, reportedly running on AWS SES infrastructure. First-class Next.js SDK, native Supabase SMTP integration with dedicated documentation, React Email for component-based templates, and a programmatic Domains API for multi-tenant management.

**Pricing:**

| Plan | Monthly cost | Emails included | Sending domains | Overage |
|---|---|---|---|---|
| Pro | $20 | 50,000 | 10 | $0.90/1K |
| Scale | $90 | 100,000 | 1,000 | $0.90/1K |
| Enterprise | Negotiated | Custom | Custom | Custom |
| Dedicated IP | +$30 (Scale+) | — | — | 500/day minimum |

[VERIFIED — resend.com/pricing]

**Rate limits:** 2 API requests/sec per team, but the batch API accepts 100 emails per call — effective throughput of **200 emails/second**. A 200-fan gig's follow-ups clear in one second. Excess requests receive HTTP 429 with retry-after headers. [VERIFIED]

**Multi-tenant domains:** Scale plan includes 1,000 domains with full CRUD API (create, verify, monitor, delete programmatically). Each domain gets independent DKIM/SPF/DMARC verification with DNS health monitoring. Covers Afterset's growth phase completely. [VERIFIED]

**Webhook infrastructure:** `email.bounced`, `email.delivery_delayed`, `email.complained`, `email.suppressed`. Signed via Svix, at-least-once delivery, retry up to 10 hours. Automatic suppression list handles hard bounce and complaint suppression on all plans. [VERIFIED]

**Risks:**

1. **Platform maturity.** Resend is ~3 years old with 69 tracked incidents since February 2024, including a 3.5-hour outage in February 2026 from database connection exhaustion. For auth emails, a fallback SMTP provider is advisable at scale. [VERIFIED — IsDown, Resend status page]
2. **No automatic List-Unsubscribe headers.** Afterset must inject `List-Unsubscribe` and `List-Unsubscribe-Post` headers via the API and build the RFC 8058 POST endpoint. This is required by Gmail/Yahoo for bulk senders since June 2024. [VERIFIED]
3. **Enterprise pricing uncertainty.** At 3M emails/month, Scale's hard cap (5× monthly quota = 500K) is exceeded. Enterprise negotiation is required — estimated $1,500–2,500/month based on published overage rates. [INFERRED]

---

### Option B: Amazon SES — PLANNED SCALE PROVIDER

**What it is:** AWS's raw email sending primitive. $0.10 per 1,000 emails flat, no subscriptions, no minimum fees.

**Cost comparison at each phase:**

| Phase | Resend cost | SES cost | Savings |
|---|---|---|---|
| Launch (5K/mo) | $20 | ~$0.50 | $19.50 |
| Traction (60K/mo) | $29 | ~$6 | $23 |
| Growth (300K/mo) | $270 | ~$30 | $240 |
| Scale (3M/mo) | ~$2,500 | ~$300 | ~$2,200 |

[VERIFIED pricing]

**Key strength for multi-tenant:** Up to 10,000 verified identities per region (expandable to 300,000). The newer Tenants feature provides per-tenant reputation isolation with automated sending pauses — purpose-built for Afterset's model at scale. Configuration Sets (up to 10,000) enable per-artist routing. [VERIFIED — AWS docs]

**Why not selected for launch:** The operational tax is substantial for a solo developer. New accounts start in sandbox mode. The SDK is verbose (IAM configuration, region selection, boilerplate). Bounce/complaint handling requires wiring SNS topics with subscription confirmation handshakes. No built-in dashboard, message search, or template editor. This is weeks of setup time better spent on product. [VERIFIED]

**Why it's the planned scale provider:** At 300K emails/month, SES saves $240/month versus Resend. At 3M emails/month, $2,200/month. The `EmailService` abstraction layer built on day one makes migration a configuration change. SES's Tenants feature provides per-artist reputation isolation that the shared Afterset domain can't achieve at scale. Virtual Deliverability Manager ($0.07/1K) adds ISP-level insights still cheaper than Resend. [VERIFIED pricing; INFERRED architecture]

**Key gap:** Gmail does not provide complaint feedback to SES directly — Google Postmaster Tools remains essential for Gmail reputation monitoring regardless of provider. [VERIFIED]

---

### Option C: Postmark — NOT SELECTED

**What it is:** Premium email delivery with separate transactional and broadcast IP pools. Industry-best documented deliverability: 99%+ claimed delivery rate, 98.7% inbox placement in independent tests, sub-2-second Gmail delivery. [VERIFIED — Postmark; REPORTED — Hackceleration]

**Why not selected:**

1. **Afterset doesn't need premium deliverability insurance.** The engagement profile of fan-capture emails (projected 50–70% open rates) is itself the dominant deliverability signal. When domain reputation is strong and emails are properly authenticated, the provider's IP pool quality produces marginal differences. Postmark's premium is justified for low-engagement transactional emails where IP reputation matters more — not for high-intent triggered emails. [INFERRED]

2. **Highest cost at every volume.** $18/month at launch (comparable), $78/month at traction (2.7× Resend), $366/month at growth (1.4× Resend, 12× SES). No cost advantage at any scale point. [VERIFIED]

3. **Classification risk.** Postmark's transactional/broadcast classification creates real enforcement risk. Afterset's follow-up email is triggered by user action (transactional trait) but contains download links and promotional content (commercial trait). Postmark has documented zero-tolerance enforcement — accounts shut down without warning, taking down auth emails alongside the offending stream. [VERIFIED — Postmark policies; REPORTED — Trustpilot reviews]

4. **No unique multi-tenant advantage.** Domains API supports programmatic management (same as Resend). Unlimited domains on all plans is slightly better than Resend's tiered limits, but not enough to offset the cost and classification risk. [VERIFIED]

---

## The Architecture That Makes This Work

### Domain strategy: shared launch, custom migration

Research revealed that the domain strategy decision is more consequential than the provider choice. Domain reputation — not provider IP pools — now drives deliverability at Gmail, Yahoo, and Outlook. [VERIFIED — multiple ESP documentation]

**Shared domain (`send.afterset.com`) at launch:** Zero artist friction. Proper SPF, DKIM, DMARC from day one. Cross-tenant contamination is manageable at <50 artists with high-intent emails and per-artist complaint monitoring. Warm-up schedule: 50–100 emails/day, increasing 25–50% every few days over 2–4 weeks. [REPORTED — industry guidance]

**Optional custom domains at ~200 artists:** Guided DNS setup flow — artist enters domain → Resend Domains API provisions DKIM records → artist adds DNS CNAMEs + DMARC TXT → automated verification polling. Follow Beehiiv's pattern: gradually warm new custom domains over 4–8 weeks. Custom domains fully isolate each artist's reputation. [VERIFIED — Resend Domains API docs]

**Default custom domains at ~1,000 artists:** Any artist sending >500 emails/month should have their own authenticated domain. The shared domain continues as fallback for artists without custom domains, but with increasingly strict per-artist monitoring and auto-pause thresholds. [INFERRED]

### Email validation at capture

The single highest-impact deliverability measure. Fans entering emails on phones in noisy, dark venues produce typos ("gmial.com," transposed characters, missing TLDs). Every hard bounce from an invalid address directly damages sender reputation. The capture form must validate in real time: common domain typo correction ("Did you mean gmail.com?"), MX record lookup, and format validation. This is a build requirement for Sprint 1 — before the first fan email is ever sent. [INFERRED]

### Provider abstraction layer

All email sending goes through an `EmailService` interface from day one:

```typescript
interface EmailService {
  send(params: SendParams): Promise<SendResult>
  sendBatch(params: SendParams[]): Promise<SendResult[]>
  addDomain(domain: string): Promise<DomainSetup>
  verifyDomain(domainId: string): Promise<DomainStatus>
  removeDomain(domainId: string): Promise<void>
}
```

The Resend implementation is the only one built at launch. The SES implementation is built when monthly email costs exceed ~$300–500/month (estimated at 300K–500K emails/month). The abstraction costs minimal additional effort at launch and limits the SES migration blast radius to a single module. [INFERRED]

### Compliance architecture (build before first email)

**CAN-SPAM (all fan emails are commercial):**
- Physical postal address in every email footer (Afterset's PO box)
- Clear unsubscribe mechanism in every email
- Honest From/subject information
- Both Afterset and the artist are potentially liable [VERIFIED — FTC.gov]

**GDPR (any EU/EEA fan, regardless of show location):**
- Explicit consent language on capture form: "I agree to receive one follow-up email from [Artist] with [described content]"
- Consent record storage: timestamp, IP address, consent text version, venue/show context
- Right to deletion pipeline through Supabase, Resend logs, and backups [VERIFIED — GDPR Art. 3, Art. 7]

**One-click unsubscribe (RFC 8058, required by Gmail/Yahoo since June 2024):**
- Inject `List-Unsubscribe` and `List-Unsubscribe-Post` headers on every fan email
- Build POST endpoint that processes unsubscribes within 48 hours
- Scope per artist — unsubscribing from Artist A does not affect Artist B [VERIFIED]

**Application-level suppression list:**
- Keyed by (email, artist_id) in Supabase Postgres
- Checked before every send, regardless of provider's own suppression
- Enables multi-tenant isolation and provider portability [INFERRED]

---

## Upgrade Path

| Phase | Provider | Domain strategy | Monthly cost | Cost/artist |
|---|---|---|---|---|
| Launch (50 artists) | Resend Pro | Shared `send.afterset.com` | ~$20 | $0.40 |
| Traction (200+ artists) | Resend Pro/Scale | Shared + optional custom | ~$29–90 | $0.15–0.45 |
| Growth (1,000 artists) | Resend Scale + dedicated IP | Custom default, shared fallback | ~$300 | $0.30 |
| Scale (10,000 artists) | SES primary + Resend for auth | Custom mandatory (high volume) | ~$525 | ~$0.05 |

---

## Consequences

### Positive

- Fan follow-up emails sending on day one of Sprint 2 with minimal setup.
- Supabase Auth SMTP configured in under an hour using Resend's documented integration.
- React Email enables building templates as components within the existing Next.js codebase.
- Batch API (100 emails/call at 2 calls/sec) handles post-gig burst sends trivially.
- Programmatic Domains API enables automated custom domain onboarding at traction phase.
- Cost stays under $0.45/artist/month through 10,000 artists — well within margin on $12–25/mo pricing.
- Provider abstraction layer protects against lock-in and enables the SES cost-optimization migration.
- Entertainment/music email engagement profile provides a structural deliverability tailwind.

### Negative

- Resend is ~3 years old with meaningful incident history. A multi-hour outage means fans don't get follow-ups and artists don't get magic link logins.
- No automatic List-Unsubscribe headers — Afterset must build the RFC 8058 endpoint and inject headers manually.
- Enterprise pricing for 3M+ emails/month is negotiated, not published — cost uncertainty at the scale phase.
- Shared sending domain at launch means one artist's spam complaints can degrade deliverability for all artists. Per-artist monitoring and auto-pause mitigates this but doesn't eliminate it.
- Resend reportedly runs on SES under the hood — at the scale phase, Afterset would be paying a markup for a layer it no longer needs.

### Mitigations

1. **Email validation at capture (Sprint 1).** Common domain typo correction + format validation on the capture form. This is the single highest-impact deliverability measure — prevents the hard bounces that actually damage reputation. Non-negotiable before the first fan email sends.

2. **Per-artist complaint monitoring (Sprint 2).** Track bounce rate and spam complaint rate per artist. Auto-pause sending for any artist exceeding 0.1% complaint rate or 5% bounce rate. Surface alerts on the artist dashboard. Protects the shared domain during the launch phase.

3. **Google Postmaster Tools from day one.** Register `send.afterset.com` and monitor domain reputation, spam rate, and authentication pass rates. This is the only way to see Gmail-specific deliverability — neither Resend nor SES provide Gmail complaint data directly.

4. **Provider abstraction from day one.** The `EmailService` interface adds <1 hour of effort at launch and limits the SES migration to a single module swap. Build it before writing the first `resend.emails.send()` call.

5. **Warm-up the shared domain gradually.** Start at 50–100 emails/day, increase 25–50% every few days over 2–4 weeks. Do not onboard 50 artists simultaneously on day one — stagger invitations to match warm-up capacity.

---

## Revisit When

- **Resend has a >4-hour outage affecting fan emails.** Evaluate adding SES as a hot fallback (not just the planned scale migration). The abstraction layer makes this a configuration change.
- **Shared domain complaint rate exceeds 0.05%.** Accelerate the custom domain migration timeline. Consider making custom domains required for Pro tier, not optional.
- **Monthly email cost exceeds $300.** Begin SES migration planning. The crossover point where SES operational investment pays for itself is ~$300–500/month in Resend costs.
- **Resend's Enterprise pricing exceeds $2,000/month at the negotiation stage.** SES at $300/month for the same volume makes the engineering investment obvious.
- **Gmail Postmaster Tools shows domain reputation degradation.** Investigate which artists are causing it (per-artist monitoring), pause offending artists, and accelerate custom domain migration.
- **v1.5 adds multi-email sequences or marketing broadcasts.** Re-evaluate whether Resend's pricing model (per-email overage) or SES's flat rate is more appropriate for higher-volume, lower-engagement marketing emails. The structural deliverability tailwind weakens for marketing sends vs. triggered follow-ups.

---

## Validation Tasks Before Committing

These should be completed during the Pre-Build Phase (Day 3 of the build roadmap, alongside ADR-001 validation):

1. **[ ] Configure Resend Pro account.** Create account, add `send.afterset.com` domain, verify DKIM/SPF/DMARC records. Confirm DNS propagation.
2. **[ ] Configure Supabase Auth SMTP.** Add Resend SMTP credentials to Supabase Auth dashboard. Send a test magic link. Verify delivery in <30 seconds.
3. **[ ] Test batch API throughput.** Send 200 emails via the batch API endpoint. Measure: p99 latency, error rate, any 429 responses. Pass criteria: all 200 delivered with <2s total API time.
4. **[ ] Test webhook delivery.** Configure `email.bounced` and `email.complained` webhooks. Send to a known-invalid address. Verify webhook fires within 60 seconds.
5. **[ ] Register Google Postmaster Tools.** Verify `send.afterset.com` ownership. Confirm data starts populating after test sends.
6. **[ ] Verify Resend suppression list behavior.** Send to an address that hard-bounces. Attempt to send again. Confirm Resend blocks the second send automatically.

---

## Research Sources

Full research document: `email-research-results.md`

Key confidence levels on critical claims:
- Resend pricing and rate limits: **VERIFIED** (resend.com/pricing, docs)
- SES pricing and multi-tenant features: **VERIFIED** (AWS docs)
- Postmark pricing and classification policies: **VERIFIED** (postmarkapp.com)
- Entertainment/music email engagement benchmarks: **VERIFIED** (Mailchimp, MailerLite, GetResponse)
- Afterset projected open rates (50–70%): **INFERRED** (from triggered email benchmarks)
- Resend incident history (69 incidents): **VERIFIED** (IsDown, Resend status page)
- Gmail Promotions tab impact (~0.5–2% open rate reduction): **REPORTED** (SortedIQ, ActiveCampaign)
- SES Enterprise pricing estimate ($1,500–2,500): **INFERRED** (from overage rates)
- Domain reputation dominates provider IP reputation for deliverability: **VERIFIED** (Postmark guide, multiple ESP docs)
- CAN-SPAM dual liability (platform + artist): **VERIFIED** (FTC.gov)
- GDPR applicability to EU fans at US shows: **VERIFIED** (GDPR Art. 3)
- One-click unsubscribe enforcement (June 2024): **VERIFIED** (Gmail/Yahoo sender requirements)
