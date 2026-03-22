# SMS text-to-join infrastructure for Afterset

**Start with a single verified toll-free number on Telnyx or Twilio — it is the fastest, cheapest, and most multi-tenant-friendly path to launch.** Toll-free numbers avoid the 10DLC per-artist brand registration problem entirely, verify in days rather than weeks, cost under $3/month at low volume, and deliver sufficient throughput (3–30 MPS) for concert-scale bursts. The FCC's 2015 RILA ruling explicitly exempts Afterset's single auto-reply pattern from TCPA consent requirements, provided the reply contains only the requested URL and no marketing copy. Shared short codes — once the ideal multi-tenant keyword model — were deprecated by all US carriers in 2021–2023, which fundamentally shapes the architecture decision.

---

## Number types compared: toll-free wins for multi-tenant launch

The four US number types each carry distinct cost, throughput, and compliance tradeoffs. The most important finding for Afterset's multi-tenant model: **shared short codes no longer exist**, and **10DLC registration scales linearly per artist**, making toll-free the clear default.

| Factor | Dedicated Short Code | Toll-Free (8XX) | 10DLC Long Code | Shared Short Code |
|---|---|---|---|---|
| **Status** | Available | Available | Available | **Deprecated** [VERIFIED] |
| **Monthly lease** | $500–$1,500 [VERIFIED] | $1–$2.15 [VERIFIED] | ~$1–$1.15 [VERIFIED] | N/A |
| **Per-msg cost (out, base)** | $0.004–$0.008 + carrier | $0.004–$0.0083 + carrier | $0.004–$0.0083 + carrier | N/A |
| **Carrier surcharges** | $0.003–$0.0045 + **$0.02 FTEU** | $0.003–$0.0045 | $0.003–$0.005 | N/A |
| **Throughput (MPS)** | 100+ [VERIFIED] | 3–30 default, 150+ via sales [VERIFIED] | 0.2–75 (trust-score dependent) [VERIFIED] | N/A |
| **Setup time** | 6–10 weeks [VERIFIED] | Minutes + 3–15 days verification [VERIFIED] | Minutes + 1–7 days registration [VERIFIED] | N/A |
| **Keyword routing** | Native at carrier level | App-level (webhook) | App-level (webhook) | N/A |
| **Multi-tenant fit** | ⭐ Best but expensive | ⭐ Best cost/complexity ratio | ⚠️ Per-artist brand reg required | N/A |
| **Registration** | Carrier application | Toll-free verification (free) | TCR brand + campaign ($4.50 + $15 + $10/mo) | N/A |

**Dedicated short codes** carry an overlooked cost: the **FTEU (Free to End User) surcharge** of $0.02/outbound segment from AT&T, T-Mobile, and Verizon applies when the end user isn't charged to receive the message — which describes Afterset's flow exactly [VERIFIED — Twilio carrier fees page]. At 100K outbound messages, that surcharge alone costs **$1,200/month** on top of the $1,000 lease and per-message base rates.

**10DLC's multi-tenant problem** is structural: each artist who is a separate business entity technically needs their own brand registration ($4.50 one-time + $15 campaign vetting + $10/month campaign fee). At 100 artists, that's $1,950 one-time plus $1,000/month recurring — before sending a single message. Most gigging musicians lack EINs, forcing them into sole proprietor registration, which caps throughput at **1 MPS and 1,000 T-Mobile messages/day** [VERIFIED — Twilio 10DLC docs]. Registering Afterset as a single brand with a platform-level campaign is possible but carries carrier-approval risk, and T-Mobile's daily cap would be shared across all artists.

**Toll-free numbers** sidestep all of this: no TCR registration, no per-artist brand fees, free verification through most providers, and **3–30 MPS default throughput** that handles concert-scale bursts well. The trade-off is that toll-free prefixes (833, 844, etc.) feel less personal than a local area code, and throughput caps below short codes.

---

## Provider deep-dives with tiered cost projections

### Twilio

Twilio's per-segment base rate is **$0.0079** (recently listed as $0.0083 on their pricing page — carrier surcharges are additive) for all US number types [VERIFIED — twilio.com/en-us/sms/pricing/us]. Carrier surcharges average approximately $0.0037/outbound and $0.002/inbound, blended across AT&T, T-Mobile, and Verizon.

Twilio discontinued shared short codes and now requires dedicated short codes ($1,000/month random, $1,500/month vanity) [VERIFIED]. Toll-free verification is **free and takes 3–5 business days** [VERIFIED]. For 10DLC, Twilio passes through all TCR fees at cost with no markup [VERIFIED].

**Keyword routing**: Twilio has no native keyword-based auto-reply configuration. Implementation requires either webhooks (return TwiML), Twilio Functions (serverless Node.js at $0.0001/invocation), or Studio flows ($0.0025/execution) [VERIFIED]. The Node.js SDK is mature, TypeScript-supported, and the webhook-to-TwiML reply pattern takes roughly **15 lines of code** [VERIFIED].

**Throughput**: Toll-free delivers 3 MPS default, scalable to 150+ MPS via sales. Short codes deliver 100+ MPS. 10DLC varies from 0.2 MPS (sole proprietor) to 180 MPS (high trust score) [VERIFIED]. Studio rate-limits at 100 new inbound executions/second/account [VERIFIED].

### Vonage (Nexmo)

Vonage's pricing transparency is poor — the public pricing page returns 403 errors and directs to sales [VERIFIED]. Reported base rates: ~$0.0079/segment outbound, ~€0.0057 (~$0.0063) inbound [REPORTED — Vonage support articles]. Carrier surcharges are additive (T-Mobile $0.003 send+receive, AT&T $0.0025 send, Verizon $0.004 send) [VERIFIED — Vonage support].

Vonage supports 10DLC, toll-free, and dedicated short codes. No keyword filtering or auto-reply exists natively — all inbound messages forward to webhooks [VERIFIED — Vonage support: "We don't do keyword filtering on inbound messages"]. The Node.js SDK (`@vonage/server-sdk`) offers two APIs: legacy SMS API and newer Messages API. Using both simultaneously is not supported, which adds integration complexity [VERIFIED].

Toll-free throughput is **up to 50 MPS** (higher than Twilio's default 3 MPS) [VERIFIED — Vonage support]. 10DLC registered throughput reaches 30–75 MPS depending on trust score [REPORTED]. Vonage experienced a significant SMS outage in 2024 [REPORTED].

### Telnyx

Telnyx is the **lowest-cost option at every volume tier**. Base SMS rate is **$0.004/segment** for 10DLC and **$0.0055/segment** for toll-free [VERIFIED — telnyx.com/pricing/messaging]. Carrier surcharges are identical to other providers (they're carrier pass-throughs). Number lease: $1.00/month + $0.10 SMS capability add-on = **$1.10/month** for local or toll-free [VERIFIED — telnyx.com/pricing/numbers].

**Mission Control keyword auto-reply**: Telnyx offers "Advanced Opt-in/Opt-out" configuration via API and portal, allowing custom keywords with static auto-responses per messaging profile [VERIFIED — Telnyx developer docs]. However, this system is designed for compliance keywords (STOP, HELP, START) — responses are static strings with no dynamic URL generation or conditional logic [VERIFIED]. **It cannot replace webhook-based keyword routing for Afterset's text-to-join flow** [INFERRED]. Telnyx does automatically handle STOP/HELP compliance keywords, saving implementation effort.

Telnyx owns its own carrier-grade IP network, which may reduce delivery latency by eliminating aggregator hops [VERIFIED]. Short codes cost $1,000/month (random) or $2,000/month (vanity) [VERIFIED]. The Node.js SDK is modern with a single unified API (unlike Vonage's dual-API situation).

### Bandwidth

Bandwidth is a **Tier 1 US carrier** — it owns the underlying network infrastructure rather than reselling through aggregators [VERIFIED]. This yields the lowest base rates: **$0.004/segment for 10DLC outbound** and **$0.0075 for toll-free outbound** [VERIFIED — bandwidth.com/pricing]. Inbound SMS is included in base pricing [REPORTED]. Carrier surcharges are passed through at cost.

The Tier 1 advantage means fewer network hops, potentially **100–500ms lower latency** than aggregator providers [INFERRED]. Major platforms (Zoom, Microsoft Teams, Google) use Bandwidth as their underlying carrier [VERIFIED]. Short codes are $500/month (random) or $1,000/month (vanity) [VERIFIED].

The trade-off: Bandwidth's Node.js SDK is less polished than Twilio's, documentation is less extensive, and **international SMS support is limited to US and Canada** [VERIFIED]. No native keyword routing — webhook-based implementation required, same as all providers.

### Tiered cost comparison (toll-free number)

All costs include number lease, base message fees, and estimated blended carrier surcharges. 10DLC campaign fees excluded since toll-free is recommended.

| Tier | Twilio | Vonage | Telnyx | Bandwidth |
|---|---|---|---|---|
| **100 msg/mo** (50 in + 50 out) | **~$3.30** | ~$3.40 | **~$2.35** | ~$3.10 |
| **1,000 msg/mo** (500+500) | **~$13.30** | ~$14.85 | **~$8.60** | ~$13.00 |
| **10,000 msg/mo** (5K+5K) | **~$114** | ~$99.50 | **~$73.60** | ~$112 |
| **200,000 msg/mo** (100K+100K) | **~$2,232** | ~$1,781 | **~$1,261** | ~$2,202 |
| **One-time setup** | $0 (TF verification free) | $0 | $0 | $0 |

[INFERRED — calculated from verified per-segment rates and carrier surcharge estimates]

| Tier | Twilio (10DLC) | Telnyx (10DLC) | Bandwidth (10DLC) |
|---|---|---|---|
| **100 msg/mo** | ~$4.30 | ~$3.23 | ~$11.75* |
| **1,000 msg/mo** | ~$14.45 | ~$17.35 | ~$18.50* |
| **10,000 msg/mo** | ~$116 | ~$73.60 | ~$86 |
| **200,000 msg/mo** | ~$2,271 | ~$1,261 | ~$1,511 |
| **One-time setup** | $19.50–$61 | $19.50 | ~$19.50 |

*Bandwidth 10DLC includes the $10/month campaign MRC which dominates at low volume.

**Telnyx delivers ~30–45% savings over Twilio at every tier.** Bandwidth is competitive at scale due to Tier 1 economics but its $10/month campaign MRC hurts at low volume. Vonage is competitive at scale but pricing opacity is a red flag for a startup needing predictable costs.

---

## 10DLC registration: costs, timelines, and the multi-tenant trap

### Fee structure (as of August 2025)

| Fee | Amount | Frequency | Notes |
|---|---|---|---|
| **CSP registration** (Afterset as ISV) | **$200** | One-time | Required to register brands/campaigns on behalf of users [VERIFIED — Telgorithm] |
| **Brand registration** | **$4.50** | One-time per brand | Increased from $4.00 on Aug 1, 2025 [VERIFIED] |
| **Standard brand vetting** (Aegis/WMC) | **$41.50** | One-time per vet | Optional but unlocks higher throughput [VERIFIED] |
| **Campaign vetting** | **$15** | Per submission (includes re-submissions) [VERIFIED] |
| **Campaign MRC — Marketing** | **$10/mo** | Per active campaign | 3-month minimum commitment [VERIFIED] |
| **Campaign MRC — Low Volume Mixed** | **$1.50/mo** | Per campaign | Capped at 2,000 segments/day to T-Mobile [VERIFIED] |
| **Campaign MRC — Sole Proprietor** | **$2/mo** | Per campaign | No EIN required [VERIFIED] |

### Carrier surcharges for registered 10DLC (2026 rates)

| Carrier | Inbound | Outbound |
|---|---|---|
| AT&T | $0.0035 | $0.0035 [VERIFIED — Bandwidth, effective Apr 2026] |
| T-Mobile | $0.0025 | $0.0045 [VERIFIED — effective Jan 2026] |
| Verizon | $0 | $0.0045 [VERIFIED — effective May 2026] |
| US Cellular | $0.0025 | $0.005 [VERIFIED] |

Unregistered 10DLC traffic has been **fully blocked by all US carriers since February 1, 2025** — not filtered or degraded, but blocked completely [VERIFIED — multiple carrier announcements]. This is non-negotiable.

### Throughput by trust score

| Trust Score | AT&T MPS (Marketing) | T-Mobile Daily Cap |
|---|---|---|
| Sole Proprietor | 1 MPS (fixed) | 1,000 msgs/day [VERIFIED] |
| Low (0–24) | ~0.2 MPS | 2,000/day [VERIFIED] |
| Mid-Low (25–49) | ~4 MPS | 10,000/day [VERIFIED] |
| Mid-High (50–74) | ~10 MPS | 50,000/day [VERIFIED] |
| High (75–100) | ~75 MPS | 200,000/day [VERIFIED] |

### Why 10DLC is problematic for Afterset's multi-tenant model

Each separate business entity sending messages via 10DLC requires its own brand registration. A single campaign can only be associated with one brand, and no two brands can share the same phone number [VERIFIED — Telnyx ISV docs, Twilio ISV guides].

This creates a cost/complexity matrix that scales linearly:

| Artists on Platform | One-Time Brand + Campaign Fees | Monthly Campaign Fees |
|---|---|---|
| 10 | $195 | $100/mo |
| 100 | $1,950 | $1,000/mo |
| 1,000 | $19,500 | $10,000/mo |

Most gigging musicians lack EINs, defaulting to sole proprietor registration (1 MPS, 1,000 T-Mobile daily cap) — insufficient for any artist with meaningful fan engagement [VERIFIED]. The alternative — registering Afterset as a single brand with a platform campaign — is possible but risks carrier rejection if the multi-tenant model isn't fully disclosed, and T-Mobile's daily cap becomes shared across all artists.

**This is the strongest argument for toll-free or dedicated short code over 10DLC.**

---

## Keyword conflict management across multi-tenant platforms

With shared short codes defunct, the industry has converged on three patterns for multi-tenant keyword routing.

**Community.com uses dedicated numbers per creator.** Each creator (Justin Bieber, Barack Obama, McDonald's) receives a unique 10-digit phone number via Twilio's 10DLC infrastructure. Fans text anything to that number — no keyword needed. This eliminates keyword conflicts entirely and creates an intimate, personal-feeling channel. At 20 million subscribers and 7+ billion messages, Community proves the model scales [VERIFIED — Twilio case study]. The cost: ~$1.15/month per artist on Twilio for the number lease alone, plus per-artist 10DLC registration.

**SlickText, SimpleTexting, and EZTexting all use first-come-first-served keyword claiming** on shared numbers. Keywords must be unique per number. All three platforms now offer unlimited keywords on all plans [VERIFIED — respective pricing pages]. When a keyword is taken, users must choose an alternative. No platform implements automated keyword suggestion — they simply reject the conflict and let users try again [INFERRED from documentation review].

**SimpleTexting adds sub-keywords (triggers)**: under a master keyword, you can create secondary keywords that trigger different responses (e.g., keyword "PIZZA" with trigger "HOURS" returns store hours) [VERIFIED — simpletexting.com/features/triggers]. This pattern could theoretically work for Afterset — a master keyword "AFTERSET" with artist-name sub-keywords — but it adds friction to the fan experience (texting two words instead of one).

### Recommended architecture for Afterset

Three viable patterns exist, ranked by user experience:

**Option A — Shared number(s) with artist-name keywords** (recommended for launch). Single toll-free number. Each artist claims a keyword (their stage name, e.g., "JDOE"). Fan texts "JDOE" to the number, receives the capture URL. Keyword availability is checked at claim time; conflicts resolved by suggesting alternatives ("JDOE" taken → "JOHNDOE" or "JDOE1"). A pool of 3–5 numbers can expand the keyword namespace by 3–5× if conflicts become frequent. Cost: one number lease (~$2/month).

**Option B — Dedicated number per artist** (Community.com model, for growth phase). Each artist gets their own toll-free number. Fan texts anything to the number. No keyword needed — simplest fan UX. Cost scales linearly (~$2/month per artist). At 1,000 artists, that's $2,000/month in number leases alone — but this could be monetized as a premium feature.

**Option C — Dedicated short code** (for scale). One memorable short code (e.g., "55555"), unlimited keywords, highest throughput. Cost: $500–$1,500/month for the number plus FTEU surcharges. Justified when monthly message volume exceeds 50K and brand memorability matters for marketing materials.

---

## TCPA compliance: the RILA exemption covers Afterset's core flow

The FCC addressed Afterset's exact pattern in its **2015 Declaratory Ruling (FCC 15-72)**, responding to a petition from the Retail Industry Leaders Association (RILA), whose members (Target, Walgreens, Best Buy) run programs where consumers text keywords to short codes and receive single coupon replies.

**The FCC ruled that a one-time text message sent immediately after a consumer's request does not violate the TCPA**, provided it: (1) was requested by the consumer, (2) is a one-time-only message sent immediately, and (3) contains **only the information requested, with no other marketing or advertising** [VERIFIED — FCC 15-72, July 10, 2015].

This means Afterset's auto-reply with a capture page URL falls outside TCPA scope as "fulfillment of a consumer request" — not telemarketing. The fan initiated contact by texting the keyword, the reply is immediate and singular, and the URL delivers the requested information.

**Critical constraints on this exemption:**

The auto-reply must contain only the URL and essential context — no promotional copy, no "Check out our merch!" upsells, no additional calls to action beyond visiting the link [VERIFIED]. The content of the landing page matters too: if the capture page is overtly promotional and the reply describes it as such, the exemption could be jeopardized [INFERRED from FCC language]. Frame the URL as fulfilling the fan's information request, not as marketing.

Legal experts recommend a **"belt-and-suspenders" approach** — Klein Moynihan Turco LLP warns that some courts have disagreed with the FCC's interpretation, and advises obtaining prior express written consent before delivering any commercial text, even one-time [VERIFIED — Klein Moynihan Turco legal analysis]. The capture page web form is the ideal place to collect this written consent for any future marketing messages.

For future recurring marketing SMS (show announcements, new releases), the initial keyword text is **not sufficient consent** [VERIFIED — universal consensus]. Prior Express Written Consent (PEWC) must be collected separately, with specific disclosures about message type, frequency, opt-out mechanism, and "message and data rates may apply." The recommended flow: fan texts keyword → auto-reply with URL (RILA-exempt) → fan submits web form with TCPA disclosure checkbox (this is the PEWC) → optional double opt-in confirmation text.

### Day-1 compliance checklist

| Requirement | Priority | Source |
|---|---|---|
| STOP/CANCEL/END/QUIT/UNSUBSCRIBE keyword handling and immediate suppression | **Day 1** | TCPA + CTIA [VERIFIED] |
| HELP keyword response with brand name and support contact | **Day 1** | CTIA [VERIFIED] |
| Brand identification in every auto-reply | **Day 1** | CTIA [VERIFIED] |
| Auto-reply contains only requested info (no marketing) | **Day 1** | FCC 15-72 [VERIFIED] |
| Consent record logging (timestamp, phone, keyword) | **Day 1** | TCPA best practice [VERIFIED] |
| Terms of Service page accessible from CTA | **Day 1** | CTIA [VERIFIED] |
| Privacy Policy page | **Day 1** | CTIA [VERIFIED] |
| Honor opt-outs within 10 business days via any method | **Day 1** | FCC 24-24, effective April 2025 [VERIFIED] |
| "Msg & data rates may apply" in CTA signage/ads | **Day 1** | CTIA [VERIFIED] |
| PEWC consent mechanism on capture page for future marketing | **Week 2–4** | TCPA [VERIFIED] |
| Double opt-in flow for recurring programs | **Week 2–4** | CTIA recommended [REPORTED] |

**CTIA single-message program exemption**: for one-time reply programs, STOP/HELP display in the message text is recommended but not strictly required — though the system must still process these commands if received [VERIFIED — Sinch/CTIA guidance]. Including them is still best practice.

Note: T-Mobile imposes **$10,000 fines** for sending before program approval and **$10 per message** for grey-route (unregistered) traffic [VERIFIED — T-Mobile Code of Conduct v2.2]. Do not skip registration.

---

## SMS reply template: 160 characters, no emoji, URL at end

A single GSM-7 encoded SMS segment allows **160 characters**. The URL `afterset.net/c/jdoe` is 20 characters; with `https://` prefix it's 28 characters. This leaves **132 characters** for the message body — more than enough.

**Including a single emoji anywhere in the message switches the entire encoding to UCS-2, dropping the limit to 70 characters** [VERIFIED — Twilio encoding docs]. Even "smart quotes" (curly apostrophes from copy-paste) trigger UCS-2. Use straight ASCII characters only.

Recommended reply templates (all single-segment, GSM-7):

```
Afterset: Tap to join [Artist]'s fan list for setlists and shows: https://afterset.net/c/jdoe Reply HELP for help, STOP to opt out
```
(131 characters — includes compliance language)

```
[Artist] via Afterset - get future show updates here: https://afterset.net/c/jdoe Msg&data rates may apply. STOP to opt out.
```
(126 characters — alternative with rates disclosure)

**Link preview behavior**: on iOS, SMS from unknown senders does **not** generate rich link previews — the URL renders as tappable plain text [VERIFIED — Sinch developer docs, SuperPhone]. On Android (Google Messages), previews may appear with a "Tap to load preview" prompt [VERIFIED]. Always include the `https://` prefix to ensure the URL is recognized as tappable across all devices [INFERRED]. Place the URL at the end of the message — CTIA guidance and platform documentation agree this position has the best chance of preview rendering when conditions are met [VERIFIED].

Configure **Open Graph meta tags** (og:title, og:description, og:image) on `afterset.net/c/` pages. While most first-contact SMS won't show previews, the tags benefit: (a) Android users, (b) iOS users who save the number, and (c) any future sharing of the link via iMessage or social platforms.

---

## Delivery latency: 5-second reply target is achievable

The end-to-end latency chain for Afterset's inbound-keyword → outbound-reply flow involves five hops: carrier delivers inbound to provider SMSC (milliseconds) → provider fires webhook to Afterset server (50–200ms) → server processes keyword lookup and returns TwiML/API response (10–500ms) → provider queues outbound message (milliseconds) → carrier delivers to fan's handset (1–5 seconds) [INFERRED from verified component latencies].

**90% of domestic SMS messages deliver in under 5 seconds** [VERIFIED — Sinch/CLX monitoring data]. Average delivery time across platforms is approximately **3.5 seconds** [REPORTED — MessageFlow, 11.7B messages/month dataset]. ProTexting reports single SMS auto-replies "usually delivered within 5 seconds" [REPORTED].

The critical path for server-side processing: Twilio's webhook timeout is 15 seconds [VERIFIED], but best practice is responding in under 500ms. For Afterset's use case — parse keyword, look up artist slug (Redis hash map or in-memory dictionary), return TwiML — processing should complete in **under 50ms** [INFERRED]. This is not a database-heavy operation.

**Twilio Functions** (serverless Node.js on Twilio's infrastructure) eliminates the network round-trip to an external server, shaving ~50–200ms off the latency chain. Cost is $0.0001/invocation after a free tier [VERIFIED]. For a startup prioritizing simplicity, this is the fastest auto-reply path that still supports dynamic keyword → URL mapping.

No provider offers native dynamic keyword-to-URL auto-reply that would bypass webhooks entirely. Telnyx's auto-response configs and Twilio's TwiML Bins both support only static responses [VERIFIED]. Server-side processing (webhook or serverless function) is required for personalized replies.

---

## International expansion: Canada is easy, UK/EU requires architecture changes

### Canada (Phase 2 — minimal effort)

US and Canada share the North American Numbering Plan (NANP) with country code +1. **A US toll-free number already receives texts from Canadian phones** — no additional number needed [VERIFIED — Twilio docs: "Reliable two-way SMS conversations are supported for recipients in the United States and Canada"]. Message costs are comparable: Twilio charges $0.0083/segment base plus Canadian carrier surcharges ($0.0064–$0.0087/segment for Bell, Rogers, Telus) [VERIFIED — Twilio Canada pricing].

CASL (Canada's Anti-Spam Legislation) exempts "messages sent as direct response to customer questions, requests or inquiries" [VERIFIED — CRTC], which covers Afterset's single auto-reply. For any future marketing messages, CASL requires express consent specific to the SMS channel, with sender identification, contact info, and unsubscribe mechanism in every message. Fines reach **$10M per violation for businesses** [VERIFIED].

**Canada support requires near-zero engineering work** — add CASL-compliant sender identification to auto-reply templates and implement the existing US flow. US short codes do NOT work for Canadian phones (short codes are country-specific) [VERIFIED], but toll-free numbers do.

### UK and EU (Phase 3 — significant effort)

Text-to-join fundamentally breaks outside North America. **UK phones cannot text US short codes or US toll-free numbers for SMS** [VERIFIED — Twilio: "US short codes can only send to US phone numbers on US carrier networks"]. A UK fan texting a US long code would pay **£0.35–£0.70+ international SMS rates** ($0.45–$0.88 per text) — terrible concert UX [REPORTED — UK carrier rate data].

Afterset needs **UK local numbers** (require KYC verification and regulatory compliance bundles) or **UK short codes** (8–12 weeks provisioning, ~$1,000/month) [VERIFIED]. UK outbound SMS costs ~$0.046/segment on Twilio — roughly **5.5× US pricing** [VERIFIED].

UK compliance (PECR + UK GDPR) requires explicit prior consent for marketing SMS with no "soft opt-in" exception for new contacts [VERIFIED — ICO guidance]. EU GDPR adds data minimization, storage limitation, data subject rights (access, erasure, portability), and cross-border transfer safeguards if data is stored in the US.

**Recommended international approach**: for UK/EU concerts, replace text-to-join with **QR code → mobile web capture form**. Display a QR code on venue screens; fan scans, lands on a mobile-optimized page, enters their phone number with consent checkbox. Platform sends confirmation SMS from a local number. This eliminates international SMS charges for fans and sidesteps cross-border number limitations.

| Market | Effort | Number Needed | Key Compliance | SMS Cost/Segment |
|---|---|---|---|---|
| **US** | Baseline | US toll-free | TCPA, CTIA, 10DLC | ~$0.011 all-in [INFERRED] |
| **Canada** | Minimal | Existing US toll-free works | CASL | ~$0.015 all-in [VERIFIED] |
| **UK** | Significant | UK local or short code | PECR, UK GDPR | ~$0.050 all-in [VERIFIED] |
| **EU** | High (per-country) | Local number per country | GDPR, ePrivacy | $0.03–$0.08 varies [INFERRED] |

For international provider selection, **Twilio offers the broadest coverage** (180+ countries, UK short codes, alphanumeric sender IDs in 186 countries) [VERIFIED]. Telnyx covers 40+ countries for two-way SMS at lower per-message rates. **Bandwidth is US/Canada only** and unsuitable for international expansion [VERIFIED].

---

## Conclusions and phased recommendations

**Launch phase (0–1K messages/month)**: Deploy a single verified toll-free number on **Telnyx** ($1.10/month lease, ~$0.012/message all-in). Implement keyword routing via webhook or Telnyx's Node.js SDK (~15 lines of code). Handle STOP/HELP natively via Telnyx's auto opt-in/opt-out. Total cost: **under $15/month**. Time to production: 1–2 weeks including toll-free verification.

**Traction phase (1K–10K messages/month)**: Remain on toll-free. Consider adding a second toll-free number to expand keyword namespace if conflicts emerge. Register for 10DLC in parallel ($4.50 brand + $15 campaign + $10/month) as a backup path. If Telnyx reliability proves insufficient, **Twilio** is the premium fallback with superior documentation and the broadest feature set. Total cost: **$9–$75/month on Telnyx**, or $13–$114/month on Twilio.

**Growth phase (10K–200K messages/month)**: Evaluate whether to transition to a **dedicated short code** ($500–$1,000/month) for brand memorability and 100+ MPS throughput. The short code becomes cost-effective when FTEU surcharges are offset by marketing value (fans remember "Text MUSIC to 55555" better than a toll-free number). At this scale, **Bandwidth** enters consideration — its Tier 1 carrier economics save ~$700/month versus Twilio at the 200K tier.

**International phase**: Add Canada for near-free by using the existing US toll-free number with CASL-compliant reply templates. For UK/EU, implement QR code capture as the primary flow and defer SMS-initiated capture until local numbers and compliance infrastructure are in place. Choose Twilio if international coverage is a priority; stay with Telnyx if US/Canada suffices.

The single most important architectural decision: **choose toll-free over 10DLC for multi-tenant launch**. The 10DLC per-artist registration burden ($4.50 + $15 + $10/month per artist, with sole-proprietor throughput limits) makes it structurally wrong for a platform where hundreds of independent musicians share infrastructure. Toll-free avoids this entirely while delivering adequate throughput, simpler compliance, and faster time-to-market.