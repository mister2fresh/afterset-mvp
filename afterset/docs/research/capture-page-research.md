# Optimal architecture for Afterset's fan capture pages

**Pre-built static HTML files served from Cloudflare R2 behind their CDN is the optimal architecture for Afterset's capture pages.** This approach delivers the fastest possible load times (zero compute overhead), costs $0/month through 2M loads, survives burst traffic without cold starts, and requires no framework or runtime dependencies. The entire capture page — styled, accessible, with inline SVG icons and a form handler — compresses to **~3–4KB via Brotli**, fitting comfortably within a single TCP initial congestion window (14KB). On slow 3G with 400ms RTT, total page load lands at **~1.8 seconds** on a cold connection, the tightest achievable result given physics. The critical insight: connection overhead alone (DNS + TCP + TLS 1.3) consumes 1,200ms — **no rendering strategy can beat this floor**, so the architecture must add near-zero processing time on top.

---

## 1. Rendering strategy comparison reveals a clear winner

Every strategy must contend with the same irreducible network overhead on slow 3G (300 Kbps, 400ms RTT): DNS resolution (400ms), TCP handshake (400ms), and TLS 1.3 handshake (400ms) total **1,200ms before a single byte of HTML arrives**. This means the <1s FCP target is physically impossible on a fully cold first request for any strategy. What differentiates them is server-side processing time and cold start risk.

The six strategies cluster into three tiers. **Tier 1 (optimal)**: Fully static CDN files and SSG add near-zero processing (~5ms TTFB), producing a total load of ~1,818ms for an 8KB page. **Tier 2 (viable)**: Edge+KV and edge-side rendering add 20–100ms of edge compute, landing at ~1,830–1,910ms. **Tier 3 (fails targets)**: SSR and ISR-on-cache-miss add 200–800ms of server processing, pushing total load past 2 seconds and introducing cold start risk after idle periods.

| Strategy | TTFB (server) | Total load (8KB, cold 3G) | Cold start risk | Cost @ 2M/mo | Edit-to-live | Solo dev complexity |
|---|---|---|---|---|---|---|
| **Fully static HTML on CDN** | ~5ms | **~1,818ms ✅** | **Zero** | **$0–2** | 5–30s | Low |
| SSG (pre-built, CDN) | ~5ms | ~1,818ms ✅ | None (compute) | $0–20 | 2–30 min (rebuild) | Moderate |
| Static HTML + Edge KV | 20–50ms | ~1,830–1,860ms ✅ | Very low | ~$5 | ~60s (KV propagation) | Low–moderate |
| Edge-side rendering | 50–100ms | ~1,870–1,910ms ✅ | Low (CF Workers) | $5–20 | 0–60s | Moderate |
| ISR (cache hit) | ~5ms | ~1,818ms ✅ | **High on miss** | $20–30 | 1–10s | Moderate–high |
| ISR (cache miss) | 200–400ms | ~2,100ms ❌ | High | $20–30 | 1–10s | Moderate–high |
| SSR (origin) | 200–800ms | ~2,100–2,600ms ❌ | **Very high** | $20–40 | Instant | Moderate |

The burst scenario (zero traffic for days, then 100–500 hits in 60 seconds) is the decisive factor. After days of inactivity, **ISR and SSR trigger cold serverless function starts of 250ms–3,000ms** on Vercel (REPORTED — OpenStatus benchmarks, GitHub discussions). The first fan in the venue gets a 3–5 second load. Static CDN files have zero cold start risk — the worst case is a CDN edge cache miss adding 50–150ms for an origin fetch, after which every subsequent request is edge-cached. [INFERRED from standard CDN behavior]

**About the <1s FCP target**: it requires at least one of these conditions — cached DNS (eliminates 400ms), TLS session resumption or 0-RTT (eliminates 400ms), or HTTP/3 QUIC (combines TCP+TLS into 1 RTT, saving 400ms). During a concert burst, after the first few fans load the page, the cellular carrier's DNS resolver caches the lookup, bringing subsequent fans' FCP to ~1,260ms. With HTTP/3 0-RTT for any returning visitor: ~860ms. [VERIFIED — protocol specifications]

---

## 2. How competitors serve their pages

Research into six platforms revealed limited technical transparency but important strategic insights. Most competitors block automated page inspection (403 responses), and none publicly document venue-specific performance optimization — a clear differentiation opportunity for Afterset.

**Linktree** is the most technically documented competitor. It runs on **AWS infrastructure with TypeScript/Node.js** backend (VERIFIED — job listings explicitly require AWS + Terraform/CDK experience). Marketing pages use Gatsby SSG with React (VERIFIED — `/_gatsby/image/` URLs and base64 LQIP placeholders found in page source). Profile pages for 41M+ users likely use SSR or hybrid SSR/SSG with aggressive caching. Linktree acquired Koji in December 2023 and Bento in June 2023, consolidating the link-in-bio market. Their engineering blog exists but focuses on data pipeline and organizational content, not performance architecture. [VERIFIED — engineering blog fetched]

**SET.Live** (by Music Audience Exchange / MAX) is the most direct competitor for the concert venue use case. It is **deliberately "100% web-based and completely app-less"** — a design choice driven by the same venue constraints Afterset faces (VERIFIED — Hypebot, A2IM, BusinessWire). The platform has been used at nearly 2,000 concerts by artists including Alicia Keys, John Legend, and Jelly Roll. MAX acquired AMAP.to (a link-in-bio tool for musicians) in March 2023. However, no public documentation of venue-specific technical optimizations exists — no published page weights, loading strategies, offline fallbacks, or performance budgets. [UNKNOWN — specific technical approach]

**Feature.fm** serves smart links that redirect users to streaming platforms — primarily redirect/landing pages rather than full SPAs. Smart links must be extremely fast by nature (users expect instant redirects), but no technical architecture details are publicly available. [UNKNOWN]

**Beacons.ai** returns strong 403 bot protection, preventing inspection. The platform uses React (INFERRED — GitHub clone repository). It offers AI-powered features (auto-generation, media kits) that likely add significant JS weight. [INFERRED]

**Stan Store** focuses on creator commerce with drag-and-drop builder. Pricing at $29–99/month with zero transaction fees. No engineering documentation found. [UNKNOWN — tech stack]

**Koji** was acquired by Linktree in December 2023 and **fully shut down on January 31, 2024** (VERIFIED — withkoji.com, TechCrunch). No live pages remain to analyze.

The competitive gap is clear: **no platform in this space publicly documents concert/venue performance optimization**. None were found to use service workers for offline fallback. SET.Live's app-less approach validates the market need but leaves the technical execution opaque. An Afterset page that demonstrably loads in under 2 seconds on venue cellular while competitors load in 5–10+ seconds is a concrete differentiator.

---

## 3. Payload budget breakdown proves the 14KB target is trivially achievable

The single most important finding in this analysis: a complete, professional, accessible fan capture page with 7 inline SVG platform icons, CSS gradient background, form with JavaScript enhancement, and responsive design compresses to **~2.5–3.5KB after Brotli**. That is 4–6× smaller than the 14KB TCP initial congestion window, meaning the **entire page arrives in a single round trip** after TTFB.

| Component | Minimum (14KB target) | Maximum (50KB budget) | Notes |
|---|---|---|---|
| HTML structure | 1,200B | 1,500B | Semantic, accessible, real URLs |
| Inline CSS (`<style>`) | 950B | 1,200B | Gradient, card layout, form, buttons, responsive |
| Inline JS (`<script>`) | 0B (plain `<form>`) | 500B (fetch + validation + offline queue) | `<form action>` works without JS |
| Inline SVG icons (7) | 2,100B | 3,500B | ~300–500B per optimized brand icon |
| Custom web font | 0B (system stack) | 20,000B (Inter 400 Latin woff2) | System fonts look professional, cost 0 bytes |
| Background image | 0B (CSS gradient) | 12,000B (optimized WebP) | `linear-gradient()` costs ~60B of CSS |
| Analytics | 0B (server-side) | 1,000B (Plausible) | Track via API POST endpoint |
| **Total uncompressed** | **~4,250B** | **~39,700B** | |
| **After Brotli (text)** | **~2,200B** | **~3,500B** (text only) | ~50–55% reduction on small files |
| **Total transfer** | **~2,200B** | **~36,500B** | Including binary assets |

**System fonts are the single largest optimization.** A single weight of Inter (Latin subset, woff2) costs **16–20KB** (REPORTED — Google Fonts, fontsource). A variable Inter font costs **~70KB** (VERIFIED — naiyerasif.com measurement). The system font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`) costs zero bytes and renders instantly — Roboto is pre-installed on every Android device, which is the primary target platform. [VERIFIED]

**Inline SVG icons are efficient and necessary.** Optimized brand icons run 200–500 bytes each (VERIFIED — Bootstrap Icons Spotify SVG measured at ~510B; Bytesize Icons average 116B for simple stroke icons). Seven icons total ~2.5–3.5KB uncompressed. Running through SVGO/SVGOMG reduces icons by 14–50%. Icon fonts (Font Awesome) would add 50–100KB+ of overhead — completely unacceptable. [VERIFIED]

**CSS gradients eliminate the need for background images entirely.** A `linear-gradient(135deg, #667eea, #764ba2)` costs ~60 bytes of CSS versus 5–40KB for an image. In dark venues with low screen brightness, a smooth gradient on a near-black background looks equally professional. [VERIFIED]

**JavaScript is optional but cheap.** A plain HTML `<form action="/api/capture" method="POST">` works without any JavaScript — the browser handles the POST natively. For enhanced UX (inline success state, no page navigation), a minimal `fetch()` handler runs ~300 bytes minified. Adding localStorage offline queue and basic validation brings it to ~500 bytes. [INFERRED]

**Third-party analytics are unnecessary.** Track page loads server-side via the form submission API (zero client bytes). If client-side analytics are required, **Plausible at <1KB** is the only acceptable option — Google Analytics 4 at 45KB+ would consume nearly the entire budget. [VERIFIED — Plausible documentation]

**Compression at these sizes**: Brotli provides ~50–55% reduction on 5KB files versus ~70% on larger files. The compression is less efficient at tiny sizes due to fixed header overhead and limited pattern data, but the absolute file is already so small it doesn't matter. **Pre-compress at build time with Brotli level 11** for maximum compression with zero runtime CPU cost. [VERIFIED — Cloudflare blog, Wikipedia/Brotli]

---

## 4. Infrastructure options evaluated with hard numbers

All six infrastructure configurations handle 500 concurrent requests and meet the burst pattern requirement. The differentiators are cost, cold start behavior, edit-to-live latency, and operational complexity for a solo developer.

| Configuration | Cost @ 2M/mo | TTFB (typical) | TTFB (worst) | Edit-to-live | Cold start | Solo dev complexity |
|---|---|---|---|---|---|---|
| **Cloudflare R2 + CDN (no Workers)** | **$0** | 20–40ms | 150ms | 2–10s | **Zero** | Low–medium |
| Bunny CDN + Storage | $1–2 | 15–30ms | 80ms | 2–5s | Zero | Low |
| Cloudflare Workers + KV | $5 | 10–30ms | 100ms | ≤60s | Near zero | Medium |
| AWS S3 + CloudFront | $0* | 30–60ms | 300ms | 1–15 min | Zero | High |
| Next.js ISR on Vercel | $20–21 | 30–80ms | 800ms† | 1–5s | Medium† | Low |
| Vercel Edge Functions | $20–22 | 20–50ms | 150ms | <2s | Low | Low–medium |

*Free tier; † ISR cache miss triggers serverless cold start*

**Cloudflare R2 + CDN is the recommended launch architecture.** R2's free tier includes 10M Class B reads/month and **zero egress fees** (VERIFIED — Cloudflare R2 pricing). At 2M loads/month with ~50MB of stored HTML files, everything stays within free allocations. The CDN caches files at 330+ edge locations. Cache purging via the Cloudflare API propagates in seconds. No Workers, no functions, no compute — just static file serving. The only limitation: no automatic `index.html` resolution (need explicit paths like `/c/artist-slug`). [VERIFIED]

**Bunny CDN + Storage deserves serious consideration.** At $0.01/GB bandwidth with no per-request fees and a $1/month minimum, it costs ~$1–2/month at 2M loads. Bunny consistently ranks #1 on CDNPerf benchmarks with **sub-25ms average global latency** across 119 PoPs (REPORTED — bunny.net, CDNPerf). Edge Storage replication gives ~41ms first-byte (VERIFIED — Bunny benchmark). Deployment is simple: upload via FTP/SFTP/HTTP API, purge via API. For a solo developer who values simplicity and best-in-class performance, Bunny is compelling. [VERIFIED — bunny.net pricing]

**Cloudflare Workers + KV ($5/month) is the graduation path** when dynamic logic is needed — A/B testing, geo-personalization, or real-time data injection. The Worker reads artist data from KV, injects it into an HTML template string, and returns the complete page. KV reads at edge are sub-millisecond when cached, up to 30–50ms on a miss. The trade-off is **KV's eventual consistency model: writes propagate globally in up to 60 seconds** (VERIFIED — Cloudflare KV documentation). Workers claim "zero cold starts" by preloading isolates during the TLS handshake (~5ms isolate load), though community reports show 50–250ms first-request latency for idle Workers. [VERIFIED — Cloudflare blog; REPORTED — community forum]

**AWS S3 + CloudFront is operationally over-complex for a solo developer.** IAM roles, bucket policies, CloudFront distribution configuration, SSL certificate management, and DNS setup create unnecessary overhead. Cache invalidation takes **1–15 minutes** (REPORTED), the worst edit-to-live latency of any option. The free tier is generous (1TB/month, 10M requests), but AWS's pricing page complexity itself is a tax on development time. [VERIFIED — AWS documentation]

**Vercel ($20/month) is the convenience premium.** ISR provides excellent developer experience — `git push` deploys automatically, on-demand revalidation updates pages in 1–5 seconds. But the **cold start problem is real**: after days of zero traffic, an ISR cache miss triggers a serverless function with cold starts of 250ms–1,500ms at P50, potentially 2–7 seconds in worst cases (REPORTED — OpenStatus benchmarks, GitHub vercel/vercel#7961). The first fan at a show could wait 3–5 seconds. At 4× the cost of Cloudflare with worse cold start behavior, Vercel only makes sense if the rest of the Afterset platform already lives there. [REPORTED]

**The build pipeline for static options** is straightforward: artist edits page in SaaS dashboard → backend saves to database → webhook triggers a build script (Node.js, ~100 lines) → script generates complete HTML file from template + artist data → uploads to R2/S3/Bunny via S3-compatible API → purges CDN cache. Total edit-to-live: 2–15 seconds depending on CDN purge speed.

---

## 5. Venue-specific technical concerns and mitigations

The hostile RF environment at indoor music venues — concrete walls, basements, hundreds of phones competing for limited cell tower bandwidth — demands specific technical countermeasures beyond standard web performance optimization.

### Same-origin serving saves 400ms

DNS resolution costs 1+ RTT (400ms+) per unique domain on slow 3G. If the capture page lives at `afterset.net/c/artist-slug` and the form POSTs to `api.afterset.net`, that's **two DNS lookups: 800ms+ of overhead**. Serving both page and API from the same origin (`afterset.net/c/[slug]` for pages, `afterset.net/api/capture` for POST) eliminates the second lookup entirely, saving 400ms. If a separate API domain is unavoidable, include `<link rel="preconnect" href="https://api.afterset.net">` as the first element in `<head>` to parallelize the second DNS+TCP+TLS with page rendering. [VERIFIED — networking fundamentals, web.dev]

### Direct URLs in QR codes, never shorteners

A URL shortener (bit.ly, etc.) adds a redirect that costs **800ms+ on slow 3G**: DNS for the shortener domain (400ms) plus the redirect RTT (400ms). The QR code must contain the direct final URL. QR codes can encode ~2,900 characters — a URL like `https://afterset.net/c/artist-slug` is trivially short. [INFERRED — protocol math]

### The complete QR scan-to-render chain

| Step | Action | Duration | Running total |
|---|---|---|---|
| 1 | Camera decodes QR | 100–300ms | ~200ms |
| 2 | OS preview banner / user tap | 200–500ms | ~500ms |
| 3 | Browser opens (cold) | 100–500ms | ~800ms |
| 4 | DNS resolution | 400–600ms | ~1,300ms |
| 5 | TCP + TLS 1.3 | 800ms (2 RTT) | ~2,100ms |
| 6 | HTTP request + TTFB | 50–200ms | ~2,300ms |
| 7 | HTML download (5KB compressed) | ~130ms | ~2,430ms |
| 8 | Parse + FCP | 50–100ms | ~2,500ms |

**Realistic scan-to-FCP: 2.5–4 seconds** depending on device and browser state. With HTTP/3 (QUIC combining TCP+TLS into 1 RTT, saving 400ms) and cached DNS: **~1.5–2 seconds**. iOS adds latency — the Camera app shows a URL preview banner requiring a tap. Android cameras auto-detect QR and open Chrome directly. In-app browsers (Instagram, TikTok WebViews) have cold DNS caches and no pre-warmed connections — expect worst-case timings. [INFERRED from protocol specifications; REPORTED — Apple/Android documentation]

### Offline resilience through localStorage-first submission

Service Workers can intercept form POSTs and queue them for retry, but there's a critical **race condition on first visit**: if connectivity drops after HTML loads but before `sw.js` downloads, the SW never installs. The more reliable pattern:

1. On form submit, intercept with JS (`event.preventDefault()`)
2. Attempt `fetch()` POST to API with a 10-second `AbortController` timeout
3. Regardless of network result, serialize form data to `localStorage` immediately
4. Show success UI ("You're in! ✅") — the fan sees confirmation before the network responds
5. On `online` event or visibility change, retry any pending submissions
6. On next page load, check localStorage for unsent submissions

**Background Sync API** provides automatic retry when connectivity returns, but it's **Chromium-only** — Chrome for Android, Samsung Internet, and Edge support it; Safari and Firefox do not (VERIFIED — caniuse, MDN). For the target audience (mid-range Android phones at concerts), Chromium coverage is sufficient for progressive enhancement, but localStorage is the reliable baseline. [VERIFIED — W3C spec]

### HTTP/3 and TLS 1.3 are table stakes

TLS 1.3 saves **400ms over TLS 1.2** (1 RTT vs 2 RTT handshake) — that's 20% of a 2-second budget. HTTP/3 (QUIC) goes further: it combines transport and crypto handshakes into 1 RTT and eliminates head-of-line blocking, meaning **packet loss on one stream doesn't stall others**. On lossy venue networks with high packet loss, QUIC's smarter congestion control and connection migration (survives WiFi↔cellular switching) provide measurable resilience. [VERIFIED — RFC 9114, QUIC specification]

All evaluated CDNs now support both: **Cloudflare enables TLS 1.3 and HTTP/3 by default** (96% of CDN requests use TLS 1.3 as of 2025 per the Web Almanac). CloudFront, Bunny, and Vercel also support both protocols. Chrome for Android, Samsung Internet, and Firefox for Android all support HTTP/3. [VERIFIED — Web Almanac 2025, Cloudflare blog]

### Page size directly impacts success probability in congested RF

When hundreds of phones compete for limited cell tower bandwidth, effective per-user throughput can drop to **50–100 Kbps**. At 2% packet loss, a 1-packet page has 98% delivery probability; a 10-packet page drops to ~82%. At 5% loss: 95% vs 60%. **Every kilobyte eliminated improves the probability a fan successfully loads the page.** A 3KB compressed page requires ~2 TCP segments; a 50KB page requires ~35. The math strongly favors the smallest possible payload. [INFERRED — probability calculation from networking fundamentals]

### Dark theme is non-negotiable

Fans hold phones at **10–30% brightness** in dark venues. Design must maximize contrast: pure black (#000000) background, white (#FFFFFF) text, high-saturation bright accent colors for CTA buttons. WCAG requires 4.5:1 minimum contrast; aim for **7:1+ given dim screens**. Minimum touch targets of 48×48px (fans navigating in dark, crowded conditions). Font size minimum 16px body, 20px+ form labels. Never use subtle grays — they vanish on dim screens. [VERIFIED — WCAG spec, Material Design guidelines]

---

## 6. Recommended architecture: launch and scale

### Launch (0–50K loads/month): Pure static on Cloudflare R2

The simplest possible architecture. A Node.js build script (~100 lines) reads artist data from the database, renders complete HTML files from a template, and uploads them to Cloudflare R2 via the S3-compatible API. Cloudflare's CDN caches and serves them globally. Cost: **$0/month**.

- **Page serving**: `afterset.net/c/[slug]` → Cloudflare CDN → R2 origin
- **Form submission**: `afterset.net/api/capture` → Cloudflare Worker (free tier: 100K requests/day) → database
- **Edit flow**: Artist saves → webhook → build script generates HTML → upload to R2 → purge cache via Cloudflare API → live in 5–10 seconds
- **DNS**: Single domain, Cloudflare DNS (free), eliminates extra DNS lookups

### Scale (50K–2M+/month): Add Workers + KV when needed

When dynamic features justify it (A/B testing, geo-targeted content, real-time analytics injection), move the template into a Cloudflare Worker reading from KV. The Worker assembles HTML at edge in 5–30ms. Cost increases to **$5/month**. The migration is minimal: move the template string into the Worker, write artist data to KV instead of R2, and update the DNS routing.

### If the platform is already on Vercel

Use Next.js ISR with aggressive static caching and on-demand revalidation. Accept the $20/month cost and mitigate cold starts by setting ISR `revalidate` times conservatively. Consider a hybrid: Vercel for the dashboard/API, Cloudflare R2 for capture page serving only.

---

## 7. Prototype specification

### HTML structure (complete, production-ready)
```html
<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#000">
<title>{{ARTIST_NAME}}</title>
<link rel="preconnect" href="https://afterset.net">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{min-height:100vh;display:flex;align-items:center;
justify-content:center;font-family:-apple-system,BlinkMacSystemFont,
"Segoe UI",Roboto,sans-serif;background:{{BG_GRADIENT}};color:#fff}
.c{text-align:center;padding:2rem;max-width:400px;width:100%}
h1{font-size:2rem;margin-bottom:.5rem}
p{margin-bottom:1.5rem;opacity:.9;font-size:1.1rem}
form{display:flex;gap:.5rem;margin-bottom:1.5rem}
input[type=email]{flex:1;padding:.75rem 1rem;border:0;
border-radius:.5rem;font-size:1rem;color-scheme:dark;
background:#1a1a1a;color:#fff}
button{padding:.75rem 1.5rem;border:0;border-radius:.5rem;
background:{{ACCENT}};color:#000;font-weight:700;font-size:1rem;
cursor:pointer;min-width:80px;min-height:48px}
.lk{display:flex;gap:1rem;justify-content:center;flex-wrap:wrap}
.lk a{display:inline-flex;align-items:center;justify-content:center;
width:48px;height:48px;border-radius:50%;
background:rgba(255,255,255,.15);color:#fff;text-decoration:none}
svg{width:22px;height:22px;fill:currentColor}
#ok{padding:1rem;background:rgba(255,255,255,.2);
border-radius:.5rem;margin-bottom:1rem}
[hidden]{display:none}
@media(max-width:480px){form{flex-direction:column}
button{width:100%}}
</style></head><body><div class="c">
<h1>{{ARTIST_NAME}}</h1>
<p>{{VALUE_EXCHANGE_MESSAGE}}</p>
<div id="ok" hidden>Thanks! You're on the list. 🎵</div>
<form id="f" action="/api/capture" method="POST">
<input type="hidden" name="artist" value="{{ARTIST_ID}}">
<input type="email" name="email" placeholder="your@email.com"
 required aria-label="Email address" autocomplete="email">
<button type="submit">Join</button></form>
<div class="lk">
{{PLATFORM_LINKS_WITH_INLINE_SVG}}
</div></div>
<script>
const f=document.getElementById('f'),ok=document.getElementById('ok');
f.onsubmit=e=>{e.preventDefault();const d=new FormData(f);
const j=Object.fromEntries(d);
try{localStorage.setItem('_q',JSON.stringify(j))}catch(e){}
f.hidden=!0;ok.hidden=!1;
fetch('/api/capture',{method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify(j),keepalive:!0}).then(r=>{
if(r.ok)localStorage.removeItem('_q')}).catch(()=>{})};
try{const q=localStorage.getItem('_q');
if(q)fetch('/api/capture',{method:'POST',
headers:{'Content-Type':'application/json'},
body:q,keepalive:!0}).then(r=>{
if(r.ok)localStorage.removeItem('_q')}).catch(()=>{})}catch(e){}
</script></body></html>
```

### Expected byte counts

| Component | Uncompressed | After Brotli 11 |
|---|---|---|
| HTML structure + meta | ~600B | — |
| Inline CSS | ~1,000B | — |
| Inline JS (fetch + localStorage offline queue) | ~550B | — |
| Inline SVG icons (4 platform + 3 social) | ~2,800B | — |
| Template variables (artist name, URLs, colors) | ~400B | — |
| **Total document** | **~5,350B** | **~2,800–3,200B** |

**Fits in 14KB initial congestion window**: yes, with ~11KB to spare. [INFERRED]

### Test criteria

- **Primary benchmark**: WebPageTest, slow 3G profile (300 Kbps, 400ms RTT), Moto G Power, Chrome
- **Pass criteria**: Total load <2,000ms, FCP <1,000ms on warm DNS, total transfer <14KB
- **Burst test**: k6 or Artillery, 500 concurrent requests to a single capture page URL, verify all return 200 with <100ms TTFB
- **Offline test**: Load page on throttled connection, disable network, submit form, re-enable network, verify submission reaches API
- **Device test**: Chrome for Android on a Moto G (2020 or older), Samsung Internet on Galaxy A series, at real venue during soundcheck
- **Contrast test**: Screenshot at 10% screen brightness, verify all text and buttons are legible

### What you explicitly give up at 14KB

No custom web fonts (system stack only). No background images (CSS gradients only). No client-side analytics (server-side tracking via API). No external CSS or JS files (everything inline). No third-party scripts of any kind. No framework runtime (no React, no Next.js client bundle). **What you keep**: professional gradient styling, responsive layout, accessible form, 7 branded SVG platform icons, inline offline-resilient form handler, instant success feedback.

---

## Conclusion

The architecture decision for Afterset's capture pages is unusually clear-cut. The page is read-once, submit-once, close — a use case that needs no framework, no client-side routing, no hydration, and no JavaScript bundle. **Pre-built static HTML files on Cloudflare R2, served through Cloudflare's CDN with HTTP/3 and TLS 1.3, deliver the fastest possible load time at zero cost.** The entire page fits in a single TCP congestion window at ~3KB compressed, meaning fans receive the complete rendered page in one round trip after TLS completes.

Three non-obvious findings emerged from this research. First, the **connection overhead floor of 1,200ms on cold slow 3G** means the rendering strategy choice only controls ~600ms of the budget — optimizing the network chain (same-origin serving, no redirects, HTTP/3) matters more than any server-side architecture decision. Second, **no competitor in this space has published venue-specific performance optimization work** — SET.Live validates the market but leaves the technical execution undocumented, creating a genuine differentiation opportunity. Third, the **localStorage-first submission pattern is more reliable than Service Workers** for first-visit fans, because it works immediately without registration delay and covers all browsers, not just Chromium.

The migration path is clean: start with static R2 files at $0/month, add a Cloudflare Worker + KV at $5/month when dynamic features justify it, and never touch Vercel/AWS unless the rest of the platform requires it. At 2M loads/month, the capture page infrastructure costs less than a cup of coffee.