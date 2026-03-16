# The right database for Afterset's concert burst writes

**A queue in front of Supabase Pro makes the database choice almost irrelevant.** For Afterset's workload — 100–300 INSERTs per show at launch, scaling to 20K–100K writes in a 5-minute window at 10K artists — the critical architectural decision is not which database to pick but whether to buffer writes through a queue. With a queue (QStash at ~$1/event, Inngest free tier, or Cloudflare Queues at $0), even a **$25/mo Supabase Pro Micro instance** comfortably handles the drain. Without a queue, connection exhaustion from thousands of concurrent serverless invocations becomes the real bottleneck at scale — regardless of provider. Supabase remains the strongest overall choice given its bundled features (Auth, Realtime, Storage), but Neon offers compelling cost efficiency and a superior serverless driver, while Turso's database-per-artist model provides an elegant sharding pattern.

---

## Supabase: the leading candidate earns its position

Supabase's architecture has a critical feature that most evaluations miss: **the PostgREST HTTP layer via `supabase-js` bypasses connection pooling entirely**. When serverless functions call `supabase.from('fans').insert(...)`, they make HTTP requests to PostgREST, which maintains its own persistent connection pool to Postgres. Thousands of concurrent serverless invocations never open direct database connections. This is explicitly recommended by both Supabase and Vercel's official documentation for serverless workloads. [VERIFIED]

**Connection pooling by tier** (Supavisor, which has replaced PgBouncer as the default pooler):

| Compute Size | Monthly Cost (+ $25 Pro base) | Direct DB Connections | Pooler Max Clients |
|---|---|---|---|
| Micro (Pro default) | $25 total | 60 | 200 |
| Small | ~$40 total | 90 | 400 |
| Medium | ~$85 total | 120 | 600 |
| Large | ~$135 total | 160 | 800 |
| XL | ~$235 total | 240 | 1,000 |
| 4XL | ~$985 total | 480 | 3,000 |

When the Supavisor pool is full in transaction mode, new connections are **rejected outright** (no queuing). In session mode, connections queue for up to 60 seconds. [VERIFIED — Supabase docs]

**Write throughput is not the bottleneck.** No Supabase-specific INSERT benchmark exists, but the closest data point is a PlanetScale-conducted TPCC benchmark showing **~5,000 QPS mixed read/write on a 2XL instance**. A developer blog reported ~2,100–3,200 rows/sec via single batch PostgREST insert on a smaller tier. For Afterset's workload, **333 writes/sec** (100K in 5 minutes) is well within what even a Micro instance handles — the constraint is always connection concurrency, not raw INSERT speed. Disk IOPS on Micro burst to **11,800** from a 500 baseline, which actually favors bursty concert workloads. [VERIFIED for IOPS; REPORTED for INSERT benchmarks]

**The biggest unknown is the undocumented API gateway rate limit.** Supabase does not publish any explicit requests/sec ceiling for PostgREST HTTP calls. At thousands of concurrent requests during a large event, there could be an undocumented throttle. Load testing on a staging instance before committing is essential. [UNKNOWN]

**Bundled features carry important caveats.** Supabase Realtime supports **500 concurrent connections and 500 messages/sec on Pro** (scaling to 10,000 connections with spend cap disabled), but Postgres Changes subscriptions are processed on a **single thread** — compute upgrades don't help. Use Broadcast instead of Postgres Changes for live fan-count displays. RLS performance degrades dramatically without proper indexing: an unoptimized policy on 100K rows scanned in **171ms** versus sub-millisecond with a btree index and `(SELECT auth.uid())` wrapper for initPlan caching. For fan-capture INSERTs, use `service_role` key from serverless functions and bypass both RLS and Supabase Auth entirely — Auth's default email rate limit is **2/hour** without custom SMTP, which would be catastrophic for this use case. [VERIFIED — Supabase docs]

**Upgrade path:** Pro + Micro ($25/mo) at launch → Pro + Medium ($85/mo) at scale → Pro + Large ($135/mo) if needed. With the PostgREST HTTP approach, even the Micro tier handles the 10K-artist workload for raw throughput; upgrading buys CPU headroom and higher pooler limits for direct-connection use cases.

---

## Neon: the cost-efficient alternative with a superior serverless driver

Neon's **native serverless driver** (`@neondatabase/serverless`) communicates over HTTP with just ~3 round trips versus ~8 for TCP, making it purpose-built for one-shot INSERTs from edge functions. Each fan-scan INSERT is a stateless `fetch()` request with no persistent connection — the ideal pattern for this workload. [VERIFIED — Neon docs]

**Cold start is the primary risk.** Neon scales to zero by default, with a **p50 wake-up time of ~350–500ms**. The p99 is not officially published but is estimated at **1–3 seconds** based on engineering blog posts and developer reports. PgBouncer queues incoming connections during wake-up (120-second timeout), so the first fan at a show would see a ~500ms delay, with all subsequent scans completing in under 10ms. On paid plans, scale-to-zero can be disabled for **~$19/mo** (Launch) or **~$41/mo** (Scale) at minimum compute. [VERIFIED for p50; INFERRED for p99]

**Connection pooling is generous.** Neon's built-in PgBouncer accepts up to **10,000 client connections** across all plans, with the actual concurrent transaction pool sized at 90% of `max_connections` (which scales from 104 at 0.25 CU to 4,000 at 9+ CU). At 1 CU, the pool handles ~377 concurrent active transactions — and since each simple INSERT completes in ~5ms, this translates to a theoretical **~75,000 transactions/minute**. Settings are not user-configurable. [VERIFIED — Neon docs]

**Autoscaling has a key constraint:** the maximum autoscaling range is **8 CU** (e.g., min 1 → max 9). Maximum autoscaling ceiling is **16 CU (64 GB)** on any paid plan. Fixed computes on the Scale plan go up to **56 CU (224 GB)** but don't autoscale. For Afterset's bursty workload, setting min 2 CU / max 8 CU gives adequate headroom with automatic scaling during concert windows. [VERIFIED — Neon docs]

**Pricing is remarkably competitive post-Databricks acquisition** (May 2025). Neon dropped compute rates 15–25% and storage 80% (from $1.75 to **$0.35/GB-month**):

| Plan | Compute Rate | Key Limits |
|---|---|---|
| Free | 100 CU-hours/mo | 0.5 GB storage, scale-to-zero fixed at 5 min |
| Launch | **$0.106/CU-hour** | 16 CU max autoscaling, configurable suspend |
| Scale | **$0.222/CU-hour** | 56 CU fixed, 99.95% SLA, SOC 2/HIPAA |

For Afterset's burst workload (4 CU average over 10-minute concert windows, 30 events/month), the estimated cost is **~$8–15/month on Launch** including storage. Always-on at 0.25 CU costs ~$19/mo on Launch. [VERIFIED pricing; INFERRED cost estimates]

**Single biggest risk:** Cold start latency if scale-to-zero is enabled. A fan scanning a QR code at the start of a show could wait 1–3 seconds for the database to wake. Mitigation: disable scale-to-zero ($19/mo) or trigger a pre-warm query when the artist starts the event.

---

## PlanetScale: back from the brink with a Postgres product

**PlanetScale is alive, actively expanding, and now offers Postgres.** The 2024 crisis (layoffs, free tier removal) is behind them. Key developments: Postgres product GA'd in September 2025, a **$5/mo single-node tier** launched in November 2025, and PostgreSQL 18 support was added in December 2025. The changelog shows weekly releases, and customers include Cursor, Intercom, and GitHub. [VERIFIED — PlanetScale blog, changelog]

The Postgres product eliminates the historic dealbreaker: **full native foreign key support** with zero Vitess limitations. Connection pooling uses built-in PgBouncer in transaction mode. Pricing starts at $5/mo (single node, 1/16 vCPU, 512MB) scaling to $15/mo for HA (3 nodes) and $50/mo for Metal (NVMe, unlimited IOPS). [VERIFIED — PlanetScale docs]

**However, PlanetScale Postgres is the newest product in this comparison** (GA just 6 months ago). It lacks the battle-testing of Supabase or Neon's Postgres offerings. There is no free tier — $5/mo minimum. The Vitess product's legendary connection handling (demonstrated at 1 million concurrent connections) does not apply to the Postgres product, which uses standard PgBouncer pooling. No horizontal sharding for Postgres exists yet (Neki is in development). [VERIFIED]

**Verdict for Afterset:** Worth monitoring but not the recommended choice today. The Postgres product is too young, lacks Supabase's bundled features (Auth, Realtime, Storage), and doesn't offer meaningful advantages over Supabase or Neon for this specific workload. The $5/mo entry point is attractive for development environments.

---

## Turso: elegant sharding model, fundamental write architecture risk

Turso's unique value proposition for Afterset is the **database-per-artist pattern**. With one SQLite database per artist, each concert's writes hit an independent primary — zero cross-artist contention. Turso supports this at scale: companies have created **2M+ databases**, and the Pro plan includes 10,000 monthly active databases. At 10K artists with 300 writes per show, each database handles trivial load even when hundreds of concerts run simultaneously. [VERIFIED — Turso blog, docs]

**The fundamental limitation is single-writer architecture on Turso Cloud.** Despite marketing around "concurrent writes," the new MVCC engine (Turso Database, Rust rewrite) is in **beta as a standalone binary only** — Turso Cloud still runs libSQL with serialized writes. From serverless functions, HTTP round-trip overhead limits a single database to roughly **20–50 serialized writes/sec** in practice. The database-per-artist model makes this moot for normal concerts, but a viral moment (10K fans scanning simultaneously for one artist) would stress a single primary. [VERIFIED that MVCC is not in Cloud; INFERRED throughput estimate]

**Replication lag is 100–300ms** and asynchronous with no SLA — acceptable for this use case since reads happen after concerts, not during real-time scanning. Drizzle ORM has **first-class native support** (Turso is a Cloud Partner), while Prisma requires an adapter with migration workarounds. [REPORTED for lag numbers; VERIFIED for ORM support]

**Pricing scales with row writes**, which creates a different cost model:

| Plan | Monthly Cost | Rows Written/mo | Active DBs |
|---|---|---|---|
| Free | $0 | 10M | 100 |
| Developer | $4.99 | 25M | 500 |
| Scaler | $24.92 | 100M | 2,500 |
| Pro | $416.58 | 250M | 10,000 |

At 10K artists × 300 writes/show × 10 shows/month = 30M writes, the **Scaler plan ($25/mo)** covers the workload. But reaching 10K active databases requires the **Pro plan ($417/mo)** — a steep jump. [VERIFIED — Turso pricing page]

**Single biggest risk:** The per-write billing model and the Pro plan price cliff at 10K databases. The database-per-artist pattern elegantly solves the write contention problem but creates operational complexity for cross-artist analytics (requires ATTACH queries or a separate aggregation database).

---

## A queue changes everything about this decision

The architecture patterns research reveals a clear consensus: **every comparable system (Ticketmaster, live polling tools, AWS serverless best practices) uses a message queue to buffer burst writes**. The pattern is simple: fan scans QR → serverless function validates email and enqueues message (~5–20ms) → returns "You're in!" immediately → queue consumer writes to database at a controlled rate. The fan never waits for the database. [VERIFIED — AWS docs, Ticketmaster system design, Jeremy Daly's serverless patterns]

This pattern transforms the requirements. Without a queue, thousands of concurrent serverless invocations must each establish a database connection — the scenario that stresses connection pools. With a queue, the consumer controls concurrency (e.g., 20–50 parallel writers), and the database never sees more than a modest, steady stream of INSERTs.

**Queue technology costs are negligible:**

| Queue | Cost for 100K Messages | Concurrency Control | Best For |
|---|---|---|---|
| **QStash** | ~$1 | Flow Control (rate + parallelism) | Simplest, vendor-agnostic |
| **Inngest** | $0 (free tier: 50K/mo) | Built-in per-function limits | Best DX with Vercel/Next.js |
| **Cloudflare Queues** | $0 (within 1M free ops) | Batch processing (100/batch) | Cloudflare Workers ecosystem |
| **AWS SQS** | $0 (within 1M free) | Lambda reserved concurrency | Already on AWS |

**The math is definitive.** A Supabase Micro instance (included with Pro at $25/mo) has **500 baseline IOPS bursting to 11,800**. With a queue draining at 100–300 writes/sec through 20 concurrent consumers, 100K writes complete in **5–17 minutes** — well within the instance's capacity. The queue adds ~$0–1 per large event. Total infrastructure cost: **~$25–35/month** for the 10K-artist workload. [INFERRED from verified IOPS and queue pricing]

---

## The recommended architecture and upgrade path

**At launch (first 50 artists):** Direct writes via `supabase-js` PostgREST HTTP API. No queue needed. Supabase Pro + Micro at $25/mo handles 300 INSERTs/show trivially. Use `service_role` key from serverless functions — bypass Supabase Auth and RLS entirely for fan-capture INSERTs. Add Supabase Realtime Broadcast (not Postgres Changes) for live fan-count displays. Total cost: **$25/month**.

**At growth (50–1,000 artists):** Add a queue (Inngest or QStash) when concurrent shows exceed ~10 simultaneously. The queue adds ~10 lines of code and zero meaningful cost. Keep Supabase Pro + Micro. Total cost: **$25–35/month**.

**At scale (1,000–10,000 artists):** Upgrade Supabase compute to Small ($40/mo) or Medium ($85/mo) for CPU headroom. Move to Inngest Pro ($75/mo) for observability. Implement batch INSERTs in queue consumers (100 rows per statement instead of individual INSERTs — 10–50x more efficient). Total cost: **$100–160/month**.

## Conclusion

The four providers are all capable of handling Afterset's workload, but they differ in where they excel. **Supabase wins on bundled features and the PostgREST HTTP architecture** that elegantly sidesteps connection pooling. **Neon wins on cost efficiency and its purpose-built serverless driver**, making it the strongest alternative if Supabase's bundled features aren't needed. **Turso's database-per-artist model is architecturally elegant** but introduces billing complexity and ORM friction. **PlanetScale's Postgres product is too young** to recommend over established alternatives.

The most important finding is that **the queue-buffered write pattern reduces this from a database scaling problem to a $1 queue problem**. With a queue controlling drain rate, even the cheapest Supabase tier never sees connection pressure. The database choice becomes a feature and ecosystem decision — not a performance one. Start with Supabase Pro + direct PostgREST writes at $25/month, add a queue when concurrent shows warrant it, and upgrade compute only when monitoring shows CPU pressure. The 10K-artist workload runs comfortably under $160/month total infrastructure cost.