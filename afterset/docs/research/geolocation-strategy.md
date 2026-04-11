# Location tracking strategy for Afterset

**The single strongest move Afterset can make is to skip fan-side geolocation entirely.** Artist-side venue tagging at gig creation delivers 80–90% of the analytics value at near-zero legal cost, zero conversion risk, and zero added JavaScript on the capture page. The remaining 10–20% — confirming physical presence — is not worth the permission friction, in-app browser breakage, or privacy-law surface area for a bootstrapped solo founder operating on $50/month.

---

## Section 1 — Geolocation provider comparison

### Findings

Google restructured Maps Platform pricing on **March 1, 2025**, replacing the universal $200/month credit with per-SKU free usage caps [VERIFIED — Google Maps Platform pricing page, updated 2026-04-09]. The relevant SKU for resolving lat/lng to a venue is **Nearby Search Pro**, which carries a 5,000 requests/month free tier and costs **$32 per 1,000 requests** beyond that [VERIFIED — Google billing docs]. Place Details Essentials (IDs Only) and Text Search Essentials (IDs Only) are **unlimited and free**, meaning once you have a `place_id` cached, refreshing venue metadata costs nothing [VERIFIED — same source]. Google's ToS permits storing `place_id` indefinitely but restricts caching of other content; lat/lng may be cached for **30 days maximum** [VERIFIED — Google Maps Service Terms].

Mapbox's Temporary Geocoding API offers **100,000 free requests/month** with POI data powered by Foursquare's 105M+ venue database [VERIFIED — Mapbox pricing page; Foursquare partnership announcement]. The catch: results **cannot be stored or cached** under the Temporary API ToS [VERIFIED — Geocodio comparison]. The Permanent API ($5/1,000 requests) allows storage but strips out all POI data — it returns addresses only, not venue names [VERIFIED — Mapbox Search docs]. This makes Mapbox usable for real-time lookups but not for building a persistent venue database.

Nominatim's public instance enforces a hard **1 request/second** rate limit with no commercial SLA [VERIFIED — OSM Foundation usage policy]. Self-hosting requires **64–128 GB RAM** and costs $100–300/month for a US-only extract, blowing the budget [VERIFIED — Nominatim 5.3.0 installation docs]. OSM does tag `amenity=music_venue`, but usage is extremely sparse — most indie venues are tagged generically as `bar` or `pub` without a `live_music=yes` qualifier [VERIFIED — OSM Wiki Tag:amenity=music_venue].

For indie-venue POI completeness, **Google leads decisively** because Google My Business listings cover even small bars and clubs. Foursquare/Mapbox ranks second due to its check-in heritage in nightlife. OSM trails significantly for this category [INFERRED — SafeGraph analysis; Mappr comparison].

### Comparison table

| Dimension | Google Places (New) | Mapbox Temporary | Nominatim (Public) |
|---|---|---|---|
| Free tier | 5K Nearby Search/mo; 10K Geocoding/mo | 100K requests/mo | Unlimited (1 req/sec) |
| Cost at 500/mo | **$0** | **$0** | **$0** |
| Cost at 5K/mo | **$0** | **$0** | **$0** |
| Cost at 50K/mo | **~$1,440** | **$0** | $0 (policy risk) |
| Indie venue POI quality | ★★★★★ | ★★★★ (Foursquare) | ★★ (sparse tagging) |
| Metadata returned | Name, type, hours, rating, photos | Name, category, address | Name, type (if tagged) |
| Caching/storage allowed | `place_id` forever; other data 30 days | **No** (Temporary); Yes but no POIs (Permanent) | Yes (ODbL attribution) |
| Latency | 100–300 ms | 50–100 ms | 200–500 ms |

### Bottom line for Afterset

**Use Google Places as the sole provider at launch, with aggressive `place_id` caching.** At current scale (500 lookups/month), cost is $0. At 5K lookups/month, still $0. The hybrid approach (Mapbox first, Google fallback) sounds appealing but is undermined by Mapbox's no-storage restriction — you'd need a fresh API call every time for the same venue. Instead, resolve each venue once via Google Nearby Search, cache the `place_id` in Supabase, and use free Place Details (IDs Only) for future lookups. Since indie musicians play the same 5–20 venues repeatedly, your effective Google call volume stays well under the free tier even at 50K fan captures/month. The do-nothing baseline (no reverse geocoding at all) is actually the right call for the fan side — reserve Google Places for the **artist dashboard venue search** only.

### Open questions

- How many distinct venues will Afterset encounter per month? If <500 unique venues, caching alone keeps Google costs at $0 indefinitely
- Does Google's Nearby Search return sufficiently granular type data to distinguish "bar with live music" from "bar without"?
- Will Overture Maps Foundation (Meta/Microsoft open POI dataset, 53M+ POIs) become a viable free alternative in 2026–2027?
- Should Afterset build its own venue database seeded by artist contributions, reducing API dependence entirely?

---

## Section 2 — Browser Geolocation API in indoor venues

### Findings

Indoor positioning relies almost entirely on **Wi-Fi access-point triangulation and cell-tower fallback** because GPS signals are blocked by building structures [VERIFIED — Pointr.tech; Wikipedia Indoor Positioning Systems]. Realistic accuracy indoors is **10–40 meters** with Wi-Fi and **100–1,000+ meters** with cell towers alone [VERIFIED — Digital Matter: "10m to 40m"; TOPFLYtech: "10 to 30 meters"]. The `GeolocationCoordinates.accuracy` property reports a **95% confidence radius** — typical indoor values range from 20–65 meters for Wi-Fi, jumping to hundreds or thousands of meters on initial cell-tower fixes [REPORTED — dev.to/3dayweek developer testing]. Distinguishing two venues 50 meters apart is **not reliably possible** at this accuracy [INFERRED].

Permission UX creates severe friction. iOS Safari uses a **two-layer system** — iOS system-level location services must be enabled for Safari, then Safari shows a per-site prompt that resets each session [VERIFIED — firt.dev iOS 14 analysis]. iOS 14+ added a "Precise Location" toggle; if disabled for Safari, accuracy degrades to **3,000–9,000 meters** [VERIFIED — Gadget Hacks]. Android Chrome 116+ shows a three-option prompt ("Allow this time" / "Allow on every visit" / "Don't allow") [VERIFIED — Chrome Developers blog]. Without a preceding user gesture, Chrome collapses the prompt to a small chip that **auto-dismisses** — effectively an auto-deny [VERIFIED — Chrome Developers permission chip documentation].

The most critical finding for Afterset: **in-app browsers are largely broken for geolocation.** Instagram, TikTok, and Facebook open links in WKWebView (iOS) or system WebView (Android), which require the **host app** to explicitly implement geolocation delegation [VERIFIED — Felix Krause research; Apple Developer Forums]. In practice, geolocation in these WebViews is unreliable or non-functional for third-party sites [INFERRED — from WKWebView restrictions]. Since QR codes at shows are frequently shared and opened via social apps, this is a dealbreaker.

Chrome telemetry shows **~85% of permission prompts are dismissed or ignored** on the web. Without a user gesture, only **12%** of prompts are accepted; with a gesture, this rises to ~30% [VERIFIED — web.dev, Chrome Developers blog]. No direct A/B data exists on geolocation prompts reducing form completion rates, but Chrome's UX team calls unprompted permission requests a "very jarring experience" [VERIFIED — web.dev]. Nielsen Norman Group research confirms users perform an **implicit cost-benefit analysis** — and the fan gets zero benefit from sharing location [VERIFIED — NN/g].

`getCurrentPosition` is fully **asynchronous** and does not block the main thread [VERIFIED — MDN]. With `enableHighAccuracy: false` and a 5-second timeout, a fix typically arrives in **1–5 seconds** indoors [INFERRED — MDN examples; developer reports]. If triggered after email submission, it does not impact the 10-second capture flow.

**Fallback options**: IP geolocation resolves to the correct city for mobile users only **40–65%** of the time — mobile carrier IPs often route to regional hubs hundreds of miles away [VERIFIED — MaxMind; infosniper.net]. The capture page URL slug (e.g., `/artist/venue-2026-04-11`) provides **100% accurate** venue attribution with zero friction, zero JavaScript, and universal browser support [INFERRED — architectural analysis].

### Strongest counterargument to requesting fan location

**You are asking users for less accurate data that you already have.** The venue is known at gig-creation time and encoded in the page URL or metadata. Browser geolocation at best gives you coordinates accurate to 10–40 meters indoors — which still require reverse geocoding to resolve to the same venue name the artist already entered. Meanwhile, you've added a permission prompt that 70–85% of users will dismiss, broken the flow in Instagram/TikTok WebViews, added 2KB+ of JavaScript to a 3–5KB page, and introduced timeout/error handling complexity. The fan gets nothing in return.

### Bottom line for Afterset

**Do not request geolocation from fans.** Use the capture page slug or gig association as the venue signal — it's deterministic, universal, and zero-friction. If you want a supplementary geographic signal, capture the fan's **IP address server-side** (no prompt, no JS) and resolve it to an approximate city via a free service like MaxMind GeoLite2. This adds no user-facing friction and stays under the "imprecise geolocation" legal threshold.

### Open questions

- What percentage of Afterset's QR scans open in in-app browsers vs. native Safari/Chrome? This determines the ceiling on geolocation viability
- Would a post-submission opt-in ("Tag your city for this show?") with a simple city dropdown outperform browser geolocation?
- Does IP geolocation accuracy improve if Afterset deploys Cloudflare Workers (which receive `cf-ipcity` headers automatically)?
- How often do fans sign up remotely (not at the show) via shared links — and does this skew venue attribution?

---

## Section 3 — Capacitor Geolocation vs. Web API

### Findings

On web, `@capacitor/geolocation` simply **re-routes to `navigator.geolocation`** — it provides zero advantage over the standard browser API [VERIFIED — Capacitor official docs]. Native benefits (fused location providers, background tracking, geofencing) only apply inside a compiled native app shell. For a one-shot location lookup in an urban setting, native and web accuracy are **functionally equivalent** [VERIFIED — Android developer docs; multiple expert sources].

The artist dashboard use case — searching for a venue by name — is a **text search problem, not a GPS problem**. Google Places Autocomplete accepts text input and returns venue predictions using **IP-based biasing by default** — no location permission required [VERIFIED — Google Places Autocomplete docs]. Adding a "Use my location" button is trivially handled by the Web Geolocation API without Capacitor.

Apple's App Store guideline 5.1.1 requires clear justification for location permissions, and Apple **actively rejects** apps where location isn't essential [VERIFIED — Apple Developer Forums]. A dashboard with venue name search would be hard to justify. Google Play requires foreground location to be relevant to core functionality [VERIFIED — Google Play developer policy]. Both stores add **$99/year** (Apple) and $25 one-time (Google) in fees, plus provisioning profiles, privacy manifests, Xcode/Android Studio build pipelines, and review cycles [VERIFIED — official store policies].

### Bottom line for Afterset

**Web is sufficient. Do not build a Capacitor app for location features.** Implement Google Places Autocomplete in the React SPA for venue search — it works without any device permissions, returns `place_id` + name + address + lat/lng, and requires zero native code. The overhead of maintaining two native projects, navigating store reviews, and paying annual fees is unjustified. Revisit Capacitor only if push notifications, offline support, or NFC scanning become requirements.

### Open questions

- Would a PWA with web push notifications cover the next tier of native-app requirements without Capacitor?
- Does the Google Places Autocomplete (New) session-based pricing stay within budget at scale?
- If Afterset later builds a fan-facing app (not just capture pages), does that change the Capacitor calculus?

---

## Section 4 — Session detection patterns

### Findings

**Foursquare** (Movement SDK, formerly Pilgrim) uses the most sophisticated approach: ML-based stop detection from multi-sensor data (GPS, Wi-Fi, Bluetooth, accelerometer), combined with a **gradient-boosted decision tree** ("Snap-to-Place") trained on 16B+ labeled check-ins [REPORTED — Foursquare engineering blog]. It models each venue as a probabilistic signal cloud that varies by time of day. Arrival and departure events fire automatically. This system requires **"Always On" background location**, native SDK integration, and enterprise licensing [VERIFIED — Foursquare SDK docs].

**Google Maps Timeline** uses fused location providers with activity recognition (still, walking, driving) to detect discrete visits with arrival/departure times. A 2025 study found **~72% mean location coverage** with a 200-meter distance threshold [REPORTED — ScienceDirect study]. It requires precise background location and is throttled to **"a few times per hour"** on Android 8.0+ to preserve battery [VERIFIED — Android developer docs]. As of late 2024, Timeline moved to **on-device-only storage** [VERIFIED — Google support docs].

**Square and Clover** POS systems do **not** offer customer proximity detection or geofencing for session management. Square requires device location for fraud prevention and transaction verification only [VERIFIED — Square support docs]. BLE beacons exist in retail (Macy's, Target) but require custom hardware and native apps — inapplicable for Afterset [VERIFIED — retail technology sources].

**Bandsintown and Songkick** use **zero location-based attendance verification**. Event-fan association is entirely based on RSVPs ("I'm going"), ticket purchases, and artist-fan matching via music taste. Attendance is self-reported [VERIFIED — Bandsintown docs; Songkick API docs].

### Bottom line for Afterset

**Do not build session detection.** The entire concept is architecturally unnecessary for Afterset's use case. A "session" is already defined by the gig itself — it has a known venue, a known date, and a bounded time window. Fan captures during that window are attributed to that gig. No geofencing, no arrival/departure detection, no continuous monitoring needed. The do-nothing baseline (gig = session) is the correct pattern. If you later need to verify physical presence, the simplest approach is comparing the fan's IP-derived city to the venue's city — a server-side check requiring zero client-side code.

### Open questions

- Should Afterset auto-close capture pages after a configurable time window (e.g., 4 hours post-gig start)?
- Would a simple "gig is live" toggle on the artist dashboard serve as manual session control?
- Could ticket-scan integration (Eventbrite, Dice) provide attendance verification without location?

---

## Section 5 — Legal implications of location tracking

### Findings

**Precise geolocation is classified as sensitive personal information** across the major US privacy regimes. Under CCPA/CPRA, the threshold is data locating a consumer within a circle of radius **1,850 feet** (~564 meters) — not 1,750 feet as sometimes reported; the 1,750-foot figure comes from Virginia's VCDPA [VERIFIED — Cal. Civ. Code § 1798.140(w)]. Raw browser GPS coordinates (accurate to ~15–50 feet) far exceed this threshold. CPRA does not require opt-in consent for SPI but mandates a **"Limit the Use of My Sensitive Personal Information"** link, GPC signal compliance, and specific privacy policy disclosures [VERIFIED — Cal. Civ. Code § 1798.121].

Colorado's **SB 25-276** (signed May 23, 2025, effective October 1, 2025) explicitly added precise geolocation to CPA's sensitive data definition at an **1,850-foot** threshold, and requires **affirmative opt-in consent** before collection — stricter than California's opt-out model [VERIFIED — Colorado SB 25-276]. Under GDPR, location data is personal data under Art. 4(1) but **not** special-category data under Art. 9 [VERIFIED — GDPR text]. However, the Article 29 Working Party stated that location data "reveals intimate details about private life" and effectively requires **consent** as the legal basis [REPORTED — WP29 Opinion 13/2011].

**The browser permission prompt alone does not satisfy GDPR consent requirements.** The prompt ("example.com wants to know your location — Allow/Block") does not inform the user about purpose, retention period, controller identity, or withdrawal mechanism — all required under Art. 7 [VERIFIED — Fox Williams analysis; 22Academy guidance]. A separate, purpose-specific consent flow would be needed.

The distinction between data types matters enormously:

| Data type | Crosses "precise" threshold? | Sensitive PI? |
|---|---|---|
| Raw lat/lng from browser | Yes (~15–50 ft) | SPI under CPRA, CPA, VCDPA |
| Venue name + city (artist-entered) | Not device-derived | Not SPI |
| City only | (~10–30 mi) | Not SPI |
| Truncated coords (2 decimal places, ~1.1 km) | (exceeds 1,850 ft) | Not SPI |

A critical legal nuance: even if you immediately discard raw coordinates after resolving to a venue name, **the act of collecting precise geolocation from a device triggers SPI obligations at the moment of collection** under CPRA and CPA [INFERRED — statutory text says "derived from a device"]. Data minimization helps with breach risk but does not eliminate collection-stage obligations.

**The gig-tagging alternative eliminates all location-law triggers.** If the artist selects the venue at gig creation and fan captures are associated by page/timestamp, **no device-derived location data is ever collected from the fan**. This achieves ~80–90% of the analytics value (which venues, which fans, which markets) at ~0–5% of the legal surface area [INFERRED — architectural analysis].

CPRA currently applies to businesses with **>$26.6M revenue or 100K+ California consumers** [VERIFIED — Cal. Civ. Code § 1798.140, CPI-adjusted]. Afterset falls below all thresholds today. But California's AG conducted **investigative sweeps targeting location data practices** in March 2025 [VERIFIED — CA AG office announcement], and pending **AB 1355** would impose strict opt-in for all location data with no business-size exemption [REPORTED — legislative tracking].

### Three risk-tiered recommendations

**CONSERVATIVE (recommended for launch):** No fan location data. Artist tags venue at gig creation. Captures are attributed by page association. Privacy policy covers email + venue analytics. Legal surface area: identical to current email-only collection. Compliance cost: near zero.

**MODERATE:** Add server-side IP geolocation (MaxMind GeoLite2, free) to derive approximate city. No browser prompt. City-level accuracy (~10–30 mi) stays below the 1,850-foot SPI threshold. Still personal data under GDPR (IP = PI) — update privacy policy, consider legitimate interest basis. Low-to-moderate incremental risk.

**AGGRESSIVE (not recommended at current stage):** Collect precise lat/lng via browser API, resolve to venue, discard raw coordinates. Requires: CPRA "Limit" link + GPC compliance, CPA opt-in consent flow, GDPR Art. 7 consent with full Art. 13 disclosures, DPIA, updated privacy policy for all jurisdictions, data subject request handling. Likely requires **$5K–15K in initial legal counsel**. Incompatible with $50/month budget and solo-founder constraints.

### Bottom line for Afterset

**Go CONSERVATIVE at launch, MODERATE when you want city-level fan geography.** The gig-tagging architecture gets you the core insight — which fans were captured at which venues — without triggering sensitive-data obligations in any jurisdiction. Server-side IP geolocation (MODERATE tier) adds approximate fan geography for tour-routing insights later, at minimal legal cost. Collecting precise geolocation from fans is the wrong tradeoff for a bootstrapped platform: high legal cost, moderate technical cost, negligible analytics uplift over simpler alternatives.

### Open questions

- Does California's AB 1355 (Location Privacy Act) advance in 2026, and would it apply to IP-derived city data?
- Under GDPR, does the "legitimate interest" basis hold for IP-based city geolocation on a music fan-capture platform?
- If Afterset expands to the UK post-Brexit, does UK GDPR diverge on location-data treatment?
- At what user scale (100K? 500K?) does engaging privacy counsel become non-optional regardless of data practices?
- Could a fan-facing "What city are you from?" dropdown replace both geolocation and IP lookup with explicit, non-sensitive input?

---

## Synthesis

Afterset's location strategy should follow one principle: **the artist knows the venue; don't ask the fan.** At gig creation, the artist selects the venue via Google Places Autocomplete on the React dashboard — a text search requiring no device permissions, no Capacitor app, and no native builds. This `place_id`, name, and coordinates are stored in Supabase. Every fan capture on that gig's page inherits the venue by association. Zero JavaScript added to the capture page. Zero permission prompts. Zero legal exposure beyond email collection.

For city-level fan geography (phase 2), add server-side IP geolocation via Cloudflare's `cf-ipcity` header or MaxMind GeoLite2 — free, no client code, stays below the SPI threshold. Skip browser geolocation entirely: it's broken in in-app browsers, rejected by ~85% of users, inaccurate indoors, and triggers sensitive-data obligations across three+ privacy regimes. Skip Capacitor: venue search is a text problem. Skip session detection: the gig is the session.

**This strategy costs $0/month in API fees at current scale**, stays within the $50 budget at 50K fans/month (Google Places free tier covers artist-side venue lookups via caching), and keeps the capture page at its current 3–5KB with sub-2-second loads.

## Next steps

1. **Implement Google Places Autocomplete** in the artist dashboard for venue search. Use the Essentials tier (Text Search IDs Only is free and unlimited). Store the resulting `place_id`, venue name, address, and coordinates in a `venues` table in Supabase. Associate each gig with a `venue_id`.

2. **Add `cf-ipcity` extraction** to the Hono API endpoint that processes fan email captures. Cloudflare provides this header automatically on requests through its CDN — zero cost, zero client-side code. Store the city string alongside the email capture as an approximate geographic signal.

3. **Build the per-gig analytics view** showing captures broken down by venue, city, and date. This is the core analytics surface that location data enables — and it's achievable entirely from artist-entered venue data + IP-derived city.

4. **Update the privacy policy** to disclose: (a) email collection for marketing follow-up, (b) IP-derived approximate city for analytics, (c) venue association via artist-entered data. This is straightforward and does not trigger SPI/sensitive-data regimes.

5. **Revisit precise geolocation only if** a specific product feature requires it (e.g., "fans near you right now" for artists at festivals) and after crossing the revenue threshold where privacy counsel is affordable (~$5K initial engagement). Even then, evaluate whether a fan-entered city dropdown achieves the same goal without the legal overhead.
