# How SaaS dashboards split overview from analytics

**The dominant pattern across email, newsletter, link-in-bio, and music tools is a two-tier split: a KPI-forward home screen showing 3–5 aggregate numbers plus recent activity, with detailed per-item analytics living one click deeper.** For products with fewer than 10 core metrics, this split still holds — but the boundary moves. The overview absorbs more, and the analytics tab becomes a "drill-down" layer rather than a separate analytics product. For a mobile-first fan-capture tool used between sets, the research points clearly toward a two-tab model with a specific mental model: **"Tonight" vs. "Over Time."**

---

## Six tools, one recurring architecture

Every tool researched uses some form of split between overview and detail — none present a single monolithic analytics view. But the *nature* of the split varies significantly based on metric volume and product complexity.

**Mailchimp** is the most fragmented. It distributes analytics across **three top-level nav items** (Home, Audience, Analytics) and further subdivides Analytics into a Marketing Dashboard (aggregate trends) and Reports (per-campaign drill-downs). Campaign-level open rates and click rates never appear on the Home screen — they live exclusively in Analytics → Reports. The Home shows only aggregate revenue, audience growth, and recent campaign snapshots. This three-surface architecture reflects Mailchimp's **50+ metrics** across email, ads, social, and e-commerce. On mobile, it collapses to a **4-tab bottom bar** (Home, Audience, Campaigns, Analytics), which proves that even complex products flatten for mobile.

**Beehiiv** is the most instructive comparison. After a major August 2025 redesign, it settled on a dashboard that shows **four KPI cards at the top** — Active Subscribers, Open Rate, CTR, and Earnings — with a global timeframe selector that updates all charts simultaneously. Below those cards: a subscriber growth chart, last-post performance with trend indicators comparing against the prior 10 posts, and acquisition sources. Detailed analytics live in a separate **"Analyze" section** (paid plans only) with three sub-reports: Subscribers, Posts, and Clicks. The critical design choice: **Beehiiv places email engagement metrics (open rate, CTR) directly on the home dashboard as top-line KPIs**, not hidden in a reports section. Growth and engagement data sit side by side. This is the clearest model for a sub-10-metric product.

**Kit (formerly ConvertKit)** takes the opposite extreme — it has **no dedicated analytics nav item at all**. Stats are distributed across functional sections: subscriber growth lives under Grow → Subscribers, email open/click rates live inside Send → Broadcasts (per-email) and as 90-day rolling averages on the Subscribers page. The Omnisend review explicitly notes Kit "doesn't have an analytics hub." This distributed model works for Kit's creator audience but creates friction when you want a quick performance snapshot. It's the anti-pattern to avoid for a "checking between sets" use case.

**Linktree** defaults to the **link editor**, not an analytics view — a notable choice. Analytics live in a dedicated "Insights" tab, structured as a single long scrollable page: lifetime totals at top (Views, Clicks, CTR, Subscribers, Earnings), then activity graph, social platforms, most-clicked links, visitor demographics, and audience growth. Inline click counts appear on each link card in the editor, providing a lightweight bridge between content management and analytics. Linktree's mobile app uses a **bottom tab bar** and explicitly provides analytics access on mobile.

**Bandsintown for Artists** uses a two-tier split closest to what a musician-facing product needs. The home dashboard shows a **30-day performance module** (event views, RSVPs, ticket clicks, new followers) — essentially "what happened recently." The separate Insights section provides deep-dive analytics: tracker growth charts, geographic fan maps, per-event performance, ticket click trends, and social/streaming follower aggregation. The Insights tab activates at 100 followers, suggesting a **progressive disclosure model** where analytics appear only once meaningful data exists. All analytics are downloadable as CSV and described as mobile-friendly.

**Chartmetric** and **Spotify for Artists** represent the industry-tool end of the spectrum. Chartmetric uses 8+ top-level analytics sections with 10+ tabs per artist profile — far too granular for a lightweight SaaS. Spotify for Artists is more relevant: it uses a clean **4-tab structure** (Home, Music, Audience, Profile) with a dedicated mobile app. The January 2026 redesign prioritized "cleaner, action-oriented layout" on the Home tab with release timelines and key performance metrics. For managers, a roster dashboard shows all artists with metrics visible immediately — a pattern worth noting for multi-show management.

---

## Where the split boundary falls for sub-10-metric products

Across these tools, a consistent pattern emerges for where the overview ends and analytics begins:

**The overview/dashboard answers: "What happened recently and how am I doing?"** It shows 3–5 top-line KPIs as large number cards, the most recent content/campaign performance with trend indicators, and a growth chart. Beehiiv's 4-card layout (subscribers, open rate, CTR, earnings) is the gold standard for this layer. The overview is designed for **daily glance** — 5 seconds to understand account health.

**The analytics tab answers: "How are things trending over time and where should I optimize?"** It shows time-series data with adjustable date ranges, per-item breakdowns (per-campaign, per-link, per-show), comparative analysis, and audience/geographic detail. This layer is designed for **weekly or monthly review** — 5 minutes to identify patterns.

The split boundary is **temporal and granular**: overview = current state + recent activity (aggregate); analytics = historical trends + per-item drill-downs (granular). For products with fewer than 10 metrics, the key insight from Beehiiv is that **email engagement metrics belong on the overview**, not hidden in analytics. When you only have a handful of metrics, every one earns top-line placement.

---

## Email engagement lives alongside growth, not behind it

The positioning of open rate and click rate relative to subscriber growth reveals two clear camps:

**Camp 1 — Mixed on the overview (Beehiiv, Bandsintown):** These products show subscriber count, open rate, and CTR as peer-level KPIs on the home screen. Beehiiv literally places them in the same row of cards. This works when the metric set is small enough that everything fits without overwhelming the user. Beehiiv's "Last Post Performance" card takes this further by showing the most recent email's open rate and CTR with trend arrows comparing against the rolling 10-post average — contextualized engagement right on the home screen.

**Camp 2 — Separated by function (Mailchimp, Kit):** These products put growth data on the home/audience screens and email performance in a separate reports section. This makes sense for Mailchimp's 50+ metrics but creates unnecessary navigation friction for simpler products.

For a sub-10-metric fan-capture tool, **Camp 1 is correct**. With only ~8 core metrics (total fans, new fans, page views, QR scans, show capture rate, open rate, click rate, sequence completion), all of them should be visible without navigating away from the primary view. The question is not *whether* email stats should be on the overview — they should — but how to organize them relative to fan acquisition metrics.

---

## Mobile patterns favor 4-tab bottom bars and progressive disclosure

Three tools with dedicated mobile apps (Mailchimp, Linktree, Spotify for Artists) all use **bottom tab navigation with 4–5 tabs**. Mailchimp's mobile tabs (Home, Audience, Campaigns, Analytics) collapse its desktop sidebar into four categories. Linktree uses a "More" button for overflow. Spotify for Artists maps its desktop tabs directly to mobile.

Tools without mobile apps (Beehiiv, Kit, Chartmetric) are uniformly **desktop-first** — their responsive web layouts use hamburger menus and collapsible sidebars. Beehiiv explicitly notes that "mobile app analytics are not available" in the admin. This is a gap, and a competitive opportunity for a mobile-first product.

For the "checking between sets" use case — a musician with **5–15 minutes** between sets, phone in hand, wanting to know how tonight is going — the research points to these mobile patterns: large, glanceable KPI numbers (Beehiiv's card pattern), a single scrollable view rather than tabs within tabs, trend indicators (up/down arrows) that communicate direction without requiring cognitive processing, and a **"tonight" or "this show" scoping** that no existing tool offers because none are built for live-show contexts.

---

## The clearest mental model for a two-tab split

Analyzing how these six products divide their information, three mental models emerge for a two-tab split:

**Model A — "Overview / Analytics"** (Bandsintown, Beehiiv): The most common pattern. Tab 1 is a KPI dashboard with recent activity; Tab 2 is deeper analytics with time-series and per-item data. The problem: the word "analytics" is vague and the boundary is fuzzy — users aren't sure which tab contains what they want.

**Model B — "Editor / Insights"** (Linktree): Tab 1 is the primary workspace (managing content); Tab 2 is all data. Clean separation but analytics becomes a destination you visit deliberately, not something you glance at passively. Poor fit for a "check between sets" flow.

**Model C — "Now / Over Time"** (implicit in Spotify for Artists' 2026 redesign): Tab 1 answers "what's happening now?" with today's/this show's numbers and recent activity. Tab 2 answers "how am I doing over time?" with trends, comparisons, and historical data. This model makes the split intuitive because it maps to **different user intents at different moments** — between sets vs. Sunday morning review.

---

## Firm recommendation for the fan-capture SaaS

**Use two tabs, with the mental model "Tonight" / "All Shows."** This is a variant of Model C adapted for the live-show context. Here is the specific architecture:

**Tab 1: "Tonight" (default view, the between-sets screen)**

This tab is scoped to the current or most recent show and designed for a **5-second glance** on a phone held one-handed. Component hierarchy, top to bottom:

1. **Show header** — venue name, date, city (auto-detected or manually selected). Large text. If no show is active, defaults to the most recent show.
2. **Three KPI cards in a single row** — New Fans (captured tonight), QR Scans, Page Views. Large numbers, bold, with a subtle "vs. your average show" comparison indicator (↑12% or similar).
3. **Capture rate** — a single prominent percentage: "X% of scanners became fans." This is the hero metric for the between-sets moment because it tells the artist whether their QR call-to-action is working.
4. **Recent fan activity feed** — a compact, scrollable list of recent signups (first name + time, e.g., "Sarah — 2 min ago"). This creates an emotional reward loop and confirms the system is working in real time.
5. **Email sequence status** (collapsed by default, expandable) — for fans captured tonight, how many have entered the sequence, first email sent count, open rate so far. This is secondary information that a curious artist can expand but doesn't clutter the between-sets glance.

**Tab 2: "All Shows" (the Sunday morning review screen)**

This tab shows aggregate and historical data across all shows. Component hierarchy:

1. **Top-line KPI cards** — Total Fans (all time), Avg. Open Rate, Avg. Click Rate, Total Shows. These four numbers mirror the Beehiiv pattern of mixing growth and engagement as peer-level KPIs.
2. **Fan growth chart** — time series showing fans captured per show, plotted over time. Each data point is a show (not a day), making the x-axis meaningful for gigging musicians.
3. **Show-by-show performance table** — sortable list of all shows with columns: Date, Venue, City, Fans Captured, QR Scans, Capture Rate, Avg. Open Rate (for that show's cohort). Tapping a row expands to show email sequence performance for that show's fan cohort.
4. **Email performance section** — aggregate email stats: sequence completion rate, best-performing email in the sequence (by open rate), click rate by email position. This is the "optimize my sequence" view.
5. **Top cities / venues** — a compact leaderboard showing which cities and venues produce the most fan captures. Directly actionable for tour routing.

**Email stats placement: inline on the "All Shows" tab, expandable per-show on the table rows.** Do not create a separate email analytics tab — with fewer than 10 metrics, a third tab creates an empty-feeling product. Instead, email metrics appear in two places: (1) as top-line aggregates in the "All Shows" KPI cards, and (2) as per-show-cohort drill-downs when tapping a show row. On the "Tonight" tab, email stats are collapsed under the capture metrics because the between-sets moment is about acquisition, not engagement. The Beehiiv pattern of showing "Last Post Performance" with trend arrows is the right interaction model for the expandable email section on "Tonight."

**Mobile layout for the between-sets use case** should follow these principles borrowed from the research: use **large-format number cards** (Beehiiv's 4-card pattern, but 3 cards for the narrower scope), put the **most emotionally resonant metric first** (New Fans tonight, not QR scans), include **trend arrows** rather than requiring users to interpret raw numbers, keep the default view to **one screen height** (no scrolling required for the core information), and use **bottom tab navigation** with exactly two tabs plus a floating action button for "Share QR Code" or "Start Show." The real-time fan activity feed should use pull-to-refresh, not auto-refresh, to preserve battery and give the musician agency.

**One critical design principle from this research: progressive disclosure scales down, not just up.** Beehiiv gates its Analyze section behind a paid plan. Bandsintown activates Insights at 100 followers. For a new artist with zero shows, the "Tonight" tab should show a setup prompt (not empty charts), and "All Shows" should show a single compelling demo state. As the artist accumulates shows, the "All Shows" tab gets richer — the show-by-show table gains rows, the growth chart gains data points, the city leaderboard becomes meaningful. The product should feel complete at 1 show and powerful at 50.

This two-tab architecture maps directly to the two moments when a gigging musician checks their phone: **between sets** (adrenaline, quick glance, "is it working tonight?") and **between gigs** (reflective, planning, "how am I doing overall?"). Every tool in this research separates these temporal modes — the recommendation simply makes that separation explicit and names it in the musician's own language.