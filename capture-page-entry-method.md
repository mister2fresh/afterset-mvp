# ADR: Capture page architecture — entry method considerations

**Status**: Accepted  
**Date**: 2026-03-17  
**Relates to**: Capture page architecture research (rendering strategy, payload budget, infrastructure)  
**Supersedes**: N/A

---

## Context

The capture page architecture research was conducted with QR code scanning as the primary entry scenario. In production, fans will reach capture pages through three distinct entry methods:

1. **QR code scan** — fan uses phone camera at the venue
2. **NFC tap** — fan taps phone against an NFC tag/sticker/card
3. **Text-to-join** — fan texts a keyword to a number, receives SMS with capture page URL, taps link

The core page architecture (static HTML on CDN, inline CSS/JS, <14KB payload) is **entry-method-agnostic** — the HTML served is identical regardless of how the fan arrives. However, the entry methods differ in ways that affect URL structure, timing assumptions, DNS behavior, browser context, and infrastructure planning.

Text-to-join will receive a dedicated deep-dive research document covering SMS provider selection, keyword routing, cost modeling, and compliance (TCPA/10DLC). This ADR covers only the foundational differences that affect the capture page architecture itself.

---

## Decision

The capture page infrastructure does not change based on entry method. The following adjustments are required to the architecture research and prototype specification to ensure correctness across all three entry methods.

---

## Entry method timing chains

### QR code (baseline from research doc)

| Step | Duration | Running total |
|---|---|---|
| Camera decodes QR | 100–300ms | ~200ms |
| OS preview / user tap | 200–500ms | ~500ms |
| Browser opens | 100–500ms | ~800ms |
| DNS resolution | 400–600ms | ~1,300ms |
| TCP + TLS 1.3 (2 RTT) | 800ms | ~2,100ms |
| HTTP request + TTFB | 50–200ms | ~2,300ms |
| HTML download (3KB) | ~80ms | ~2,380ms |
| Parse + FCP | 50–100ms | ~2,480ms |

**Scan-to-FCP: ~2.5–4s cold, ~1.5–2s warm (cached DNS, HTTP/3)**

### NFC tap (faster than QR)

| Step | Duration | Running total |
|---|---|---|
| NFC reads NDEF URL record | 50–100ms | ~75ms |
| OS handler (Android: direct open; iOS: notification tap) | 0–500ms | ~300ms |
| Browser opens | 100–500ms | ~600ms |
| DNS → TLS → HTTP → FCP | same as QR | ~2,280ms |

**Tap-to-FCP: ~2.3–3.5s cold, ~1.3–1.8s warm**

NFC is faster because there is no camera decode latency and no preview banner on Android (the URL opens directly in the default browser). iOS shows a notification banner the user must tap, adding ~300ms of user interaction time.

**NFC-specific constraint**: NDEF URL records on common NFC tags (NTAG213: 144 bytes usable; NTAG215: 504 bytes; NTAG216: 888 bytes) have limited capacity. The URL `https://afterset.net/c/artist-slug` is ~40 bytes with NDEF URL prefix shortening (`https://` is stored as a 1-byte prefix code). This fits easily on even the smallest tags. No architecture change needed, but URL length should stay under ~120 characters to support NTAG213 tags (cheapest, most common).

### Text-to-join (SMS → link tap)

| Step | Duration | Running total |
|---|---|---|
| Fan sends SMS | 1–3s (typing + send) | ~2s |
| SMS delivery to platform | 1–5s | ~5s |
| Platform processes keyword + sends reply | 0.5–3s | ~7s |
| Reply SMS delivery to fan | 1–5s | ~10s |
| Fan reads + taps link | 1–5s | ~13s |
| Browser opens + DNS → FCP | same as QR | ~15s |

**Text-to-FCP: ~10–20s total**

The page load portion (DNS → FCP) is identical to QR/NFC. The 8–15 seconds of SMS round-trip time is the dominant latency and cannot be reduced by page architecture. This means page load speed matters less for text-to-join than for QR/NFC in absolute terms — but it still matters because the fan has already waited 10+ seconds and their patience is lower, not higher.

---

## Foundational differences that affect the architecture

### 1. URL structure matters across entry methods

| Entry method | URL length pressure | Constraint |
|---|---|---|
| QR code | None (~2,900 char capacity) | N/A |
| NFC | Moderate (NTAG213 = ~137 usable bytes) | Keep URL under ~120 chars |
| SMS | High (160 chars per SMS segment, URL shares space with message text) | Shorter is better; every character in the URL is one less for the message |

**Implication**: The URL scheme `afterset.net/c/[slug]` is fine for all three. Avoid adding query parameters, UTM tags, or long slugs. If tracking the entry method, use the shortest possible param: `?v=q` / `?v=n` / `?v=s` (3 chars) rather than `?utm_source=qr_code&utm_medium=live_show` (40+ chars).

A shorter domain (e.g., `a]ftr.st` or similar) would save ~10 chars per URL. This is a nice-to-have, not a requirement. It adds DNS complexity (separate domain = separate DNS lookup unless preconnected) and operational overhead (second domain to manage). Not recommended at launch.

### 2. URL shorteners: never for QR/NFC, avoid for SMS

The research doc correctly prohibits URL shorteners for QR codes (adds 800ms+ redirect). The same applies to NFC.

For SMS, the pressure toward shorteners is real (message character limits), but the redirect cost is the same. Preferred approach: keep the canonical URL short enough to fit in an SMS alongside the message text. Example SMS:

> 🎵 You're in! Grab your free track: afterset.net/c/jdoe

That's ~52 characters, leaving 108 for the reply message — plenty.

**Decision**: No URL shorteners for any entry method. Keep capture URLs under 50 characters total.

### 3. DNS caching differs by entry-method burst pattern

- **QR/NFC**: 50–500 fans hit the same URL within 60 seconds. After the first 2–3 DNS lookups, the carrier's recursive resolver caches the record. Subsequent fans skip DNS (~0ms). This is the best case for DNS amortization.
- **SMS**: Fans receive replies over 2–5 minutes (SMS delivery is staggered). The burst is spread thinner. DNS caching still helps but the first-request percentage is slightly higher.

**Implication**: No architecture change. The static CDN approach handles both patterns. For SMS, consider including `<link rel="dns-prefetch" href="https://afterset.net">` in any web-based contexts that might precede the SMS flow (e.g., if the artist's website links to "Text ARTIST to 12345").

### 4. Browser context varies by entry method

| Entry method | iOS browser | Android browser |
|---|---|---|
| QR (Camera app) | Safari (always) | Default browser (usually Chrome) |
| NFC | Safari (always) | Default browser |
| SMS link in iMessage | Safari (in-app, then can open in Safari) | Default browser |
| SMS link in WhatsApp/Telegram/etc. | In-app WebView | In-app WebView |
| SMS link in default Messages app (Android) | N/A | Default browser |

**Implication**: In-app WebViews (WhatsApp, Telegram, Facebook Messenger) have cold DNS caches, no HTTP/3 0-RTT, and no connection reuse. They represent the worst-case browser context. The static HTML + inline everything approach is already optimized for this — no external resources to fetch, no framework hydration to wait for.

### 5. SMS link preview unfurling creates ghost pageviews

When a URL is sent via iMessage, the recipient's device automatically fetches the URL to generate a link preview (title, description, image). This happens *before the fan taps the link*.

**Implications**:
- The capture page will receive pageviews from Apple's link preview bot (user agent: `Applebot` or similar). These are not real fans.
- The page should include Open Graph meta tags so the preview looks intentional:
  ```html
  <meta property="og:title" content="{{ARTIST_NAME}}">
  <meta property="og:description" content="{{VALUE_EXCHANGE_MESSAGE}}">
  ```
- Server-side analytics should filter bot user agents to avoid inflated pageview counts.
- This is NOT a performance concern (the bot fetches from a fast connection), but it is a data accuracy concern.

### 6. Deduplication across entry methods

If an artist uses QR + NFC + text-to-join at the same show, a fan might:
- Scan QR, enter email
- Also text the keyword (because the artist asked from stage)
- Tap NFC on the way out

The capture API must deduplicate by email per artist. This is an API concern, not a page architecture concern, but it should be designed from the start.

**Decision**: The `/api/capture` endpoint should upsert on `(artist_id, email)` rather than insert. Return 200 OK regardless (the fan sees "You're in!" even on duplicate). Track the entry method (`v` query param) for analytics but don't create duplicate records.

---

## Revisions required to the main research document

### Section 5: "QR code → page load chain" → rename and expand

**Current title**: "QR code → page load chain"  
**New title**: "Entry method → page load chains"

Add the NFC timing chain alongside QR. Add a note acknowledging text-to-join timing (with forward reference to the dedicated SMS research doc). State that the page architecture is entry-method-agnostic.

### Section 5: "Direct URLs in QR codes, never shorteners" → broaden

**Current scope**: QR-only  
**New scope**: All entry methods

Reframe as "Direct URLs in all entry methods, never shorteners." Add the SMS character-count rationale for keeping URLs short organically rather than using shorteners.

### Section 5: Add browser context variance

Add a brief note that SMS links may open in in-app WebViews (WhatsApp, Telegram) with cold caches and no HTTP/3 — which reinforces the inline-everything approach.

### Section 7: Prototype specification — fix preconnect bug

**Current**: `<link rel="preconnect" href="https://afterset.net">`  
**Fix**: Remove this line (preconnecting to the serving origin is a no-op). If the API is on a different subdomain, preconnect to that instead:
```html
<link rel="preconnect" href="https://api.afterset.net">
```
If the API is same-origin (`/api/capture`), no preconnect is needed at all.

### Section 7: Prototype specification — add OG meta tags

Add to the `<head>`:
```html
<meta property="og:title" content="{{ARTIST_NAME}}">
<meta property="og:description" content="{{VALUE_EXCHANGE_MESSAGE}}">
<meta property="og:type" content="website">
```

These cost ~150 bytes uncompressed and ensure SMS link previews in iMessage display the artist name and value exchange message rather than a generic URL.

### Section 7: Prototype specification — add entry method tracking

Add to the form's hidden fields:
```html
<input type="hidden" name="v" value="">
```

Populate `value` from the URL query parameter at build time or via a one-liner in the inline JS:
```js
const v=new URLSearchParams(location.search).get('v')||'d';
document.querySelector('[name=v]').value=v;
```

Values: `q` = QR, `n` = NFC, `s` = SMS, `d` = direct/unknown. Adds ~80 bytes to the JS.

### Section 4: Burst pattern description

Add a note that the "100–500 hits in 60 seconds" burst describes QR/NFC. SMS spreads the same cohort over 2–5 minutes. Both patterns are handled identically by static CDN serving.

---

## What does NOT change

- **Page HTML/CSS/JS**: Identical regardless of entry method
- **CDN architecture**: Cloudflare R2 + CDN serves all entry methods equally
- **Payload budget**: 14KB target, ~3KB compressed — unchanged
- **Offline localStorage pattern**: Works regardless of how the fan arrived
- **Infrastructure recommendation**: Static files on R2 (launch) → Workers + KV (scale)
- **Dark theme / accessibility requirements**: Same venue, same conditions
- **Compression strategy**: Brotli 11 pre-compressed, same for all

---

## Open questions for the SMS research doc

These are explicitly out of scope for this ADR and will be addressed in the dedicated text-to-join research:

1. SMS provider selection (Twilio vs. alternatives) — cost, reliability, throughput
2. 10DLC registration and TCPA compliance for US numbers
3. Keyword routing architecture (shared short code vs. dedicated vs. toll-free vs. long code)
4. SMS delivery latency optimization
5. International SMS support (if artists tour internationally)
6. Cost per SMS at scale (impacts pricing model)
7. Whether the SMS reply should contain the URL only vs. URL + message
8. Opt-in/opt-out compliance flow
