# The right email infrastructure for Afterset's fan follow-up emails

**The provider choice matters far less than the domain strategy and capture-time hygiene.** Resend, SES, and Postmark all deliver comparable inbox placement when properly authenticated — because domain reputation, not provider IP pools, now drives deliverability at Gmail, Yahoo, and Outlook. The real architectural decision is how Afterset handles multi-tenant sending domains, and the real operational risk is fans entering bad email addresses at loud, dark live shows. Entertainment/music emails already enjoy the highest engagement rates and lowest spam complaint rates of any email category, so Afterset starts with a structural tailwind. Resend is the right launch provider — it offers first-class Supabase SMTP integration, a clean Next.js SDK, programmatic domain management for multi-tenant, and costs that stay under $0.40/artist/month through 10,000 artists. SES becomes the cost-optimization path at scale; Postmark is unnecessary insurance given the workload's engagement profile.

---

## 1. The multi-tenant sending problem

Afterset faces a classic platform email dilemma: fans should feel they're hearing from the artist, not from a SaaS company. This means the "From" address, DKIM signature, and reply-to must all reinforce the artist's identity. The two paths — shared sending domain versus per-artist custom domains — carry different reputation, complexity, and deliverability profiles.

**Shared domain model** (`"Artist Name" <artistname@send.afterset.com>`) pools all sending reputation under one domain. Setup is instant — artists do nothing. But cross-tenant contamination is a documented, severe risk: if one artist's emails hit spam traps or generate complaints, **deliverability degrades for every artist on the domain**. AWS built an entire tenant isolation feature for SES specifically to address this pattern. At under 50 artists with high-intent fan-capture emails, this risk is manageable. Beyond 200–500 artists, one bad actor can crater inbox placement for the entire platform within days. [VERIFIED — AWS SES documentation, MailChannels]

**Custom domain model** (`"Artist Name" <hello@bandname.com>`) isolates each artist's reputation completely. Gmail evaluates the DKIM-signing domain independently, so one artist's spam complaints never affect another's. The tradeoff is onboarding friction: artists must own a domain and add 2–4 DNS records (DKIM CNAMEs, DMARC TXT). Many gigging musicians simply don't own custom domains. [VERIFIED — multiple ESP documentation]

The creator-economy platforms have converged on a clear pattern that resolves this tension. **Kit (ConvertKit)**, **Beehiiv**, **Buttondown**, and **Mailchimp** all offer custom sending domains on every plan tier — including free — pushed by Gmail and Yahoo's February 2024 authentication requirements. [VERIFIED — official docs for each] Buttondown takes the most interesting approach: artists delegate a subdomain's NS records to Buttondown, giving the platform full DNS control to rotate sending infrastructure transparently. Beehiiv automatically warm-up new custom domains over 4–8 weeks. Loops requires custom domain setup from day one with no shared fallback. [VERIFIED]

**The realistic path for Afterset:** Launch on a shared subdomain (`send.afterset.com`) with proper SPF, DKIM, and DMARC — this requires zero artist action and gets emails delivered immediately. Implement per-artist monitoring from day one: track bounce and complaint rates per artist, auto-pause sending for any artist exceeding thresholds. At the traction phase (~200 artists), introduce optional custom domains through a guided DNS setup flow. By 1,000 artists, custom domains should become the default for any artist sending at meaningful volume. The key insight is that Afterset's fan-capture emails are inherently high-intent (fans actively scanned a QR code), making the shared domain safer for longer than in a typical marketing SaaS. [INFERRED]

---

## 2. Resend: the right v1 choice for DX and multi-tenant support

Resend is a developer-focused email API founded in 2023 (YC W23), built by the React Email team, and reportedly running on AWS SES infrastructure under the hood. [REPORTED — multiple developer sources] Its core appeal for Afterset is the tightest integration surface with the existing stack: first-class Next.js SDK, native Supabase SMTP integration with dedicated documentation, React Email for building templates as components, and a clean programmatic domain management API.

**Pricing scales linearly and predictably.** The Pro plan at **$20/month includes 50,000 emails and 10 sending domains**; the Scale plan at **$90/month includes 100,000 emails and 1,000 domains**. Overage on both tiers is $0.90 per 1,000 emails. Dedicated IPs are available on Scale at $30/month with a 500-emails/day minimum. [VERIFIED — resend.com/pricing] At 3 million emails/month, Enterprise pricing is required (Scale's hard cap is 5× the monthly quota). Based on published overage rates and third-party reports, Enterprise negotiation would likely land around **$1,500–2,500/month** — roughly 5–8× SES. [INFERRED]

**Rate limits require planning but are workable.** The default is 2 API requests per second per team, but the batch API accepts 100 emails per call — yielding **effective throughput of 200 emails/second**. After a gig with 200 captured fans, the entire batch clears in one second. Excess requests receive HTTP 429 with retry-after headers; Resend does not queue on your behalf. [VERIFIED — Resend docs]

**The multi-tenant domain story is strong.** Scale's 1,000-domain limit covers Afterset's growth phase completely. The Domains API supports full CRUD operations — create, verify, monitor, and delete domains programmatically — enabling an automated artist onboarding flow. Each domain gets independent DKIM/SPF/DMARC verification with DNS health monitoring alerts. [VERIFIED]

**Webhook infrastructure covers the critical compliance events:** `email.bounced` (hard bounce), `email.delivery_delayed` (soft bounce equivalent), `email.complained` (spam complaint), and `email.suppressed` (blocked by automatic suppression list). Webhooks are signed via Svix with at-least-once delivery and retry up to 10 hours. The automatic suppression list on all plans handles hard bounce and complaint suppression without custom code. [VERIFIED]

**Critical caveats.** Resend does **not** automatically add List-Unsubscribe headers for transactional emails — Afterset must inject these via the API. One-click unsubscribe (RFC 8058) is supported but requires building your own POST endpoint. The platform is young (~3 years) with moderate incident frequency — **69 tracked incidents since February 2024**, including a 3.5-hour outage in February 2026 caused by database connection exhaustion. For mission-critical auth emails, a fallback SMTP provider is advisable. [VERIFIED — IsDown, Resend status page]

---

## 3. Amazon SES: the cost-at-scale escape hatch

SES is the raw sending primitive underneath many email services (likely including Resend itself). It costs **$0.10 per 1,000 emails** flat, with no subscriptions, no minimum fees, and a 3,000-email/month free tier for 12 months. [VERIFIED — AWS pricing] At 300,000 emails/month, SES costs **$30** versus Resend's $270 or Postmark's $366. At 3 million emails/month, SES costs **$300** — roughly one-tenth of the alternatives.

The price advantage comes with an operational tax. New accounts start in sandbox mode (200 emails/day, verified recipients only) and must request production access, typically approved within 24 hours. [VERIFIED] The SDK (`@aws-sdk/client-sesv2`) is functional but verbose — sending a single email requires IAM configuration, region selection, and significantly more boilerplate than Resend's three-line SDK call. Bounce and complaint handling requires wiring SNS topics to webhook endpoints, including handling SNS's subscription confirmation handshake. There is no built-in email dashboard, no message search, and no visual template editor. [VERIFIED]

**Multi-tenant support is SES's hidden strength.** The platform supports up to **10,000 verified identities per region** (expandable to 300,000) with full programmatic domain management. The newer Tenants feature provides per-tenant reputation isolation with automated sending pauses — purpose-built for multi-tenant SaaS. Configuration Sets (up to 10,000) enable per-artist routing through different IP pools and event destinations. [VERIFIED — AWS docs]

**The deliverability story is adequate, not exceptional.** Shared IPs are well-maintained, especially after AWS reduced the free tier from 62,000 to 3,000 in August 2023, deterring spammers. The Virtual Deliverability Manager adds ISP-level insights at $0.07 per 1,000 emails — effectively a **70% cost increase** that's still far cheaper than alternatives. SES notably lacks Gmail complaint data (Gmail doesn't participate in feedback loops with SES directly). Dedicated managed IPs at $15/month plus per-email tiered pricing handle warm-up automatically. [VERIFIED]

**For Afterset**, SES is not the right launch provider — the setup complexity costs weeks of a solo developer's time better spent on product. But it's the correct scale provider. When email costs on Resend exceed ~$300/month, SES delivers identical authenticated emails for one-tenth the price. The migration path is clean: Afterset's email sending interface calls a different provider's API behind the same abstraction. [INFERRED]

---

## 4. Postmark: premium deliverability Afterset doesn't need to pay for

Postmark's unique architecture separates transactional and broadcast email onto **completely independent IP pools**, ensuring marketing sends never contaminate transactional delivery reputation. This separation, combined with aggressive sender vetting (they reject entire accounts for policy violations), produces the industry's best documented deliverability: **99%+ delivery rate** claimed, with independent tests measuring **98.7% inbox placement** and sub-2-second Gmail delivery. [VERIFIED — Postmark; REPORTED — Hackceleration]

**Pricing is the highest of the three providers.** The Platform tier at $18/month includes 10,000 emails with overage at **$1.20 per 1,000** and unlimited domains. At 300,000 emails/month, Postmark costs **~$366/month** — 12× SES and 36% more than Resend. Dedicated IPs are $50/month and require 300,000 emails/month minimum volume. [VERIFIED — postmarkapp.com/pricing]

**The transactional/broadcast classification creates real risk for Afterset.** Postmark's policies define transactional email as "triggered by user action, delivering content a user requested." Afterset's fan follow-up email fits multiple transactional criteria — triggered by QR scan, one-to-one, delivers requested download link. However, if the email includes promotional content beyond the download (merch discounts, social follows, future gig announcements), Postmark could reclassify it. Postmark has shown **zero-tolerance enforcement** — accounts shut down without warning for perceived violations, taking down transactional auth emails alongside the offending stream. [VERIFIED — Postmark policies; REPORTED — Trustpilot reviews]

The Supabase integration is excellent (official partner with dedicated guide), the Node.js SDK is mature, and the batch API handles 500 messages per call. The Domains API supports full programmatic management. Webhook support is comprehensive with custom metadata passthrough — useful for correlating events to specific fans and gigs. [VERIFIED]

**For Afterset's specific workload — high-intent, single follow-up emails to fans who just opted in — Postmark's deliverability premium is unlikely to produce measurably better inbox placement than Resend.** Both use properly authenticated sending with strict abuse policies on shared IP pools. The engagement profile of Afterset's emails (expected **50–70% open rates** based on triggered email benchmarks [INFERRED]) will itself be the strongest deliverability signal to Gmail's algorithms. Paying 36% more for Postmark's IP reputation advantage is hard to justify when domain reputation dominates inbox placement decisions.

---

## 5. Deliverability for entertainment and music emails

This is the section that should give Afterset's founder confidence. **Entertainment and music emails consistently outperform every other email category** on the metrics that matter for deliverability. Mailchimp's benchmark data shows music and musicians at **21.88% open rate** for marketing emails, with MailerLite reporting **38.98%** across 3.6 million campaigns. Click-through rates for media and entertainment are the **highest of any industry at 4.48–4.62%**, roughly double the all-industry average. Most critically, spam complaint rates for media and entertainment sit at **0.005%** — well below Gmail's 0.1% recommended threshold and 0.3% enforcement threshold. [VERIFIED — Mailchimp, MailerLite, GetResponse benchmark data]

Afterset's emails have an even stronger engagement profile than typical music marketing because they are **triggered by an explicit user action** (QR scan + email entry at a live show). GetResponse data shows triggered/behavioral emails average **45.38% open rate**, and welcome emails — the closest analog — average **83.63%**. A reasonable projection for Afterset's fan follow-up emails is **50–70% open rates** in the first hour. [VERIFIED — GetResponse; INFERRED for Afterset]

**Gmail's Promotions tab is virtually certain and largely irrelevant.** The follow-up email contains download links, promotional content, and comes from an automated system — Gmail's ML classifier will route it to Promotions for users with tabbed inbox enabled. But only ~20% of Gmail users still use tabs, and even among those who do, the open rate difference between Primary and Promotions is roughly **12% relative** (22% vs 19.2%). Net impact on Afterset's total open rate: approximately **0.5–2 percentage points**. Gmail's September 2025 change to sort Promotions by "most relevant" rather than chronological actually benefits high-engagement senders. [REPORTED — SortedIQ, ActiveCampaign, ZeroBounce]

**Does the sending provider make a meaningful deliverability difference?** When Resend, SES, and Postmark all use proper DKIM, SPF, and DMARC authentication, the provider's contribution to deliverability narrows to shared IP pool quality. Domain reputation is now the **primary signal** — it's portable across providers and persists independently of IP addresses. Postmark's strict vetting keeps their shared pool cleaner, but at Afterset's engagement rates, the difference is marginal. Dedicated IPs become relevant above **100,000 emails/month** for transactional email; below that threshold, well-maintained shared pools from any reputable provider perform comparably. [VERIFIED — Postmark deliverability guide; REPORTED — Mailtrap comparison study]

### What Afterset must enforce to protect deliverability

The single highest-impact measure is **real-time email validation at capture**. Fans entering emails on phones in noisy, dimly lit venues will produce typos — "gmial.com," transposed characters, missing TLDs. Every hard bounce from an invalid address directly damages sender reputation. An email verification API (ZeroBounce, Mailcheck, or similar) should catch common domain typos at the form level before submission, presenting "Did you mean gmail.com?" corrections. [INFERRED]

Beyond validation, Afterset should enforce content guidelines on artist templates: maintain a **text-heavy ratio** (minimum 60/40 text-to-image), include plain-text versions alongside HTML, limit links to 2–3 maximum using full domain URLs (never shorteners), and use conversational subject lines referencing the specific show ("Your track from tonight's set at The Roxy") rather than spam triggers ("FREE Download! Exclusive Content Inside!!!"). [REPORTED — multiple deliverability sources]

For the shared sending domain, **warm-up is essential**: start at 50–100 emails/day and increase by 25–50% every few days over 2–4 weeks. Shared IPs from Resend are pre-warmed, but the sending domain itself must build reputation gradually. Register with Google Postmaster Tools from day one to monitor domain reputation and spam rates in real time. [REPORTED — industry guidance]

---

## 6. Compliance architecture

### CAN-SPAM and the multi-tenant liability question

**Both Afterset and the artist are potentially liable** under CAN-SPAM. The FTC explicitly states that "more than one person may be held responsible" — the entity whose product is promoted (artist) and the entity that originates the message (Afterset). [VERIFIED — FTC.gov] Every fan-facing email must contain: a **valid physical postal address** (Afterset's PO box or registered virtual mailbox satisfies this), a **clear opt-out mechanism**, and **honest header/subject information**. CAN-SPAM is opt-out — it does not require prior consent — so QR scan plus email entry is more than sufficient for US compliance. [VERIFIED]

Afterset's follow-up email is **commercial under CAN-SPAM** despite the transactional trigger. The "primary purpose" test asks whether a reasonable recipient interpreting the subject line would conclude the message is promotional. Emails containing download links, discount codes, and exclusive content are commercial. Conservative approach: treat all fan emails as commercial and include all required elements by default. [VERIFIED — 16 CFR Part 316]

### GDPR consent and international fans

GDPR applies to any EU/EEA resident's data regardless of where Afterset operates — a European tourist scanning a QR at a US show triggers GDPR obligations. [VERIFIED — GDPR Art. 3] Unlike CAN-SPAM, GDPR requires **explicit consent before sending**. The QR capture form must include clear consent language: "I agree to receive one follow-up email from [Artist] with [described content]." Store the consent record including **timestamp, IP address, consent text version, and collection context** (venue, show date). [VERIFIED — GDPR Art. 7]

All three providers offer Data Processing Agreements: SES includes it automatically in AWS Service Terms, Resend provides a signed DPA with EU-US Data Privacy Framework certification, and Postmark offers an executable DPA online. Only SES offers EU data residency (Ireland, Frankfurt, and five other EU regions); Resend and Postmark store data exclusively in the US, relying on Standard Contractual Clauses for lawful transfer. [VERIFIED]

### Bounce, complaint, and unsubscribe handling

All three providers automatically suppress hard bounces and spam complaints — this is the baseline expectation. Resend and SES maintain account-level suppression lists; Postmark uses per-server (per-stream) suppression with automatic deactivation. **Afterset should maintain its own application-level suppression list** keyed by (email + artist_id) regardless of provider, enabling multi-tenant isolation and provider portability. [VERIFIED]

Google's enforcement threshold is **0.3% spam complaint rate** with a recommended target below 0.1%. SES triggers account review at 0.1% and potential suspension at 0.5%. Postmark investigates any complaints given their transactional focus. Gmail notably does not provide complaint feedback to SES directly — a gap that makes Google Postmaster Tools essential for monitoring. [VERIFIED]

**One-click unsubscribe (RFC 8058)** is required by Gmail and Yahoo for bulk senders since June 2024, now in full enforcement. Afterset must add `List-Unsubscribe` and `List-Unsubscribe-Post` headers to every email and build a POST endpoint that processes unsubscribes within 48 hours. Resend and SES require manual header injection; Postmark handles this automatically on Broadcast streams only. Per Google's FAQ, one-click unsubscribe is per-list — unsubscribing from Artist A does not affect Artist B — which aligns naturally with Afterset's multi-tenant model. [VERIFIED]

- **Afterset must build**: consent collection form, consent record storage, unsubscribe endpoint (RFC 8058), List-Unsubscribe header injection, application-level suppression list, physical address in templates, GDPR deletion pipeline, per-artist complaint monitoring
- **Providers handle**: bounce suppression, complaint suppression, DKIM/SPF setup guidance, DPAs, webhook delivery for events
- **Launch-critical (build before first email)**: consent form with GDPR language, email template with physical address and unsubscribe link, webhook handler for bounces/complaints, List-Unsubscribe headers on every send

---

## 7. Cost comparison

| | **Resend** | **Amazon SES** | **Postmark (Platform)** |
|---|---|---|---|
| **5,000/mo** (50 artists) | $20 (Pro) | ~$0.50 | $18 (min 10K plan) |
| **60,000/mo** (200 artists) | $29 (Pro + 10K overage) | ~$6 | $78 |
| **300,000/mo** (1,000 artists) | $270 (Scale + 200K overage) | ~$30 | ~$366 |
| **3,000,000/mo** (10,000 artists) | ~$2,500 (Enterprise est.) | ~$300 | ~$3,600 (est., contact sales) |
| **Dedicated IP** | $30/mo (Scale+) | $24.95/mo standard | $50/mo (300K+ required) |
| **Custom domain cost** | Included | Included | Included |

**Cost per artist** — the metric that determines margin viability:

| Phase | Artists | Resend/artist | SES/artist | Postmark/artist |
|---|---|---|---|---|
| Launch | 50 | **$0.40** | $0.01 | $0.36 |
| Traction | 200 | **$0.15** | $0.03 | $0.39 |
| Growth | 1,000 | **$0.27** | $0.03 | $0.37 |
| Scale | 10,000 | **~$0.25** | $0.03 | ~$0.36 |

All three providers stay **well under $1/artist/month** at every phase. [VERIFIED pricing; INFERRED Enterprise/high-volume estimates] Resend's cost-per-artist actually decreases at the traction phase as the $20 base is spread across more artists, then stabilizes as overage volume drives cost. SES is 10× cheaper at every scale point but carries the operational overhead tax. Postmark is consistently the most expensive with no cost advantage at any volume.

**The decision-relevant cost gap:** At 300,000 emails/month, Resend costs **$240/month more than SES**. That's $240/month to avoid building SNS webhook infrastructure, IAM configuration, email logging, and bounce-handling pipelines — a bargain for a solo developer. The crossover point where SES becomes worth the operational investment is approximately **500,000–1,000,000 emails/month**, where Resend's overage pricing drives monthly costs above $500. [INFERRED]

---

## 8. The recommended architecture and upgrade path

### Launch (months 1–2, 50 artists, ~5,000 emails/month)

**Provider: Resend Pro ($20/month).** This covers 50,000 emails, 10 sending domains, SMTP for Supabase Auth, and the entire fan follow-up workflow. Send fan emails via the Resend SDK from Next.js API routes using the batch API for post-gig bursts. Use a shared sending domain (`send.afterset.com`) with Afterset's own DKIM, SPF, and DMARC records. Configure webhooks for `email.bounced`, `email.complained`, and `email.delivered` — write a handler that updates an application-level suppression table in Supabase Postgres.

Build email templates with React Email. Inject `List-Unsubscribe` and `List-Unsubscribe-Post` headers on every fan email. Include Afterset's PO box address in the footer. Implement real-time email validation on the capture form. Register for Google Postmaster Tools. **Total email cost: $20/month. Cost per artist: $0.40.** [VERIFIED pricing]

### Traction (month 6, 200+ artists, ~60,000 emails/month)

**Provider: Resend Pro ($29/month with overage) or upgrade to Scale ($90/month).** The decision point is the number of artist custom domains — if more than 10 artists want custom domains, Scale's 1,000-domain limit is necessary. Introduce optional custom domain onboarding: artist enters domain → Afterset's API calls Resend's Domains API to provision DKIM records → artist adds DNS records → automated verification polling. Follow Beehiiv's smart warming pattern: gradually increase sends on new custom domains over 4–8 weeks. Implement per-artist bounce/complaint rate monitoring with automated sending pauses above thresholds. **Total email cost: $29–90/month. Cost per artist: $0.15–0.45.** [VERIFIED]

### Growth (year 1, 1,000 artists, ~300,000 emails/month)

**Provider: Resend Scale ($270/month).** Add a dedicated IP ($30/month) to isolate Afterset's sending reputation from Resend's shared pool. At this scale, consider adding SES as a **fallback provider** for reliability — a second sending path that activates if Resend experiences an outage (they had two multi-hour outages in the past six months [VERIFIED]). Build the email-sending abstraction layer now if not already in place: an `EmailService` interface that accepts a message payload and routes to the configured provider. This protects against lock-in and enables the SES migration at scale. Push custom domains harder — any artist sending more than 500 emails/month should have their own authenticated domain. **Total email cost: ~$300/month. Cost per artist: $0.30.** [INFERRED]

### Scale (year 2+, 10,000 artists, ~3,000,000 emails/month)

**Primary provider: Amazon SES (~$300/month) for fan emails. Resend retained for Supabase Auth SMTP and as a reliability fallback.** The $2,200/month savings versus Resend Enterprise justifies the engineering investment to build SES integration — SNS webhook processing, CloudWatch monitoring, and the SES Tenants feature for per-artist reputation isolation. Use SES Managed Dedicated IPs ($15/month + per-email tiered pricing) with automatic warm-up and ISP-level throttling. Custom domains should be mandatory for artists above a volume threshold. Enable SES Virtual Deliverability Manager ($0.07/1K, ~$210/month) for ISP-level insights. **Total email cost: ~$525/month (SES + VDM + Resend for auth). Cost per artist: ~$0.05.** [VERIFIED pricing; INFERRED architecture]

### What Afterset must build versus delegate

Regardless of provider, Afterset needs to build and own these components:

- **Capture-time email validation** — typo detection, domain verification, MX lookup
- **Application-level suppression list** — (email, artist_id) keyed, checked before every send
- **Unsubscribe endpoint** — RFC 8058 POST handler + web fallback, per-artist scoping
- **Consent record storage** — timestamp, IP, consent text version, venue/show context
- **GDPR deletion pipeline** — cascade through Supabase, email provider logs, backups
- **Per-artist compliance template** — physical address, unsubscribe link, artist identity in every email
- **Provider abstraction layer** — interface wrapping send, batch, domain CRUD operations

---

## Conclusion

Afterset's email infrastructure decision is simpler than it appears. **Resend is the clear launch provider** — not because it has the best deliverability (the difference between properly authenticated providers is marginal) but because it offers the fastest path to production for a solo developer on the Next.js/Supabase stack. The Pro plan at $20/month covers the first six months. The Scale plan at $90/month covers the first year. SES waits in reserve as the cost-optimization play when volume justifies the engineering investment.

The harder, more consequential decisions are architectural: implementing email validation at capture to prevent the bounce-rate damage that actually kills deliverability; building per-artist complaint monitoring to protect the shared domain; and shipping the provider abstraction layer early enough that the SES migration at scale is a configuration change, not a rewrite. **Domain reputation, not provider reputation, determines whether Afterset's emails reach fans' inboxes.** Invest engineering time accordingly.