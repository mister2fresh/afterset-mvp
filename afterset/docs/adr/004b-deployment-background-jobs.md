
Adr 004 deployment · MD
Copy

# ADR-004: Deployment & Background Jobs — Split Architecture with Railway API, Cloudflare Pages SPA, and Supabase pg_cron
 
**Status:** Accepted
**Date:** March 21, 2026
**Author:** Afterset team
**Affects:** Application architecture, frontend hosting, API deployment, background job scheduling, delayed email delivery, monitoring, CI/CD pipeline, developer workflow
 
---
 
## Decision
 
**Vite + React SPA on Cloudflare Pages (free tier)** for the artist dashboard frontend. **Hono API on Railway Hobby plan ($5/mo)** for the backend. **Supabase pg_cron (included in Pro plan from ADR-001)** for background jobs including delayed follow-up email scheduling. A single Git repository with `web/` and `api/` folders, without monorepo tooling at launch.
 
The landing page (afterset.net) remains a separate Next.js deployment on Vercel and is unaffected by this decision.
 
**Total additional infrastructure cost: $5/month** (Railway Hobby plan). Cloudflare Pages is free. pg_cron is included in the existing Supabase Pro plan ($25/mo from ADR-001). Combined with Resend Pro ($20/mo from ADR-002), total infrastructure is **$50/month** at launch.
 
---
 
## Context
 
Afterset is a fan-capture SaaS for gigging musicians. The app has two distinct surfaces: a public-facing capture page (decided in ADR-003 — static HTML on Cloudflare R2) and an artist dashboard for managing capture pages, viewing analytics, configuring follow-up emails, and managing fan lists. This ADR covers the deployment architecture for the dashboard app and its supporting API.
 
### Why not Next.js on Vercel?
 
The original assumption was Next.js on Vercel for the full app. Research revealed this was inherited from the landing page build, not deliberately chosen. The artist dashboard is entirely auth-gated — SSR provides zero benefit (no SEO, no social previews, no public content). Next.js App Router adds substantial complexity for a solo developer: three different Supabase client types, Server vs. Client Component boundaries, middleware token refresh, and multiple critical CVEs disclosed in 2025 affecting RSC deserialization. Vercel Pro at $20/month is also the most expensive compute option for this workload.
 
### The workload shape
 
The API handles CRUD operations (capture page management, fan list queries, analytics), webhook receivers (Resend delivery events, Stripe billing events), and background job orchestration (delayed follow-up emails). Traffic is low — 50 artists at launch means tens of requests per second at peak, not thousands. The heaviest operation is the capture page build pipeline (generating static HTML and uploading to R2), which takes 5–10 seconds. The fan-facing capture submission path is handled separately by a Cloudflare Worker (ADR-003) and does not touch this API.
 
### Budget constraint
 
Supabase Pro ($25/mo) and Resend Pro ($20/mo) are committed. Remaining budget for compute, jobs, and monitoring is approximately $15/month.
 
---
 
## Options Considered
 
### Frontend: Vite + React SPA — SELECTED
 
A client-side React SPA eliminates SSR complexity entirely. No Server/Client Component boundaries, no middleware, no server runtime. TanStack Query handles caching, background refetches, optimistic updates, and stale-while-revalidate patterns. Supabase Auth is straightforward client-side via `supabase.auth.getSession()` and `onAuthStateChange()`. Route protection via TanStack Router's `beforeLoad` guard.
 
Deploys as static files to Cloudflare Pages at zero cost (unlimited bandwidth, unlimited requests on the free tier). The React component ecosystem is the richest available: shadcn/ui, TanStack Table, Recharts for analytics charts.
 
**Alternatives considered:** Next.js App Router (most ecosystem support but highest complexity), React Router v7 (clean data patterns but no dedicated Supabase integration docs), SvelteKit (elegant but smaller ecosystem and mixed Supabase Auth experiences). All rejected because the auth-gated dashboard use case doesn't benefit from SSR, making the additional framework complexity pure cost with no payoff.
 
---
 
### API Backend: Railway Hobby Plan — SELECTED
 
**What it is:** Persistent Node.js server running Hono, deployed via GitHub auto-deploy on Railway's Hobby plan ($5/month includes $5 of usage credits).
 
**Why Railway over Cloudflare Workers:** Both cost $5/month. Railway wins on DX for a solo developer: simpler mental model (it's a Node.js server — no CPU-time-vs-wall-clock confusion, no 128MB memory limit, no `eval()` restrictions), GitHub auto-deploy with zero configuration (push to main, deployed in under 2 minutes via Nixpacks), built-in preview environments for pull requests, one-click rollbacks, and a visual project canvas. Railway bills on actual CPU and memory utilization, not provisioned capacity — an idle-to-low-traffic Hono server at ~512MB RAM and 5–10% average CPU runs $1–3/month in actual usage, well within the $5 included credit.
 
**Railway capabilities used:**
- **Native cron jobs** (up to 50 on Hobby plan) — available as a fallback or supplement to pg_cron if needed.
- **Log Explorer** — environment-wide search across all services, structured log filtering (`@level:error`), 7-day retention on Hobby.
- **Observability Dashboard** — CPU, memory, and network metrics with configurable widgets. Monitoring alerts (email + in-app notifications when thresholds are reached) require Pro plan but are not needed at launch scale.
- **One-click managed Redis** (~$2–3/month additional) — available if BullMQ is needed later, but not required at launch.
 
**Why not Cloudflare Workers:** Architecturally elegant for the R2-heavy capture page build pipeline (R2 bindings are in-process, zero network hop), but the learning curve is steeper. CPU time vs. wall-clock time confusion catches newcomers. The `nodejs_compat` flag enables most Node.js APIs, but edge cases exist (no native C++ addons, no `child_process`). Workers is the recommended migration target if Railway costs become a concern at scale, since Hono runs natively on both platforms.
 
**Why not Vercel:** $20/month (4× Railway's cost) for equivalent functionality. Serverless functions add cold start concerns and timeout limits. Background jobs require an external service (Inngest/Trigger.dev) adding another dependency. The only advantage — monolithic deployment with Next.js — is irrelevant since the frontend is a separate SPA.
 
**Why not Fly.io:** Usage-based pricing charges for running time regardless of utilization (unlike Railway's utilization-based billing). BullMQ requires Redis, and Fly.io's recommended Upstash Redis costs $10/month fixed — pushing total to $15–16/month, 3× Railway's cost. CLI-first with no built-in GitHub auto-deploy, no native preview environments, and no billing alerts.
 
---
 
### Background Jobs: Supabase pg_cron — SELECTED
 
**What it is:** pg_cron is a Postgres extension included in Supabase Pro (ADR-001) that schedules recurring jobs using cron syntax. Combined with pg_net, it can make HTTP requests to external endpoints (including Supabase Edge Functions, Railway API routes, or any webhook). Run history is recorded in `cron.job_run_details` for observability.
 
**How delayed follow-up emails work:**
 
1. Fan submits email on capture page → Cloudflare Worker writes to Supabase `fan_captures` table and inserts a row into `pending_emails` with a `send_at` timestamp (now, +1 hour, or next morning 9am — configurable per artist).
2. pg_cron runs a job every 60 seconds: `SELECT * FROM pending_emails WHERE send_at <= NOW() AND status = 'pending' LIMIT 50`.
3. For each batch, pg_net fires an HTTP POST to the Railway API's `/api/emails/send-batch` endpoint with the pending email IDs.
4. The API route fetches email details, calls Resend's batch API (100 emails/call, 2 calls/sec per ADR-002), and updates `pending_emails.status` to `sent` or `failed`.
5. A second pg_cron job runs every 5 minutes to retry `failed` emails (up to 3 attempts, with the attempt count tracked in the table).
 
**Supabase pg_cron constraints (from Supabase docs):**
- Maximum 8 concurrent jobs recommended.
- Each job should run no more than 10 minutes.
- pg_net HTTP requests have a configurable timeout (default 5000ms via dashboard UI, adjustable via SQL).
- Jobs are recorded in `cron.job_run_details` — provides basic observability (start time, end time, status, error message).
- Sub-minute scheduling supported (every 1–59 seconds).
- Can trigger SQL functions, Edge Functions, or HTTP webhooks.
 
**Why pg_cron is sufficient at launch scale:**
 
At 50 artists generating ~5,000 fan emails/month (~170/day), the cron job fires 1,440 times/day and processes 0–10 emails per run on average. Peak night (3 simultaneous shows, 300 fans) means ~300 emails queued over 2–3 hours — the 60-second poll with 50-email batch size clears this trivially. The retry job handles transient Resend failures. The `cron.job_run_details` table provides enough observability to debug failures.
 
**What pg_cron does NOT provide (and why that's acceptable at launch):**
 
- **No built-in exponential backoff.** The retry logic is manual (a SQL column tracking attempt count + a cron job that retries). This is acceptable because Resend's own retry mechanism handles most transient failures, and at 5K emails/month, manual investigation of persistent failures is feasible.
- **No job-level dashboard or alerting.** You query `cron.job_run_details` via SQL or the Supabase dashboard. No Slack alerts on failure. Mitigated by adding a simple health-check endpoint on the Railway API that queries for stuck/failed jobs.
- **No concurrency control beyond the 8-job recommendation.** Irrelevant at launch (2–3 cron jobs total). Becomes relevant at scale if the write queue is implemented as additional cron jobs.
- **No distributed queue semantics.** pg_cron runs on a single Postgres instance. Fine for launch; if the write queue needs true distributed processing at the ~200 artist mark, migrate to Inngest or BullMQ + Redis on Railway.
 
**Why not Inngest:** Excellent DX with `step.sleep()` for delayed jobs and built-in retry/observability. Free tier (50K executions/month) covers launch. But it's an additional service dependency, an additional dashboard to monitor, and an additional point of failure — for a job that pg_cron handles with 20 lines of SQL. Inngest is the recommended upgrade when pg_cron's limitations become real (see Revisit When).
 
**Why not Trigger.dev:** Similar strengths to Inngest (managed infrastructure, built-in retries, dashboard). Code runs on Trigger.dev's infrastructure, eliminating timeout concerns. But the same objection applies: it's complexity that isn't justified at 5K emails/month. The free tier ($5 compute credit, 20 concurrent runs) is more restrictive than Inngest's.
 
**Why not QStash:** Good fit for "fire HTTP request after delay" use cases. Supports delays up to 7 days. But pricing is per-message ($1/100K messages) and adds another Upstash dependency. pg_cron achieves the same result without additional cost.
 
---
 
## Architecture Summary
 
```
┌──────────────────────────────────────┐
│  Artist Dashboard (Vite + React SPA) │
│  Cloudflare Pages — FREE             │
│  web/ folder                         │
└──────────────┬───────────────────────┘
               │ API calls
               ▼
┌──────────────────────────────────────┐
│  Hono API (Railway Hobby — $5/mo)    │
│  api/ folder                         │
│  • CRUD operations                   │
│  • Webhook receivers                 │
│  • Capture page build → R2 upload    │
│  • Email batch sender (called by     │
│    pg_cron via pg_net)               │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  Supabase Pro ($25/mo — ADR-001)     │
│  • Postgres (database)               │
│  • Auth (magic link + OAuth)         │
│  • pg_cron (delayed email jobs)      │
│  • pg_net (HTTP calls to Railway)    │
│  • Realtime (dashboard live counts)  │
└──────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  Resend Pro ($20/mo — ADR-002)       │
│  • Fan follow-up emails              │
│  • Supabase Auth SMTP                │
└──────────────────────────────────────┘
 
Fan-facing path (separate — ADR-003):
┌──────────────────────────────────────┐
│  Capture Pages (Cloudflare R2 + CDN) │
│  Submission → Cloudflare Worker      │
│  → Supabase write + pending_emails   │
│  FREE                                │
└──────────────────────────────────────┘
```
 
**Total monthly cost at launch: $50** (Supabase $25 + Resend $20 + Railway $5)
 
---
 
## Monitoring: Minimum Viable Observability
 
The monitoring stack must cover three failure modes: the API is down, a cron job is failing silently, or fan emails aren't sending.
 
### The stack
 
**Sentry Free Tier ($0/month)** for error tracking across both the SPA and the Hono API. The free Developer plan includes 5,000 errors and 10,000 performance units per month — sufficient for 50 artists. Sentry has SDKs for both React (SPA) and Node.js/Hono (API). Setup takes approximately 5 minutes per integration. Alerts on new errors are included on the free tier.
 
**Railway built-in observability ($0 additional)** for API infrastructure monitoring. Includes log explorer with structured filtering, CPU/memory/network metrics, 7-day log retention, and deployment webhooks for Slack/Discord notifications. Monitoring alerts (threshold-based) require Railway Pro but are not critical at launch — the API is low-traffic enough that Sentry error tracking catches issues before resource exhaustion does.
 
**PostHog Free Tier ($0/month)** for product analytics and web vitals on the SPA. Already used on the landing page (per the handoff doc). The free tier includes 1M events/month, 5K session replays, and 100K error events — far exceeding launch needs. Provides capture page conversion analytics (how many page loads → email submissions) without additional tooling. Note: PostHog's error tracking overlaps with Sentry but is less mature for stack trace debugging. Use PostHog for product analytics, Sentry for error debugging.
 
**Supabase built-in reports ($0 additional)** for database health. The Supabase dashboard includes reports for API gateway performance, auth patterns, and database health (query performance, connection usage, cache hit rates). pg_cron job history is queryable via `SELECT * FROM cron.job_run_details ORDER BY start_time DESC`. No built-in alerting — mitigated by the health-check endpoint below.
 
**Custom health-check endpoint on Railway API** (`GET /api/health`):
- Queries `pending_emails` for any rows where `status = 'pending' AND send_at < NOW() - INTERVAL '10 minutes'` (emails that should have sent but haven't).
- Queries `cron.job_run_details` for recent failures.
- Returns 500 if either check fails.
- Monitor this endpoint with a free uptime service (Better Stack free tier: 10 monitors, 3-minute check interval, email/Slack alerts).
 
### Total monitoring cost: $0/month
 
All tools are on free tiers. The health-check endpoint catches the most dangerous failure mode (silent email delivery failure) and routes through a free uptime monitor for alerting.
 
### What's NOT covered (and why it's acceptable):
 
- **No session replay at launch.** The fan-facing capture page is a single-field form — session replay provides minimal debugging value. PostHog session replay is available if needed (5K free recordings/month).
- **No APM/distributed tracing.** The architecture has two hops (SPA → Railway API → Supabase). Sentry's performance monitoring on the free tier provides basic latency tracking without full distributed tracing.
- **No Supabase-specific alerting.** The Supabase Metrics API exposes ~200 Prometheus-compatible metrics, but scraping them requires running Prometheus/Grafana — overkill at launch. The Supabase dashboard reports are sufficient for periodic manual checks.
 
---
 
## Repository Structure
 
```
afterset/
├── web/                    # Vite + React SPA
│   ├── src/
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── api/                    # Hono API for Railway
│   ├── src/
│   ├── tsconfig.json
│   └── package.json
├── packages/               # Shared code (added when needed)
│   └── types/              # Shared TypeScript types
├── .gitignore
└── README.md
```
 
No monorepo tooling (Turborepo, Nx) at launch. Each folder has its own `package.json` and deploys independently. Railway watches `api/` for auto-deploy; Cloudflare Pages watches `web/`. Shared types are extracted into `packages/types/` when duplication becomes painful — not preemptively.
 
---
 
## Consequences
 
### Positive
 
- Total infrastructure cost is $50/month — $10 under the $60 budget target, with headroom for monitoring upgrades.
- Zero SSR complexity. The SPA + API split means the frontend is static files (zero server runtime cost, zero cold starts, global CDN distribution) and the API is a simple Node.js server.
- pg_cron eliminates an external service dependency for background jobs. Delayed emails work with 20 lines of SQL on infrastructure already paid for.
- Railway's DX (auto-deploy, preview environments, one-click rollback, log explorer) matches or exceeds Vercel for a solo developer, at 25% of the cost.
- Hono runs natively on both Railway (Node.js) and Cloudflare Workers — the API is portable if migration is needed later.
- The health-check + uptime monitor pattern provides "is email delivery broken?" alerting at zero cost.
 
### Negative
 
- Split architecture means two deployment targets instead of one. Every feature that touches both frontend and API requires changes in two places, though shared TypeScript types mitigate type drift.
- pg_cron lacks the observability, retry sophistication, and alerting of dedicated job services. Failed jobs require manual SQL queries to investigate. No exponential backoff without custom implementation.
- Railway Hobby plan has limitations: monitoring alerts require Pro ($20/mo), and there's a $10/month execution time cap (sufficient for this workload but worth tracking).
- Sentry's free tier is limited to 1 user and 5K errors/month. If error volume spikes (e.g., a bug in the capture page build pipeline generating repeated errors), the quota exhausts quickly. Spike protection is not available on the free tier.
- No real-time alerting on pg_cron failures without the custom health-check endpoint. If the health check itself breaks, email delivery failures could go unnoticed.
 
### Mitigations
 
1. **Shared TypeScript types from day one.** Even before extracting to `packages/types/`, use a shared type definition file imported by both `web/` and `api/`. This prevents the most common split-architecture bug (frontend and API disagreeing on data shapes).
 
2. **Structured logging in the Hono API.** Use JSON-formatted logs with consistent fields (`{ level, action, artistId, error }`) so Railway's log explorer can filter effectively. Log every email send attempt, success, and failure. This compensates for pg_cron's limited observability.
 
3. **Health-check endpoint deployed in Sprint 1.** Don't defer monitoring. The `/api/health` endpoint that checks for stuck pending emails should be live before the first fan email sends. Wire it to Better Stack (or equivalent free uptime monitor) immediately.
 
4. **Sentry budget management.** Set the Sentry sample rate to 1.0 for errors (catch everything) but 0.1 for performance transactions (sample 10%). This keeps within the 5K error + 10K performance free quotas. If errors spike, Sentry drops events rather than billing — the free tier has no overage charges.
 
---
 
## Upgrade Path
 
| Phase | Architecture change | Monthly cost |
|---|---|---|
| Launch (50 artists) | Current architecture. pg_cron for delayed emails. | $50 |
| Traction (200+ artists) | Add write queue for fan capture buffering — either additional pg_cron jobs or Inngest free tier (50K executions/mo). | $50 |
| Growth (1,000 artists) | Migrate background jobs to Inngest Pro ($75/mo) or BullMQ + Railway Redis ($2–3/mo) for observability and retry sophistication. Upgrade Sentry to Team ($26/mo) for multi-user + alerts. | $78–101 |
| Scale (10,000 artists) | Evaluate migrating API to Cloudflare Workers for R2 affinity. Add Turborepo for `web/` and `api/` build orchestration. Railway Pro ($20/mo) for monitoring alerts. | $95–150 |
 
---
 
## Revisit When
 
- **pg_cron job run failures exceed 1% of total runs.** Investigate root cause (timeout? Resend downtime? query performance?). If the cause is systemic, migrate delayed emails to Inngest or BullMQ with proper retry/backoff.
- **Pending emails table grows past 100K rows and poll queries slow down.** Add a btree index on `(status, send_at)` first. If still slow, partition the table or move to a dedicated queue.
- **More than 3 background job types are needed.** pg_cron's 8-concurrent-job recommendation becomes constraining. This is the natural inflection point for a dedicated job service.
- **Railway Hobby plan $5 credit is consistently exhausted.** Monitor actual compute billing in the Railway dashboard. If the API outgrows the credit, either optimize (check for memory leaks, unnecessary processing) or upgrade to Railway Pro ($20/mo).
- **Team grows beyond solo developer.** Sentry's free tier is limited to 1 user. Railway Hobby is limited in collaboration features. The split architecture benefits from monorepo tooling (Turborepo) when multiple developers are pushing to both `web/` and `api/`.
- **Capture page build pipeline needs sub-second R2 uploads.** Railway API calls R2 over the network; Cloudflare Workers access R2 in-process. If build pipeline latency matters (it shouldn't for v1 — builds happen when an artist edits, not during fan capture), evaluate moving the build endpoint to a Worker.
 
---
 
## Validation Tasks
 
These should be completed during the Pre-Build Phase:
 
1. **[ ] Deploy a "hello world" Hono API to Railway.** Verify GitHub auto-deploy works, check actual compute cost after 24 hours idle, confirm log explorer is accessible.
2. **[ ] Deploy a Vite + React scaffold to Cloudflare Pages.** Verify build and deploy pipeline, confirm free tier limits are sufficient.
3. **[ ] Set up pg_cron + pg_net on Supabase.** Enable both extensions. Create a test cron job that fires an HTTP POST to the Railway API every 60 seconds. Verify `cron.job_run_details` records success/failure. Test: what happens when the Railway endpoint is down? (pg_net should record the failure in its response table.)
4. **[ ] Build and test the health-check endpoint.** Insert a fake "stuck" pending email (send_at 15 minutes ago, status pending). Verify `/api/health` returns 500. Wire to a free uptime monitor.
5. **[ ] Configure Sentry on both SPA and API.** Verify error capture from both. Trigger a test error in each. Confirm Sentry alerts arrive.
6. **[ ] Test the full delayed email flow end-to-end.** Insert a pending email with `send_at = NOW() + INTERVAL '2 minutes'`. Wait. Verify pg_cron picks it up, fires the HTTP request to Railway, Railway calls Resend, and the email arrives. Check `cron.job_run_details` and `pending_emails.status`.