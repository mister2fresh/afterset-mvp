# ADR-001: Database — Supabase (with queue-buffered write architecture)

**Status:** Accepted
**Date:** March 16, 2026
**Author:** Afterset team
**Affects:** Auth, real-time, capture page serving, analytics, multi-tenancy, email infrastructure, deployment

---

## Decision

**Supabase Pro + Micro ($25/mo)** as the primary database, auth, real-time, and storage provider. Fan capture writes go through the **PostgREST HTTP API** (via `supabase-js`), which bypasses connection pooling entirely. A **write queue** (Inngest or QStash) will be added when concurrent shows exceed ~10 simultaneously — estimated around 200+ artists. The queue is a planned scaling layer, not a band-aid.

**Critical day-1 configuration:** Configure custom SMTP for Supabase Auth (default rate limit is 2 emails/hour without it). Use `service_role` key from serverless functions for fan capture INSERTs — bypass both RLS and Supabase Auth on the fan-facing path.

---

## Context

Afterset is a fan-capture SaaS for gigging musicians. The database must handle a workload with an unusual shape: long stretches of low traffic (artists editing pages, checking dashboards) punctuated by sharp bursts of concurrent writes (100+ fans scanning a QR code within 60 seconds at a venue with poor cellular signal).

### Scale projections

| Phase | Artists | Concurrent shows (peak night) | Writes in 60s (peak) | Writes in 5 min (peak) |
|---|---|---|---|---|
| Launch (month 1-2) | ~50 | 1-3 | 100-300 | 500-1,000 |
| Traction (month 6) | 200+ | 10-20 | 1,000-6,000 | 5,000-20,000 |
| Scale (year 1-2) | 10,000 | 200+ | 20,000-100,000 | 50,000-200,000 |

### Why this decision carries the most downstream weight

Auth, real-time subscriptions, row-level security, and storage features are tightly coupled to the database provider. Switching databases mid-flight means rewriting auth, API routes, and security policies — not just changing a connection string. The burst-write scenario is non-negotiable: if fan captures fail or feel slow at a show, the product is dead.

### Constraints

- Solo developer — DX and ecosystem maturity are high priority.
- Deployment is fully open (not locked to Vercel).
- Capture pages must load in under 2 seconds on 3G.
- Multi-tenant isolation required from day one.
- GDPR-compliant deletion must be architecturally feasible.
- Database cost must stay well under $1/artist/month at scale (artist pricing ceiling is $12-25/mo).

---

## Options Considered

### Option A: Supabase — SELECTED

**What it is:** Firebase-alternative built on Postgres. Bundles database, auth, real-time subscriptions, edge functions, and file storage.

**Key research finding:** The `supabase-js` client communicates via PostgREST HTTP, not direct Postgres connections. Thousands of concurrent serverless invocations make HTTP requests to PostgREST, which maintains its own persistent connection pool to Postgres. This means the PgBouncer/Supavisor connection limits — the primary concern in the original ADR — are largely irrelevant for the fan capture path. [VERIFIED — Supabase docs, Vercel integration guide]

**Connection pooling by tier** (Supavisor, which replaced PgBouncer):

| Compute Size | Monthly Cost | Direct Connections | Pooler Max Clients |
|---|---|---|---|
| Micro (Pro default) | $25 total | 60 | 200 |
| Small | ~$40 | 90 | 400 |
| Medium | ~$85 | 120 | 600 |
| Large | ~$135 | 160 | 800 |
| XL | ~$235 | 240 | 1,000 |
| 4XL | ~$985 | 480 | 3,000 |

When Supavisor pool is full: transaction mode rejects outright; session mode queues for up to 60 seconds. [VERIFIED]

**Write throughput:** No Supabase-specific INSERT benchmark exists. Closest data: ~2,100-3,200 rows/sec via batch PostgREST INSERT on a small tier (developer blog report). Disk IOPS on Micro burst to 11,800 from a 500 baseline — favorable for bursty workloads. At the scale scenario (333 writes/sec sustained = 100K in 5 min), this is within Micro tier capacity for raw throughput. [REPORTED for INSERT benchmarks; VERIFIED for IOPS]

**Bundled features — important caveats from research:**

- **Realtime:** 500 concurrent connections and 500 messages/sec on Pro. Postgres Changes subscriptions run on a single thread (compute upgrades don't help). Use Broadcast instead of Postgres Changes for live fan-count displays. [VERIFIED]
- **RLS performance:** Unoptimized policy on 100K rows: 171ms. With btree index + `(SELECT auth.uid())` wrapper: sub-millisecond. Indexing strategy is critical. [VERIFIED]
- **Auth rate limit:** Default 2 emails/hour without custom SMTP. Must configure custom SMTP on day 1. [VERIFIED]

**Risks:**

1. **Undocumented API gateway rate limit.** Supabase does not publish a requests/sec ceiling for PostgREST HTTP calls. At thousands of concurrent requests, there may be an undocumented throttle. Load testing on a staging instance is required before launch. [UNKNOWN — highest remaining risk]
2. **Vendor lock-in.** Auth, Realtime, Edge Functions, and the JS client SDK are proprietary. The database is standard Postgres (portable), but replacing auth and real-time requires significant rework.
3. **Single-component failure risk.** If Supabase Auth or Realtime underperforms, you can't swap just that piece without rework.

---

### Option B: Neon — STRONG ALTERNATIVE

**What it is:** Serverless Postgres with autoscaling, branching, and scale-to-zero.

**Key strength:** Native serverless driver (`@neondatabase/serverless`) communicates over HTTP with ~3 round trips vs ~8 for TCP. Purpose-built for one-shot INSERTs from edge functions. Each fan-scan INSERT is a stateless `fetch()` — no persistent connection needed. [VERIFIED]

**Connection pooling:** Built-in PgBouncer accepts up to 10,000 client connections. At 1 CU, handles ~377 concurrent active transactions. Since a simple INSERT completes in ~5ms, theoretical capacity is ~75,000 transactions/minute. [VERIFIED for pool limits; INFERRED for throughput math]

**Cold start risk:** p50 wake-up of 350-500ms; p99 estimated at 1-3 seconds. PgBouncer queues during wake-up (120s timeout). First fan at a show sees ~500ms delay; subsequent scans complete in <10ms. Scale-to-zero can be disabled on paid plans (~$19/mo Launch, ~$41/mo Scale). [VERIFIED for p50; INFERRED for p99]

**Autoscaling:** Max range is 8 CU. Max ceiling is 16 CU on any paid plan. Fixed computes on Scale go up to 56 CU but don't autoscale. [VERIFIED]

**Pricing (post-Databricks acquisition, May 2025 — 15-25% compute reduction, 80% storage reduction):**

| Plan | Compute Rate | Key Limits |
|---|---|---|
| Free | 100 CU-hours/mo | 0.5 GB storage |
| Launch ($0.106/CU-hr) | 16 CU max autoscale | Configurable suspend |
| Scale ($0.222/CU-hr) | 56 CU fixed | 99.95% SLA |

Estimated cost for Afterset's burst workload: $8-15/month on Launch. Always-on at 0.25 CU: ~$19/mo. [VERIFIED pricing; INFERRED estimates]

**Why not selected:** No bundled auth, real-time, or storage. Assembling Neon + Auth.js + Resend + custom real-time adds ~2 weeks to the build for a solo dev. The cold start risk on the fan capture path is concerning (first scan of a show hitting a 1-3s database wake-up). Neon is the recommended fallback if Supabase load testing reveals an API gateway throttle.

---

### Option C: PlanetScale — NOT RECOMMENDED (too young)

PlanetScale survived the 2024 crisis and now offers a Postgres product (GA September 2025) with a $5/mo entry point. Full native foreign key support, no Vitess limitations. Customers include Cursor, Intercom, GitHub. [VERIFIED]

**Why not selected:** The Postgres product is only 6 months old — youngest in this comparison. Lacks bundled features (auth, real-time, storage). No meaningful advantage over Supabase or Neon for this workload. Connection pooling uses standard PgBouncer (no documented advantage over Supabase's Supavisor). Worth monitoring for future evaluation; the $5/mo tier is attractive for dev/staging environments.

---

### Option D: Turso — NOT RECOMMENDED (operational complexity)

Turso offers an elegant database-per-artist sharding pattern (companies have run 2M+ databases; Pro includes 10K monthly active). Each concert's writes hit an independent primary — zero cross-artist contention. [VERIFIED]

**Why not selected despite the clever architecture:**

1. **Single-writer on Turso Cloud.** The MVCC engine is beta-only as a standalone binary; Cloud still runs serialized writes. From serverless functions, HTTP overhead limits to ~20-50 writes/sec per database. The per-artist model makes this fine for normal concerts, but a viral moment (10K fans for one artist) stresses a single primary. [VERIFIED for Cloud architecture; INFERRED for throughput]
2. **Pricing cliff.** 10K active databases requires Pro at $417/mo — steep compared to Supabase at $25-85/mo. [VERIFIED]
3. **Cross-artist analytics require workarounds** (ATTACH queries or a separate aggregation database). [INFERRED]
4. **Drizzle has first-class support; Prisma requires adapter with workarounds.** [VERIFIED]
5. **Replication lag 100-300ms, async, no SLA.** Acceptable for post-show reads but limits real-time dashboard accuracy. [REPORTED]

---

## The Architecture That Makes This Work

Research revealed a clear consensus: every comparable system (Ticketmaster, live polling tools, AWS serverless best practices) uses a message queue to buffer burst writes. [VERIFIED]

### The pattern

```
Fan scans QR → Serverless function validates email + enqueues message (~5-20ms)
→ Returns "You're in!" immediately (optimistic confirmation)
→ Queue consumer writes to database at controlled rate
→ Fan never waits for the database
```

### Queue options

| Queue | Cost (100K msgs) | Concurrency Control | Best For |
|---|---|---|---|
| QStash | ~$1 | Flow control (rate + parallelism) | Simplest, vendor-agnostic |
| Inngest | $0 (free: 50K/mo) | Built-in per-function limits | Best DX with Next.js |
| Cloudflare Queues | $0 (within 1M free) | Batch processing (100/batch) | Cloudflare Workers |
| AWS SQS | $0 (within 1M free) | Lambda reserved concurrency | Already on AWS |

### Why the queue changes everything

Without a queue, thousands of concurrent serverless invocations each hit the database (or PostgREST). With a queue, the consumer controls concurrency (20-50 parallel writers) and the database sees a modest, steady stream. A Supabase Micro instance (500 baseline IOPS, 11,800 burst) handles 100-300 writes/sec from 20 queue consumers comfortably. 100K writes drain in 5-17 minutes.

### Design implication: follow-up email timing

Queue drain time means the last fan's record isn't in the database for up to 17 minutes at peak scale. Follow-up emails triggered on database INSERT will be delayed accordingly. This is acceptable because the capture page shows "You're in!" immediately (optimistic), and the follow-up email is configured with a delay anyway (immediate, 1 hour, or next morning). But this must be a conscious design choice — the queue consumer should write the fan record AND enqueue the follow-up email trigger as a single unit of work.

---

## Upgrade Path

| Phase | Architecture | Monthly Cost |
|---|---|---|
| Launch (50 artists) | Direct PostgREST writes, no queue. Supabase Pro + Micro. | ~$25 |
| Growth (200+ artists) | Add Inngest/QStash queue. Keep Micro. | ~$25-35 |
| Scale (1K-10K artists) | Upgrade to Small ($40) or Medium ($85). Inngest Pro ($75) for observability. Batch INSERTs in consumers (100 rows/statement). | ~$100-160 |

---

## Consequences

### Positive

- Auth, RLS, real-time, and storage available on day one. Sprint 1 starts with capture flow, not infrastructure.
- TypeScript types auto-generated from schema via Supabase CLI.
- PostgREST HTTP approach means connection pooling is not a bottleneck for the primary fan capture path.
- Dashboard live fan count achievable via Realtime Broadcast with minimal code.
- RLS policies enforce data isolation at the database level.
- Clear, tested upgrade path from $25/mo to $160/mo covering launch through 10K artists.

### Negative

- Undocumented PostgREST rate limit is an unknown risk. Must load test before launch.
- Migrating away from Supabase Auth later requires rewriting auth flows, session management, and RLS policies referencing `auth.uid()`.
- Realtime Postgres Changes runs on a single thread — requires using Broadcast pattern instead (different API, slightly more code).
- Custom SMTP must be configured on day 1 or artist signups break silently at 2 emails/hour.

### Mitigations

1. **Load test PostgREST before launch.** Simulate 500 concurrent HTTP INSERTs against a Supabase Pro staging instance. If a throttle exists, add the queue immediately (adds ~10 lines of code). If no throttle, defer the queue to growth phase.
2. **Abstract the auth layer.** `getCurrentUser()` and `requireAuth()` should not reference Supabase directly in every component. Limits migration surface area if auth needs to change.
3. **Use `service_role` key for fan captures.** Bypass RLS and Supabase Auth entirely on the fan-facing serverless path. Auth + RLS only apply to the artist dashboard.
4. **Configure custom SMTP in the first hour of setup.** Resend or Postmark SMTP credentials in Supabase dashboard. Non-negotiable.

---

## Revisit When

- **PostgREST load test reveals a throttle below 500 req/sec.** Add queue immediately; if throttle is below 100 req/sec, evaluate Neon as primary database.
- **Costs exceed $100/mo before 500 paying artists.** Re-evaluate Neon's pay-per-compute model.
- **RLS policies degrade analytics query performance.** Add btree indexes first; if still slow at 100K+ rows, consider materialized views or a read replica.
- **Supabase Auth proves unreliable** (magic link delivery issues, rate limit surprises beyond the documented 2/hr). Swap to Auth.js/Clerk; the auth abstraction layer limits blast radius.
- **Supabase has a major outage or pricing change.** The all-in-one dependency means full product downtime. Monitor status page; the Postgres data itself is portable.

---

## Validation Tasks Before Committing

These must be completed during the Pre-Build Phase (Day 3 of the build roadmap):

1. **[ ] Load test PostgREST.** Create a Supabase Pro staging project. Run 500 concurrent HTTP INSERTs via a load testing tool (k6, artillery, or a simple script). Measure: p99 latency, error rate, any throttling. Pass criteria: <500ms p99, 0% error rate at 500 concurrent.
2. **[ ] Configure custom SMTP.** Set up Resend or Postmark SMTP in Supabase Auth dashboard. Verify magic link delivery in <30 seconds.
3. **[ ] Test RLS performance.** Seed 100K rows in fan_captures. Run a dashboard analytics query with RLS enabled. Verify <100ms with proper indexing.
4. **[ ] Test Realtime Broadcast.** Subscribe to a channel from a dashboard page, emit events from a serverless function simulating fan captures. Verify <1s delivery latency.

---

## Research Sources

Full research document: `research/database-research-results.md`

Key confidence levels on critical claims:
- PostgREST HTTP bypasses connection pooling: **VERIFIED** (Supabase docs, Vercel integration guide)
- Supavisor connection limits by tier: **VERIFIED** (Supabase docs)
- IOPS burst to 11,800 on Micro: **VERIFIED** (Supabase docs)
- INSERT throughput 2,100-3,200 rows/sec: **REPORTED** (developer blog)
- PostgREST rate limit: **UNKNOWN** (not documented — highest remaining risk)
- Queue pattern used by Ticketmaster/live event platforms: **VERIFIED** (AWS docs, system design references)
- Neon cold start p50 350-500ms: **VERIFIED** (Neon docs)
- Neon cold start p99 1-3s: **INFERRED** (engineering blog estimates)
