# ADR-005: SMS Text-to-Join — Telnyx Toll-Free with Shared-Number Keyword Routing

**Status:** Accepted
**Date:** March 21, 2026
**Author:** Afterset team
**Affects:** Text-to-join capture flow, Twilio/Telnyx integration, keyword management, SMS compliance (TCPA/CTIA/10DLC), artist dashboard UX (keyword claiming), capture method attribution, international expansion path, pricing model (SMS cost absorption)

---

## Decision

**Telnyx** as the SMS provider with a **single verified US toll-free number** ($1.10/month lease) using **webhook-based keyword routing** to map artist keywords to capture page URLs. Fan texts a keyword (e.g., "JDOE") to the toll-free number, the Hono API on Railway (ADR-004) matches the keyword to an artist's capture page slug, and returns an auto-reply SMS containing the capture page URL. Total SMS cost at launch: **under $15/month**. Twilio is the designated fallback provider if Telnyx reliability proves insufficient.

**Critical day-1 requirements:** Toll-free verification submitted immediately upon account creation (3–15 business day approval window). STOP/HELP/END/CANCEL/QUIT/UNSUBSCRIBE keyword handling enabled via Telnyx's built-in auto opt-in/opt-out. All auto-reply messages are GSM-7 encoded ASCII only — no emoji, no smart quotes. Consent records (timestamp, phone number, keyword) logged to Supabase on every inbound message. Brand identification ("Afterset") included in every reply.

**SMS provider abstraction layer** wraps all sending operations from day one, following the same pattern as the `EmailService` abstraction in ADR-002:

```typescript
interface SmsService {
  sendReply(to: string, body: string): Promise<SendResult>
  getInboundWebhookHandler(): WebhookHandler
  checkOptOut(phone: string): Promise<boolean>
}
```

The Telnyx implementation is the only one built at launch. The Twilio implementation is built if and when Telnyx reliability triggers a migration.

---

## Context

Text-to-join is the second fan capture method after QR codes. The flow: artist announces "Text JDOE to (833) 555-XXXX" from stage → fan sends SMS → Afterset matches keyword to artist → auto-reply delivers the capture page URL → fan taps link → capture page loads → fan enters email. This creates a capture path for fans who find SMS easier than camera-scanning a QR code in a dark, crowded venue.

The capture page entry method ADR (companion doc: `capture-page-entry-method.md`) deferred eight specific questions to this decision: SMS provider selection, 10DLC registration, keyword routing architecture, delivery latency, international support, cost modeling, reply content format, and opt-in/opt-out compliance. All eight are resolved here.

### Why this decision carries downstream weight

The toll-free number becomes part of every artist's stage announcement, printed materials, and social media posts. Changing the number after artists have distributed it on flyers, posters, and merch is operationally destructive — every printed artifact becomes wrong. The keyword namespace design (how conflicts are handled, whether keywords are case-sensitive, maximum length) affects artist onboarding UX and scales with every new artist. The compliance architecture (TCPA, CTIA, carrier registration) must be correct before the first message is sent — T-Mobile imposes $10,000 fines for sending before program approval and $10 per unregistered message.

### Scale projections

| Phase | Artists | SMS messages/month (inbound + outbound) | Estimated cost (Telnyx toll-free) |
|---|---|---|---|
| Launch (month 1–2) | ~50 | ~200 | ~$3.50 |
| Traction (month 6) | 200+ | ~2,000 | ~$25 |
| Growth (year 1) | 1,000 | ~20,000 | ~$150 |
| Scale (year 2+) | 10,000 | ~200,000 | ~$1,260 |

SMS is a Pro tier feature ($12/month). At the growth phase (1,000 artists, ~20,000 messages/month), the per-artist SMS cost is ~$0.15/month — well within margin. At scale (10,000 artists), the per-artist cost is ~$0.13/month. SMS costs never threaten unit economics.

### Constraints

- Solo developer — DX, setup speed, and minimal moving parts matter heavily.
- Text-to-join is Pro-only ($12/mo). SMS costs must stay under $1/artist/month at scale.
- US-only at launch. Canada support with minimal effort; UK/EU deferred.
- SMS is ONLY for the single inbound → single reply capture flow. No ongoing marketing SMS.
- The fan initiates contact by texting the keyword — not cold outreach.
- The SMS reply must be deliverable within 5 seconds of the fan's inbound message.
- All auto-reply content must qualify for the FCC's RILA exemption (no marketing copy in the reply).

---

## Options Considered

### Sub-decision A: Number Type

#### A1. Toll-Free (8XX) — SELECTED

A single US toll-free number ($1.10/month on Telnyx, $2.15 on Twilio). Verification is free and takes 3–15 business days. Default throughput is 3–30 MPS depending on provider (Telnyx and Vonage offer higher defaults than Twilio's 3 MPS). No per-artist registration fees. No carrier-specific daily message caps. The 8XX prefix is less personal than a local area code but immediately recognizable to US consumers.

The key advantage for Afterset's multi-tenant model: toll-free verification is per-number, not per-artist. One verification covers all artists on the platform. No TCR brand registration, no campaign fees, no EIN requirements for individual artists.

#### A2. 10DLC Long Code — REJECTED

10DLC's multi-tenant cost structure is structurally wrong for Afterset. Each artist as a separate business entity technically requires their own brand registration ($4.50 one-time) plus campaign vetting ($15 per submission) plus a monthly campaign fee ($10/month for marketing, $1.50–$2 for low-volume/sole-proprietor). At 100 artists: $1,950 one-time plus $1,000/month recurring — before sending a single message.

Most gigging musicians lack EINs, forcing sole proprietor registration which caps throughput at 1 MPS and 1,000 T-Mobile messages/day — insufficient for any artist with meaningful fan engagement. Registering Afterset as a single brand with a platform-level campaign is theoretically possible but carries carrier-approval risk, and T-Mobile's daily cap would be shared across all artists.

Unregistered 10DLC traffic has been fully blocked by all US carriers since February 1, 2025. This is not a filtering or degradation — it is a complete block.

#### A3. Dedicated Short Code — REJECTED FOR LAUNCH

Short codes ($500–$1,500/month lease) deliver the best fan UX: "Text ROCK to 55555" is memorable and fits naturally in stage announcements. Throughput exceeds 100 MPS. Keyword routing operates at the carrier level — the most robust multi-tenant solution.

Rejected for launch because: the lease alone exceeds Afterset's entire remaining infrastructure budget ($5/month headroom after ADR-001 through ADR-004), setup takes 6–10 weeks, and every outbound message carries a $0.02 FTEU (Free to End User) surcharge from AT&T, T-Mobile, and Verizon — adding $2,000/month at the 100K outbound message tier on top of the lease and base message costs. At scale (200K+ messages/month), the short code becomes cost-justified if brand memorability warrants it.

#### A4. Shared Short Code — NOT AVAILABLE

Shared short codes were deprecated by all US carriers between 2021–2023. This option no longer exists.

---

### Sub-decision B: SMS Provider

#### B1. Telnyx — SELECTED

Telnyx offers the lowest per-segment rate at every volume tier: $0.004/segment for 10DLC and $0.0055/segment for toll-free (base, before carrier surcharges). Number lease is $1.00/month plus $0.10 SMS capability add-on = $1.10/month for toll-free. Telnyx owns its own carrier-grade IP network, which may reduce delivery latency by eliminating aggregator hops.

Built-in auto opt-in/opt-out handles STOP/HELP compliance keywords automatically, saving implementation effort on day-1 compliance. The Node.js SDK is modern with a single unified API. No native dynamic keyword-to-URL auto-reply — webhook-based routing is required (same as all providers).

Total cost comparison at each tier (toll-free, including number lease + base message fees + estimated carrier surcharges):

| Tier | Telnyx | Twilio | Bandwidth | Vonage |
|---|---|---|---|---|
| 100 msg/mo | ~$2.35 | ~$3.30 | ~$3.10 | ~$3.40 |
| 1,000 msg/mo | ~$8.60 | ~$13.30 | ~$13.00 | ~$14.85 |
| 10,000 msg/mo | ~$73.60 | ~$114 | ~$112 | ~$99.50 |
| 200,000 msg/mo | ~$1,261 | ~$2,232 | ~$2,202 | ~$1,781 |

Telnyx delivers 30–45% savings over Twilio at every tier. At the 200K tier, that's ~$970/month saved.

**Trade-off:** Telnyx is less widely adopted than Twilio. Fewer Stack Overflow answers, smaller community, less third-party documentation. This is manageable given the SMS integration is a single webhook handler with a straightforward request/response pattern.

#### B2. Twilio — DESIGNATED FALLBACK

Twilio has the most mature SDK, best documentation, broadest international coverage (180+ countries), and the largest developer community. Per-segment base rate is $0.0079–$0.0083 with carrier surcharges additive. Toll-free number at $2.15/month. Toll-free verification is free, 3–5 business days.

Twilio's premium is the documentation and ecosystem tax. For Afterset's simple inbound-keyword → outbound-reply pattern, the premium doesn't buy proportional value at launch. However, Twilio becomes the correct choice if: (a) Telnyx reliability proves insufficient, (b) international expansion beyond Canada is prioritized, or (c) the integration complexity grows beyond a single webhook handler (e.g., Twilio Studio for multi-step conversational flows).

Twilio Functions (serverless Node.js on Twilio's infrastructure at $0.0001/invocation) eliminates the network round-trip to the Railway server, shaving 50–200ms off reply latency. This is a meaningful advantage if the 5-second reply target proves tight.

#### B3. Bandwidth — REJECTED FOR LAUNCH

Bandwidth is a Tier 1 US carrier (owns the underlying network), yielding the lowest theoretical per-message costs and potentially 100–500ms lower latency. However: US/Canada only (no international expansion path), less polished Node.js SDK, less extensive documentation, and the $10/month 10DLC campaign MRC hurts at low volume. Bandwidth enters consideration at the 200K+ message tier if Afterset remains US-only.

#### B4. Vonage (Nexmo) — REJECTED

Pricing transparency is poor — the public pricing page returns 403 errors and directs to sales. The Node.js SDK has a confusing dual-API situation (legacy SMS API vs. newer Messages API, using both simultaneously is unsupported). No native keyword filtering on inbound messages. A significant SMS outage occurred in 2024. The toll-free throughput (up to 50 MPS) is higher than Twilio's default, but this advantage doesn't justify the DX friction for a solo developer.

---

### Sub-decision C: Keyword Routing Architecture

#### C1. Shared Number with Artist-Name Keywords — SELECTED FOR LAUNCH

Single toll-free number. Each artist claims a keyword (typically their stage name or band abbreviation). Fan texts the keyword to the number. The Hono API webhook handler looks up the keyword in a Supabase table, finds the artist's capture page slug, and returns an SMS reply with the URL.

Keyword claiming rules:
- Keywords are case-insensitive (stored uppercase, matched uppercase).
- Minimum 2 characters, maximum 20 characters, alphanumeric only.
- Reserved keywords (STOP, HELP, END, CANCEL, QUIT, UNSUBSCRIBE, START, INFO, YES, NO) are blocked from artist claiming.
- Conflicts resolved by first-come-first-served with alternative suggestions. If "JDOE" is taken, suggest "JOHNDOE", "JDOE1", or the artist's page slug.
- A pool of 3–5 toll-free numbers can expand the keyword namespace by 3–5× if conflicts become frequent at 500+ artists.

**How comparable platforms solve this:** SlickText, SimpleTexting, and EZTexting all use first-come-first-served keyword claiming on shared numbers with unlimited keywords on all plans. No platform implements automated keyword suggestion — they reject the conflict and let users try again. Community.com uses dedicated numbers per creator (no keywords needed), but at ~$1.15/month per artist in number leases alone.

#### C2. Dedicated Number Per Artist — PLANNED FOR GROWTH PHASE

Each artist gets their own toll-free number. Fan texts anything to the number — no keyword needed. Simplest fan UX, eliminates keyword conflicts entirely. Cost: ~$1.10/month per artist on Telnyx. At 1,000 artists, that's $1,100/month in number leases. This could be a premium Pro feature or the default at Band tier ($25/month).

The migration path from C1 to C2 is clean: artists who upgrade get a dedicated number, their keyword on the shared number continues to work as an alias, and both paths route to the same capture page. No fan-facing disruption.

#### C3. Dedicated Short Code — PLANNED FOR SCALE PHASE

One memorable short code (e.g., "55555") with unlimited keywords and 100+ MPS throughput. Cost-effective when monthly message volume exceeds 50K and brand memorability justifies the $500–$1,500/month lease plus FTEU surcharges. "Text ROCK to 55555" is the ideal stage announcement format.

---

## Implementation Architecture

### Webhook flow (Railway Hono API)

```
Fan sends SMS → Telnyx receives → Telnyx fires webhook to api.afterset.net/webhooks/sms
→ Hono handler:
  1. Validate webhook signature
  2. Parse keyword from message body (trim, uppercase)
  3. Check opt-out list (phone number)
  4. Check reserved keywords → return HELP/compliance response if matched
  5. Look up keyword in `sms_keywords` table (Supabase)
  6. If found: return SMS reply with capture page URL
  7. If not found: return "Keyword not recognized" fallback
  8. Log consent record (timestamp, phone, keyword, artist_id)
→ Telnyx sends reply SMS to fan
```

Processing time for steps 1–8: under 50ms. This is a simple hash-map lookup, not a heavy database operation. The keyword table can be cached in memory on the Railway server and refreshed on artist changes.

### SMS reply template

All replies must be GSM-7 encoded (ASCII only) to stay within a single 160-character SMS segment. No emoji — a single emoji switches encoding to UCS-2, dropping the limit to 70 characters.

```
Afterset: Tap to join [Artist]'s fan list: https://afterset.net/c/jdoe Reply HELP for help, STOP to opt out
```

This template at ~110 characters leaves headroom for longer artist names and slugs. The `https://` prefix is required for reliable link detection across all devices. URL placed at the end for best link preview behavior on Android. Brand identification ("Afterset:") at the start satisfies CTIA requirements.

### Data model additions

```sql
-- Keyword management
CREATE TABLE sms_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES artists(id),
  capture_page_id UUID NOT NULL REFERENCES capture_pages(id),
  keyword VARCHAR(20) NOT NULL,
  phone_number VARCHAR(15) NOT NULL,  -- toll-free number this keyword is registered on
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(keyword, phone_number)
);

-- Consent and opt-out tracking
CREATE TABLE sms_consent_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(15) NOT NULL,
  keyword VARCHAR(20) NOT NULL,
  artist_id UUID REFERENCES artists(id),
  direction VARCHAR(8) NOT NULL,  -- 'inbound' or 'outbound'
  message_body TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE sms_opt_outs (
  phone_number VARCHAR(15) PRIMARY KEY,
  opted_out_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sms_keywords_lookup ON sms_keywords(phone_number, keyword);
CREATE INDEX idx_sms_opt_outs_phone ON sms_opt_outs(phone_number);
```

---

## Compliance Architecture

### TCPA: the RILA exemption

The FCC's 2015 Declaratory Ruling (FCC 15-72) explicitly addressed Afterset's exact pattern: a consumer texts a keyword and receives a single immediate reply. The FCC ruled this does not violate the TCPA, provided: (1) the consumer requested the message, (2) it is a one-time-only message sent immediately, and (3) it contains only the information requested with no other marketing or advertising.

Afterset's auto-reply qualifies: the fan initiated contact, the reply is immediate and singular, and the URL delivers the requested capture page. The reply must not contain promotional copy — no "Check out our merch!", no additional calls to action beyond visiting the link.

**Belt-and-suspenders approach:** Some courts have disagreed with the FCC's RILA interpretation. The capture page web form is the ideal place to collect Prior Express Written Consent (PEWC) for any future marketing messages, with specific disclosures about message type, frequency, opt-out mechanism, and "message and data rates may apply."

### CTIA compliance (day 1)

| Requirement | Implementation |
|---|---|
| STOP/CANCEL/END/QUIT/UNSUBSCRIBE handling | Telnyx built-in auto opt-out (immediate suppression) |
| HELP keyword response | Telnyx built-in auto-reply with brand name and support contact |
| Brand identification in every reply | "Afterset:" prefix in reply template |
| Auto-reply contains only requested info | URL + compliance language only, no marketing |
| Consent record logging | `sms_consent_log` table, every inbound and outbound |
| Terms of Service accessible from CTA | Link in HELP response |
| Privacy Policy page | Link in HELP response |
| Honor opt-outs within 10 business days | Telnyx handles immediately; `sms_opt_outs` table for app-layer enforcement |
| "Msg & data rates may apply" in CTA signage | Artist dashboard generates print materials with required disclosure |

### T-Mobile enforcement

T-Mobile imposes $10,000 fines for sending before program approval and $10 per message for unregistered traffic. Toll-free verification must complete before the first production message is sent. Do not send test messages to real carrier numbers during development — use Telnyx's test/sandbox environment.

---

## Consequences

### Positive

- SMS cost at launch is ~$3.50/month (200 messages on a $1.10 toll-free number). Combined with existing infrastructure ($50/month from ADR-004), total is $53.50/month — well within budget.
- Per-artist SMS cost never exceeds $0.15/month at any projected scale tier. SMS does not threaten Pro tier unit economics.
- Toll-free verification avoids the entire 10DLC registration complexity — no per-artist brand registration, no EIN requirements, no TCR campaign fees, no carrier-specific daily caps.
- Telnyx's built-in STOP/HELP handling eliminates ~30% of the compliance implementation effort.
- The provider abstraction layer limits a Telnyx → Twilio migration to a single module swap, matching the email abstraction pattern from ADR-002.
- Canada works immediately with the existing US toll-free number at near-identical cost — no additional number or registration needed.
- The keyword → capture page lookup is a simple hash-map operation (~50ms processing time). No risk of latency blowing the 5-second reply target.
- Shared-number keyword routing at launch, with a clean migration path to dedicated-number-per-artist at growth phase — no fan-facing disruption.

### Negative

- Toll-free numbers (833, 844, etc.) feel less personal and memorable than short codes ("Text ROCK to 55555"). Stage announcements include a 10-digit phone number instead of a 5-digit code.
- Telnyx is less widely adopted than Twilio — fewer community resources, fewer Stack Overflow answers, and less third-party documentation. Debugging obscure issues may take longer.
- Twilio's 3 MPS default toll-free throughput is tight for a venue with 500+ simultaneous text-to-join attempts. Telnyx's default is higher but exact number is less documented. If throughput becomes a bottleneck, requesting a limit increase requires contacting sales.
- Keyword conflicts will increase as the platform grows. At 500+ artists, the single-number namespace will feel constrained, pushing toward the dedicated-number-per-artist migration earlier than planned.
- The SMS auto-reply must contain zero marketing copy to maintain the RILA exemption. No upsells, no merch links, no "follow us on Instagram." The reply is strictly functional.

### Mitigations

1. **Toll-free verification submitted on day 1 of Sprint 3.** The 3–15 business day approval window runs in parallel with SMS integration development. Do not wait until code is ready to submit verification.

2. **Keyword cache on Railway.** Cache the `sms_keywords` table in memory on the Railway server. Refresh on artist keyword changes via a simple invalidation webhook. This keeps the webhook handler response time under 50ms without hitting Supabase on every inbound message.

3. **Fallback response for unrecognized keywords.** If a fan texts a keyword that doesn't match any artist, reply with: "Afterset: Keyword not found. Check the spelling and try again. Reply HELP for help, STOP to opt out." This prevents silent failures.

4. **Monitor Telnyx delivery latency.** Log the timestamp delta between inbound webhook receipt and outbound reply confirmation. If p95 reply-to-delivery exceeds 8 seconds, begin Twilio migration evaluation.

5. **Keyword namespace expansion.** When keyword conflicts exceed 5% of claim attempts, add a second toll-free number. The webhook handler already routes by (phone_number, keyword) pair, so adding numbers requires only provisioning the number and updating the Telnyx messaging profile — no code changes.

---

## Revisit When

| Trigger | Reconsider |
|---|---|
| **Telnyx has a >2-hour outage affecting SMS delivery** | Begin Twilio migration. The `SmsService` abstraction limits this to a module swap. |
| **Toll-free throughput bottleneck during a large show** (dropped or delayed messages during a burst of 100+ simultaneous inbound texts) | Request throughput increase from Telnyx (up to 150 MPS via sales). If rejected or insufficient, evaluate dedicated short code. |
| **Keyword conflicts exceed 5% of claim attempts** | Add 2–3 additional toll-free numbers to expand the namespace. If conflicts persist, accelerate the dedicated-number-per-artist migration. |
| **500+ Pro artists on the platform** | Evaluate dedicated-number-per-artist as a standard Pro feature. At $1.10/month per number on Telnyx, the cost is ~$550/month — potentially offset by premium pricing or included in the Band tier. |
| **Monthly SMS volume exceeds 50K messages** | Evaluate dedicated short code ($500–$1,500/month) for brand memorability. "Text ROCK to 55555" in stage announcements and printed materials may justify the premium. |
| **International expansion beyond Canada** (UK/EU touring artists) | UK/EU fans cannot text US toll-free numbers. Deploy QR code as the primary capture method for international shows. If SMS-initiated capture is needed internationally, provision local numbers per country (requires Twilio for coverage breadth). |
| **Telnyx pricing increases or feature gaps emerge** | Bandwidth enters consideration at the 200K+ message tier for Tier 1 carrier economics. Twilio for international coverage. |
| **Artists request conversational SMS flows** (multi-step, not just keyword → reply) | Evaluate Twilio Studio ($0.0025/execution) for visual flow building, or build custom state machine on the Hono API. The current webhook architecture supports multi-turn conversations with server-side state management. |

---

## Validation Tasks Before Committing

These should be completed during Sprint 3 (text-to-join implementation), with toll-free verification started at the beginning of the sprint:

1. **[ ] Create Telnyx account and provision toll-free number.** Select an 833 or 844 prefix. Enable SMS capability ($0.10/month add-on). Submit toll-free verification immediately — the 3–15 business day approval window is the critical path.
2. **[ ] Configure Telnyx messaging profile.** Enable auto opt-in/opt-out for STOP/HELP/END/CANCEL/QUIT/UNSUBSCRIBE. Configure the webhook URL to `https://api.afterset.net/webhooks/sms`. Set the webhook failover URL.
3. **[ ] Test inbound → outbound reply latency.** Send 10 test messages from a personal phone. Measure end-to-end time from send to reply receipt. Pass criteria: p90 under 5 seconds.
4. **[ ] Test STOP/HELP handling.** Send STOP, verify opt-out confirmation. Send HELP, verify help response includes brand name and support contact. Send a keyword after STOP, verify the message is suppressed (no reply sent).
5. **[ ] Test keyword conflict detection.** Attempt to claim a keyword that already exists. Verify the dashboard rejects the conflict and suggests alternatives.
6. **[ ] Test GSM-7 encoding.** Verify the reply template renders as a single 160-character segment, not two 70-character UCS-2 segments. Check for smart quotes or special characters that could trigger UCS-2.
7. **[ ] Load test the webhook handler.** Simulate 100 concurrent inbound messages to the `/webhooks/sms` endpoint. Verify all 100 receive correct replies with <500ms server-side processing time.

---

## Research Sources

Full research document: `sms-text-to-join-research.md`

Key confidence levels on critical claims:

- Telnyx per-segment pricing ($0.004 10DLC, $0.0055 toll-free): **VERIFIED** (telnyx.com/pricing/messaging)
- Telnyx number lease ($1.00 + $0.10 SMS): **VERIFIED** (telnyx.com/pricing/numbers)
- Twilio per-segment pricing ($0.0079–$0.0083): **VERIFIED** (twilio.com/en-us/sms/pricing/us)
- Shared short codes deprecated by all US carriers (2021–2023): **VERIFIED** (multiple carrier announcements)
- 10DLC brand registration fees ($4.50 + $15 vetting + $10/month campaign): **VERIFIED** (Telgorithm, Twilio 10DLC docs)
- Unregistered 10DLC traffic fully blocked since February 1, 2025: **VERIFIED** (carrier announcements)
- Sole proprietor 10DLC throughput cap (1 MPS, 1,000 T-Mobile daily): **VERIFIED** (Twilio 10DLC docs)
- FTEU surcharge on short codes ($0.02/outbound segment): **VERIFIED** (Twilio carrier fees page)
- FCC RILA ruling (FCC 15-72, single auto-reply exemption): **VERIFIED** (FCC 15-72, July 10, 2015)
- T-Mobile enforcement fines ($10,000 pre-approval, $10/message unregistered): **VERIFIED** (T-Mobile Code of Conduct v2.2)
- UCS-2 encoding triggered by emoji (70-char limit): **VERIFIED** (Twilio encoding docs)
- SMS delivery p90 under 5 seconds for domestic US: **VERIFIED** (Sinch/CLX monitoring data)
- US toll-free numbers receive Canadian SMS without additional provisioning: **VERIFIED** (Twilio docs)
- Bandwidth is US/Canada only: **VERIFIED** (Bandwidth docs)
- Community.com uses dedicated Twilio numbers per creator: **VERIFIED** (Twilio case study)
- Klein Moynihan Turco belt-and-suspenders TCPA recommendation: **VERIFIED** (KMT legal analysis)
- Cost comparison table calculations: **INFERRED** (calculated from verified per-segment rates and carrier surcharge estimates)
