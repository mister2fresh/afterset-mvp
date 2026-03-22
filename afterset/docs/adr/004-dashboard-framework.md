# ADR-004: Dashboard Application Framework and Deployment Architecture

**Status:** Accepted  
**Date:** 2026-03-21  
**Deciders:** [Author]  
**Supersedes:** None  
**Related:** ADR-001 (Supabase Pro), ADR-002 (Resend), ADR-003 (Capture Pages on Cloudflare R2)

---

## Decision

The Afterset artist dashboard will be built as a **Vite + React single-page application** deployed as static assets to **Cloudflare Pages** (free tier), backed by a **Hono API deployed to Railway** (Hobby plan, $5/month). Background jobs (delayed follow-up emails) will be handled by **Supabase pg_cron** (included in the existing Pro plan from ADR-001). The frontend and API will live in a **single Git repository** with a simple folder structure (`web/` and `api/`), without monorepo tooling at launch.

---

## Context

The Afterset product has two surfaces. The fan-facing capture pages are static HTML on Cloudflare R2 (ADR-003). The remaining surface is an auth-gated SaaS dashboard where artists manage capture pages, view analytics, manage fans, configure follow-up emails, and handle billing.

The dashboard's backend responsibilities are:

- Auth (Supabase Auth, magic links + OAuth)
- CRUD API for capture pages, fans, email templates
- A build pipeline that generates static HTML, uploads to R2, and purges CDN cache (5–10 seconds per run)
- Webhook handlers (Twilio SMS, Stripe billing)
- Delayed email sending (1 hour or next morning after fan capture) — requires scheduled/background jobs
- Analytics aggregation queries

Key constraints shaping this decision:

- **Solo developer.** DX, ecosystem maturity, and speed to ship v1 are primary concerns.
- **Budget: under $50/month total.** Supabase Pro is already $25/month (ADR-001).
- **Low dashboard traffic.** 50–200 concurrent artist sessions at scale. This is not a high-traffic frontend.
- **Background jobs are a core feature,** not optional. Delayed emails must be reliable.
- **Capture page form submissions bypass the app server entirely** (POST to a Cloudflare Worker per ADR-003). The dashboard handles only artist-facing traffic.
- **Avoid deep platform lock-in** to a single vendor where practical.

---

## Options Considered

### Sub-decision A: Backend Deployment

#### A1. Vercel Pro + Inngest

Vercel Pro at $20/month per seat. Serverless functions with 800-second timeout (Fluid Compute). Inngest free tier (50K executions/month) for delayed email orchestration via `step.sleep()`. Strong Next.js integration. Cold starts effectively eliminated on Pro (Vercel reports 99.37% of requests hit warm instances). R2 build pipeline runs within timeout limits.

#### A2. Railway Hobby Plan (persistent Node.js server)

$5/month with $5 usage credit included. Bills on actual CPU/memory utilization, not provisioned capacity. A low-traffic Node.js server runs $1–3/month in actual usage, fitting within the included credit. Native GitHub auto-deploy, preview environments, one-click rollbacks, up to 50 cron jobs included. Optional managed Redis add-on (~$2–3/month) for BullMQ if needed.

#### A3. Fly.io (persistent Node.js server)

Usage-based, no subscription. ~$3.57/month for shared-cpu-1x (512MB RAM) + $2/month for dedicated IPv4. Bills on running time regardless of utilization. BullMQ requires Upstash Redis at $10/month fixed (pay-as-you-go incompatible with BullMQ polling). CLI-first, no built-in GitHub auto-deploy or preview environments, no billing alerts.

#### A4. Cloudflare Workers ($5/month paid plan)

10M requests and 30M CPU-ms included. I/O waiting (R2 uploads, Supabase queries, Resend calls) does not count against CPU time, making the 5–10 second build pipeline feasible. In-process R2 bindings (zero network hop). Cloudflare Queues supports `delaySeconds` up to 24 hours for delayed emails. Cron Triggers for batch jobs. Supabase JS, Resend SDK, and Stripe SDK all confirmed compatible. 128MB per-isolate memory limit; no native C++ addons or `child_process`.

### Sub-decision B: Frontend Framework

#### B1. Vite + React SPA (with TanStack Query)

Client-side only. Deploy as static files to any CDN. TanStack Query v5 for caching, background refetch, optimistic updates. Supabase auth via client-side `getSession()` / `onAuthStateChange()`. Full access to the React component ecosystem (shadcn/ui, TanStack Table, Recharts, Tremor). No SSR complexity.

#### B2. Next.js 16 (App Router)

SSR/SSG/ISR flexibility. Server Components, Server Actions, middleware-based auth. First-class Supabase integration with official docs and `@supabase/ssr`. Requires three different Supabase client types (browser, server component, route handler). Multiple critical CVEs disclosed in 2025 (CVSS 10.0 RCE). Heaviest framework complexity. Best option if significant public-facing pages exist alongside the dashboard.

#### B3. React Router v7 (formerly Remix)

Loader/action data pattern. Vite-based, deploys anywhere. Full React ecosystem available. No dedicated Supabase integration docs. Smaller community than Next.js. "Remix 3" announcement exploring non-React paradigms adds directional uncertainty.

#### B4. SvelteKit

Least boilerplate. Load functions and form actions are elegant. Svelte 5 runes. Smaller component ecosystem than React. Supabase auth integration has documented friction (GitHub Discussion #13835). Switching cost for a developer who already knows React.

### Sub-decision C: Repository Structure

#### C1. Single repo, simple folders

One Git repo. `web/` for the SPA, `api/` for the Hono server. Shared types via TypeScript path aliases. No monorepo tooling.

#### C2. Turborepo monorepo

One Git repo. `apps/web/`, `apps/api/`, `packages/types/`. Selective builds via `--filter`. Content-aware caching. Adds tooling overhead but supports independent deployment targets.

#### C3. Separate repositories

Independent repos for frontend and API. Independent CI/CD. Type sharing via published npm package or copy-paste.

---

## Rationale

### A2 (Railway) over other backend targets

Railway wins on the combination of cost, DX, and operational simplicity.

**Cost.** At $5/month with usage-based billing inside the included credit, Railway is the cheapest option that provides a full persistent server. Cloudflare Workers matches on price ($5/month) but trades operational simplicity for it. Vercel at $20/month is 4× more expensive for equivalent capability. Fly.io reaches $15–16/month with the Redis required for reliable background jobs.

**Background jobs.** A persistent server can run `node-cron` or BullMQ natively — no external service required. The delayed email workflow is a simple polling loop: query `pending_emails WHERE send_at <= NOW() AND status = 'pending'`, send via Resend, update status. This runs in-process with zero additional infrastructure. Vercel requires bolting on Inngest or Trigger.dev. Cloudflare Workers requires learning Queues, Cron Triggers, or Durable Objects — each a new primitive.

**DX.** Railway provides GitHub auto-deploy, preview environments, one-click rollbacks, visual project canvas, and configurable spend alerts — all out of the box. Fly.io requires manual GitHub Actions setup and has no billing alerts. Cloudflare Workers requires learning the Workers runtime model, binding system, and `wrangler` CLI.

**R2 build pipeline.** A persistent server has no timeout. The 5–10 second HTML generation + R2 upload + cache purge runs as a normal async function. No timeout concerns, no CPU-time accounting, no cold start risk.

**Why not Cloudflare Workers?** Workers is the architecturally purest option for this R2-heavy workload (in-process bindings, zero network hop). It was a close second. The deciding factors against it: (a) the 128MB memory limit requires careful streaming for any future growth in build complexity, (b) the CPU-time-versus-wall-clock distinction is a footgun for a solo developer debugging production issues, (c) `node-cron` background polling doesn't work in a request-driven isolate model, requiring Cloudflare-specific primitives, and (d) Railway's DX advantage (preview envs, visual canvas, spending alerts) is material for shipping speed. If the budget were tighter or R2 upload latency were critical, Workers would be the choice.

**Why not Vercel?** $20/month is 80% of the remaining budget after Supabase. The serverless model requires an external job runner for delayed emails — adding a dependency (Inngest or Trigger.dev) that could change pricing or have outages. The capability is equivalent to Railway + pg_cron at 4× the cost.

### B1 (Vite + React SPA) over other frontend frameworks

**SSR adds zero value behind authentication.** The dashboard is entirely auth-gated. There are no public pages requiring SEO, no social share previews, no content that benefits from server-side rendering. Multiple authoritative sources confirm: SSR for internal/auth-gated apps is overkill. The marketing site at afterset.net is already a separate Next.js deployment on Vercel.

**Simplest mental model.** No Server Component vs. Client Component boundaries. No middleware. No three different Supabase client initialization patterns. No caching model to learn. One React app that talks to one API. TanStack Query handles all data fetching concerns (caching, refetch, optimistic updates, deduplication) in a well-documented, framework-agnostic way.

**Fastest to ship.** `npm create vite@latest` → add TanStack Query + Router → add shadcn/ui → connect to Supabase client-side → deploy static files. No build server. No SSR runtime. No framework-specific deployment configuration.

**Cheapest to host.** Static files on Cloudflare Pages (free, unlimited bandwidth) or any CDN. The frontend costs $0/month.

**Largest ecosystem.** The React component ecosystem is the deepest available: shadcn/ui dashboard templates, TanStack Table for the fan list/CRM, Recharts for analytics charts, and Refine as a potential CRUD accelerator with a native Supabase data provider.

**Why not Next.js?** Complexity cost without corresponding benefit. The App Router's Server Component model, middleware auth flow, and three Supabase client types add cognitive overhead that only pays off for public-facing content. The 2025 CVEs (CVSS 10.0) demonstrate the security surface area of server-side rendering. If the dashboard and marketing site were in one codebase, Next.js would be reconsidered.

**Why not React Router v7?** A viable alternative with cleaner data patterns (loaders/actions) than raw TanStack Query. Passed over due to: no official Supabase integration docs, smaller community and fewer SaaS starter templates, and directional uncertainty from the "Remix 3" announcement. If the Remix ecosystem stabilizes and Supabase publishes an integration guide, this becomes the strongest competitor.

**Why not SvelteKit?** Genuine DX advantages in code volume and reactivity, but the component ecosystem gap versus React is real for a dashboard (fewer table components, fewer chart libraries, fewer auth examples). The Supabase auth friction documented in community discussions is a risk for a solo developer who can't afford multi-day debugging sessions.

### C1 (single repo, simple folders) over other structures

**Solo developer, one product, two deployment targets.** The overhead of Turborepo (config, workspace dependencies, selective build filters) is unjustified when one person is shipping one dashboard. A flat `web/` + `api/` structure with TypeScript path aliases for shared types achieves the same goals with zero tooling.

**Separate repos are strictly worse at this scale.** Every feature touching both frontend and API becomes two PRs, two reviews, two deploys. Type drift between repos is inevitable. The "30% of time managing repos instead of shipping features" pattern from real-world reports applies directly.

**Turborepo remains the upgrade path.** If a second developer joins, or if the API grows complex enough to warrant independent CI, migrating from flat folders to Turborepo workspaces is a half-day refactor, not an architecture change.

---

## Consequences

### Positive

- **Total infrastructure cost: ~$30/month.** Supabase Pro ($25) + Railway Hobby ($5) + Cloudflare Pages ($0). Well under the $50 budget with headroom for growth.
- **No external job scheduler dependency.** Background jobs run either in-process on Railway (node-cron) or via Supabase pg_cron — both already-paid-for infrastructure.
- **No vendor lock-in on any single platform.** The SPA deploys to any static host. The Hono API runs on any Node.js host. Supabase is the deepest dependency, but it's an open-source Postgres stack.
- **Fastest path to v1.** No SSR complexity, no framework-specific deployment quirks, no external service integrations beyond what's already decided (Supabase, Resend, Cloudflare R2).
- **The React ecosystem de-risks UI development.** Component library availability for dashboards, data tables, and charts is unmatched.

### Negative

- **No SSR means a brief loading state on initial page load.** Users see a spinner or skeleton for 100–300ms while the SPA hydrates and fetches the initial session. Mitigated by a lightweight app shell and TanStack Query's stale-while-revalidate pattern.
- **Railway is a startup.** Smaller than Vercel, Cloudflare, or AWS. If Railway shuts down or changes pricing, the Hono API must migrate. Mitigated by: Hono is framework-agnostic (runs on Cloudflare Workers, Fly.io, AWS Lambda, any Node.js host), and the migration is a deployment config change, not a rewrite.
- **Two deployment targets instead of one.** `web/` deploys to Cloudflare Pages, `api/` deploys to Railway. Two CI/CD pipelines, two sets of environment variables, two monitoring surfaces. Acceptable at this scale; would become painful at 3+ services.
- **TanStack Query requires discipline.** Without SSR's forced data-fetching patterns, the developer must be intentional about cache keys, invalidation, and loading states. Mitigated by TanStack Query's strong documentation and well-established patterns.
- **pg_cron jobs are limited to 10-minute execution and 8 concurrent runs.** Sufficient for current requirements (batch email sends) but may constrain future job complexity. Mitigated by the Railway server as a fallback for heavier background processing.

### Neutral

- **Hono is less widely adopted than Express.** Hono is gaining rapid adoption (especially in the Cloudflare ecosystem) and its API is Express-like, but Express has deeper middleware ecosystem and more Stack Overflow answers. This is a manageable trade-off given Hono's portability advantage across runtimes.
- **The marketing site (Next.js on Vercel) and the dashboard (Vite SPA on Cloudflare Pages) are separate codebases.** This is intentional — the marketing site has different requirements (SEO, public content) and a different deployment target. No shared code is expected between them beyond brand assets.

---

## Revisit When

| Trigger | Reconsider |
|---|---|
| **Railway pricing changes or service instability** | Migrate Hono API to Cloudflare Workers ($5/month, in-process R2 bindings) or Fly.io. The Hono framework runs on all three with minimal config changes. |
| **Dashboard needs public-facing pages** (e.g., public artist profiles, shared analytics) | Re-evaluate Next.js or React Router v7 for SSR on those specific routes. Consider a hybrid: SPA dashboard + SSR public routes in the same codebase. |
| **Background job complexity exceeds pg_cron** (jobs longer than 10 minutes, complex multi-step workflows, >8 concurrent jobs) | Add BullMQ + Railway managed Redis (~$2–3/month) for a proper job queue with retries, priorities, and progress tracking. Alternatively, evaluate Inngest or Trigger.dev if the workflow orchestration complexity justifies an external service. |
| **Second developer joins the team** | Introduce Turborepo workspaces to formalize the `web/` and `api/` boundary with independent build caching and selective CI. |
| **10K+ artists with concurrent dashboard usage** | Evaluate whether Railway's single-instance model handles the load, or whether horizontal scaling (multiple Railway services behind a load balancer, or migration to Fly.io for multi-region) is needed. At this scale, also re-evaluate whether the SPA + API split should become a BFF (backend-for-frontend) pattern. |
| **Supabase Auth limitations surface** (e.g., need for custom auth flows, SAML/SSO for enterprise artists) | Evaluate migrating to a dedicated auth provider (Clerk, Auth0) or self-hosted solution. The client-side SPA pattern makes auth provider swaps straightforward since auth is handled at the API layer, not in SSR middleware. |
| **React Router v7 ecosystem matures** (official Supabase docs, stable direction post-Remix 3 announcement) | Re-evaluate for the next major frontend refactor. The loader/action pattern is a better fit for CRUD dashboards than raw TanStack Query if the ecosystem support catches up. |

---

## Appendix: Delayed Email Workflow (Concrete Implementation)

The following describes the exact code path for the core delayed-email feature under this architecture.

**Step 1: Fan submits capture form.** The Cloudflare Worker (ADR-003) writes a row to Supabase `fan_captures` and a row to `pending_emails` with `send_at = NOW() + INTERVAL '1 hour'` (or `send_at = DATE_TRUNC('day', NOW()) + INTERVAL '1 day 9 hours'` for next-morning).

**Step 2: pg_cron polls every minute.** A Supabase cron job runs:
```sql
SELECT cron.schedule(
  'process-pending-emails',
  '* * * * *',
  $$
    SELECT net.http_post(
      url := 'https://api.afterset.net/jobs/send-pending-emails',
      headers := jsonb_build_object('Authorization', 'Bearer <service-key>'),
      body := '{}'::jsonb
    );
  $$
);
```

**Step 3: Railway API handles the job.** The `/jobs/send-pending-emails` endpoint queries `pending_emails WHERE send_at <= NOW() AND status = 'pending'`, sends each via Resend, and updates status to `sent`. Failed sends are retried on the next cycle with an incremented `retry_count`.

**Step 4: Fallback.** If Railway is temporarily unreachable, pg_cron's HTTP call fails silently. Pending emails accumulate and are sent on the next successful cycle. No emails are lost because state lives in the database, not in memory.

---

## Appendix: Cost Projection

| Component | Launch (0–500 artists) | Growth (500–5K artists) | Scale (5K–10K artists) |
|---|---|---|---|
| Supabase Pro | $25/month | $25/month | $25/month (monitor row counts) |
| Railway Hobby | $5/month | $5/month | $5–10/month (usage may exceed credit) |
| Cloudflare Pages | $0 | $0 | $0 |
| Resend (ADR-002) | $0 (free tier) | $20/month (est.) | $20–50/month (est.) |
| **Total** | **$30/month** | **$50/month** | **$50–85/month** |
