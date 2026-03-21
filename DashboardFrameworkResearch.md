# Afterset dashboard: framework and deployment architecture

**The optimal stack for a solo developer shipping an auth-gated SaaS dashboard under $50/month is a Vite + React SPA on Cloudflare Workers Static Assets paired with a Hono API on either Railway ($5/month) or Cloudflare Workers ($5/month), with Supabase handling background jobs via pg_cron.** This avoids SSR complexity that adds zero value behind auth, keeps infrastructure minimal, and lets you ship fastest. But the specifics matter — each option has real trade-offs that depend on how much operational simplicity you value versus raw cost savings. What follows is a detailed evaluation with verified 2025-2026 pricing and real developer experiences.

---

## Question 1: four backend targets compared head-to-head

### Vercel Pro with Inngest or Trigger.dev ($20/month)

Vercel Pro costs **$20/month per deploying seat** and includes 1M serverless function invocations, 16 CPU-hours, and 1TB bandwidth — all well above what 50-200 concurrent artist sessions would consume. With Fluid Compute enabled on Pro, function timeouts extend to **800 seconds** and Vercel claims **99.37% of requests experience zero cold starts** through its "scale to one" model that keeps at least one warm instance per function. The 5-10 second R2 build pipeline runs comfortably within these limits.

For background jobs, two strong options exist. **Inngest's free tier** provides 50,000 executions/month with sleeps up to 7 days. Its architecture is elegant: your app emits events to Inngest Cloud, which calls back to your Vercel functions via HTTPS for each step. A delayed email is just `await step.sleep("wait-1-hour", "1 hour")` followed by `await step.run("send-email", ...)` — sleeping consumes zero compute on either platform. Inngest joined the Vercel Marketplace in July 2025 with one-click integration. **Trigger.dev's free tier** gives a $5 monthly compute credit with 20 concurrent runs. Its key architectural difference: code runs on Trigger.dev's infrastructure (not your Vercel functions), meaning **no timeout limits at all** and no double-billing for compute. Waits longer than 5 seconds are checkpointed via CRIU, consuming zero resources.

The practical concern with Vercel is cost creep. Usage-based billing means you must set spending alerts (default $200 cap). Multiple developers report that Vercel works well for lightweight SaaS backends but struggles with background jobs and long-running processes — which is exactly why adding Inngest or Trigger.dev is the recommended pattern. **Estimated total: $20/month** (within included quotas).

### Railway with a persistent Node.js server ($5-8/month)

Railway's Hobby plan costs **$5/month and includes $5 of usage credits**. Critically, Railway bills based on **actual CPU and memory utilization**, not provisioned capacity — an idle server costs almost nothing. A low-traffic Node.js server using ~512MB RAM at 5-10% average CPU utilization runs **$1-3/month in actual usage**, fitting within the included credit. Real developer reports consistently confirm hobby projects staying well under the $5 threshold.

For background jobs, Railway offers the most straightforward path. You can run BullMQ with Railway's **one-click managed Redis** (~$2-3/month additional, bringing total to $7-8/month) for production-grade delayed job processing with persistence across restarts. But a simpler approach works for this scale: store scheduled jobs in a Supabase `pending_emails` table with a `scheduled_at` timestamp, then poll every 30-60 seconds with `node-cron`. Jobs persist in your existing database, adding zero infrastructure cost. Railway also provides **up to 50 native cron jobs** on the Hobby plan that can trigger HTTP endpoints on schedule.

Railway's DX is genuinely excellent for solo developers. GitHub auto-deploy works out of the box — push to main, deployed in under 2 minutes via Nixpacks (no Dockerfile required). **Preview environments for pull requests are built-in.** The visual project canvas, one-click rollbacks, configurable spending alerts, and 7-day log retention make it the most polished developer experience among persistent server options. **Estimated total: $5/month** (without Redis) or **$7-8/month** (with Redis).

### Fly.io persistent server ($5.50-16/month)

Fly.io charges purely usage-based with no subscription fee. A shared-cpu-1x machine with 512MB RAM costs **~$3.57/month always-on**, plus **$2/month for dedicated IPv4** (IPv6 is free). Without Redis, that's ~$5.57/month. However, Fly.io charges for **running time, not utilization** — an idle machine costs the same as a busy one, unlike Railway's utilization-based billing.

The Redis situation is Fly.io's biggest disadvantage for this use case. BullMQ requires Redis, and Fly.io's recommended option is Upstash at **$10/month fixed** (Upstash explicitly warns against pay-as-you-go with BullMQ due to aggressive polling). This pushes the total to **~$15-16/month** — three times Railway's cost for equivalent functionality.

Fly.io is CLI-first with no built-in GitHub auto-deploy (requires GitHub Actions setup), no native preview environments, and **no billing alerts**. Developer reports cite several gotchas: `$` characters in secrets getting replaced by flyctl, machines still billing when you think they're stopped, volumes billing after app deletion, and more operational complexity overall. Fly.io's core strength is **30+ global edge regions**, but multi-region deployment is irrelevant for 50-200 artists in a single geographic market. **Estimated total: $5.57/month** (without Redis) or **$15-16/month** (with Redis).

### Cloudflare Workers ($5/month)

The Workers paid plan at **$5/month** includes 10 million requests and 30 million CPU milliseconds — generous for this scale. The critical distinction developers often miss: **CPU time and wall-clock time are different things**. I/O waiting (R2 uploads, Supabase queries, Resend API calls, cache purges) does **not** count against CPU time. Only active JavaScript execution does, and the average Worker uses just ~2.2ms of CPU per request. This means the 5-10 second build pipeline is entirely feasible — if HTML generation takes 200-500ms of CPU and the rest is I/O waiting, total CPU consumption is well under the per-invocation limit.

For delayed emails, **Cloudflare Queues** supports `delaySeconds` up to 24 hours per message — perfect for 1-hour delays. Queue consumers get 15 minutes of CPU time. For next-morning emails, a **Cron Trigger** (`0 9 * * *`) queries a Supabase `pending_emails` table and sends the batch. Durable Object alarms offer per-event scheduling to any future timestamp. Cloudflare Workflows provide multi-step orchestration with `step.sleep()` for complex flows.

Node.js compatibility has improved dramatically. With the `nodejs_compat` flag, Workers now natively support `node:http`, `node:crypto`, `node:fs`, `node:net`, `node:streams`, and most standard library modules — implemented in C++ and TypeScript, not polyfills. **Supabase JS client works** (communicates via HTTP/PostgREST). **Resend SDK works** (Cloudflare maintains an official tutorial). **Stripe SDK works** with `Stripe.createFetchHttpClient()`. The main limitations: no native C++ addons, no `child_process`, no TCP server creation.

The developer experience pain points are real: the **128MB per-isolate memory limit** means you must stream large payloads, CPU time confusion catches newcomers, `eval()` is prohibited, and Cloudflare-specific bindings create some platform lock-in. But for this specific use case — a CRUD API with webhooks, scheduled jobs, and R2 integration — Workers is architecturally ideal since **R2 bindings are in-process** (zero network hop), and Hono provides an Express-like framework that Cloudflare itself uses internally. **Estimated total: ~$5/month.**

### Backend deployment verdict

| Platform | Monthly cost | Background jobs | DX for solo dev | Build pipeline feasible |
|----------|-------------|-----------------|-----------------|------------------------|
| **Vercel + Inngest** | $20 | Excellent (managed) | Good | Yes (800s limit) |
| **Railway** | $5-8 | Good (BullMQ or node-cron) | Excellent | Yes (no timeout) |
| **Fly.io** | $5.50-16 | Good (needs $10 Redis) | Fair | Yes (no timeout) |
| **Cloudflare Workers** | $5 | Good (Queues + Cron) | Good (learning curve) | Yes (I/O doesn't count) |

**Railway offers the best value proposition**: lowest cost with Redis ($7-8/month), best DX, no timeout concerns, native cron jobs, and the simplest mental model for a persistent server. Cloudflare Workers at $5/month is the cheapest option and architecturally elegant for this R2-heavy use case, but has a steeper learning curve. Vercel at $20/month is the most expensive and only makes sense if you choose a monolithic Next.js approach.

---

## Question 2: which frontend framework for an auth-gated dashboard

### The SSR question is settled — you don't need it

Multiple authoritative sources converge on this point: **SSR provides minimal benefit for auth-gated dashboards**. The Vue.js official SSR docs state it directly: "If you are building an internal dashboard where an extra few hundred milliseconds on initial load doesn't matter, SSR would be overkill." Server-side rendering's advantages — SEO, faster first contentful paint for content sites, social share previews — are irrelevant behind authentication. MakerKit measured the difference: static marketing pages load in 80-120ms (edge-cached) versus 250-400ms for dynamic dashboard pages with database queries. "The difference matters for SEO-critical pages but is barely noticeable for authenticated app routes."

One genuine SSR benefit exists: server-side auth checking redirects unauthenticated users before any HTML loads, avoiding a brief flash of the app shell. But this is solvable with a lightweight loading screen in an SPA. For an artist dashboard where users log in once and stay for a session, this is a non-issue.

### Vite + React SPA with TanStack Query (recommended)

A pure client-side React SPA eliminates entire categories of complexity. No Server Component versus Client Component boundary confusion. No caching model to learn. No middleware. No server runtime required. **Deploy as static files to Cloudflare Pages (free, unlimited) or any CDN** — the cheapest and simplest hosting possible.

**TanStack Query v5** is the key enabler — it handles caching, background refetches, optimistic updates, retries, deduplication, and stale-while-revalidate patterns. One developer reported "reduced data-fetching code by 85% while making everything more reliable" and "70% reduction in re-renders in complex dashboards." For CRUD operations, `useQuery` for reads and `useMutation` for writes with automatic cache invalidation is a clean, battle-tested pattern.

Auth via Supabase is straightforward client-side: `supabase.auth.getSession()` and `onAuthStateChange()` handle session management. Route protection through TanStack Router's `beforeLoad` guard. No SSR cookie complexity, no middleware token refresh, no three different client types.

The React component ecosystem is the **richest of any option**: shadcn/ui (dashboard templates built-in), Ant Design, Tremor (analytics-focused), TanStack Table for data grids, Recharts for charts. **Refine** deserves mention — a React meta-framework specifically for CRUD dashboards that ships with a Supabase data provider and uses TanStack Query internally.

### Next.js App Router: powerful but complex

Next.js 16.1 (December 2025) represents genuine stability — Turbopack file system caching, React Compiler, and the App Router are all production-ready. Supabase integration is **first-class** with official docs, starter templates, and a cookie-based auth pattern using middleware. The `@supabase/ssr` package + `middleware.ts` for token refresh is well-documented.

But the complexity tax is real. You need three different Supabase client types (browser, server component, route handler). You must understand Server versus Client Component boundaries. **Multiple critical CVEs were disclosed in 2025** (CVE-2025-55182 and CVE-2025-66478, both CVSS 10.0 RCE) affecting RSC deserialization, requiring immediate patches. Self-hosting works for single instances but multi-instance scaling requires shared caching solutions. Developer sentiment in GitHub Discussion #59373 reflects ongoing frustration with the mental model complexity.

For a solo developer building a CRUD dashboard, Next.js adds power you don't need at the cost of complexity you'll feel daily. It's the right choice if you expect significant public-facing marketing pages alongside the dashboard.

### React Router v7: best data patterns, less adoption

React Router v7 (the completed Remix → RR7 transition) offers the **cleanest data fetching pattern** for CRUD. Loaders fetch data before render; actions handle mutations with built-in progressive enhancement. Multiple comparison articles cite Remix/RR7 as the "DX winner" for data-heavy applications. It deploys anywhere (Vite-based, no vendor lock-in) and the full React ecosystem is available.

The trade-off: **no dedicated Supabase integration docs** (the framework-agnostic `@supabase/ssr` works but requires manual wiring), a smaller community than Next.js, and fewer SaaS starter templates. The separate "Remix 3" announcement exploring paradigms beyond React adds uncertainty about the project's long-term direction.

### SvelteKit: fastest to write, smallest ecosystem

SvelteKit with Svelte 5 runes produces the least boilerplate code — load functions and form actions are elegant, and the framework consistently ranks as the most admired in developer surveys. Apple uses Svelte in production. Component options include shadcn-svelte (7,500+ GitHub stars), Skeleton v3, and LayerChart for analytics.

The honest trade-off: the component ecosystem is **noticeably smaller than React's**. Supabase integration works via `@supabase/ssr` but community experiences are mixed — GitHub Discussion #13835 ("SvelteKit Auth - A Nightmare") documents real friction, though the situation has improved. For a solo developer who already knows React, switching to Svelte adds learning overhead (runes, different reactivity model) for modest DX gains.

### Frontend verdict

For an auth-gated artist dashboard with CRUD, analytics charts, and settings pages — built by a solo developer:

| Framework | Speed to ship | Ecosystem depth | Supabase auth | Complexity |
|-----------|--------------|-----------------|---------------|------------|
| **Vite + React SPA** | Fastest | Richest | Simple (client-side) | Lowest |
| **Next.js App Router** | Moderate | Richest | Best docs | Highest |
| **React Router v7** | Fast | Rich | Manual setup | Low-moderate |
| **SvelteKit** | Fast | Adequate | Mixed experiences | Low |

**Vite + React SPA wins** for this use case. Zero SSR overhead, simplest mental model, fastest time-to-ship, and the largest component library ecosystem. TanStack Query handles the data layer elegantly.

---

## Question 3: monorepo versus split at solo-dev scale

### The unified approach mostly works, with one critical gap

A single Next.js or SvelteKit codebase serving both frontend and API from one deployment is the fastest path to shipping. Type sharing is automatic, deployment is a single `git push`, and operational overhead is minimal. Lee Robinson's official Next.js guide explicitly endorses Route Handlers for webhooks, public APIs, and integrations.

But **node-cron does not work in serverless environments** — the process starts, handles one request, and gets destroyed. You cannot run persistent background processes on Vercel. This means a "fully unified" Next.js-on-Vercel approach needs an external service for delayed emails regardless: Inngest, Trigger.dev, or Supabase's own pg_cron.

### Supabase pg_cron is the underrated solution

Since you're already paying $25/month for Supabase Pro, **pg_cron is built-in at no extra cost**. It schedules recurring jobs using SQL or cron syntax, can trigger Edge Functions or HTTP webhooks, and runs up to 8 concurrent jobs with a 10-minute limit per job. For delayed emails: insert into a `pending_emails` table with a `send_at` timestamp, run a cron job every minute that queries for due emails and calls Resend. For next-morning emails: same pattern with `send_at` set to 9am the following day. One developer summarized it: "After a lot of trial and error, I found a 'Goldilocks' solution using just Supabase. Just a table and a cron job will get you a long way."

This means your architecture is effectively: frontend deployment (static or server-rendered) + Supabase (database + background jobs) + your API (wherever it lives). The "split" already exists at the database layer.

### What solo developers actually choose

The overwhelming pattern from indie hacker communities, Hacker News, and developer blogs is **unified or near-unified stacks**. Next.js + Supabase is repeatedly cited as a "killer stack" for solo SaaS. The consistent advice: "Start simple. One repo, one app. When you hit real pain points — not theoretical ones — then consider splitting." One founder's cautionary tale about splitting too early: "Every feature took 4 PRs. Every dependency update was a nightmare. We were spending 30% of our time managing repos instead of shipping features."

### The Turborepo middle ground

If you want a persistent server for background jobs alongside a separate frontend, **Turborepo in a single Git repo** is the best middle ground. Structure: `apps/web` (React SPA or Next.js), `apps/api` (Hono/Express on Railway), `packages/types` (shared TypeScript types). One `git clone`, one `pnpm install`, one `pnpm dev` runs everything. Each app deploys independently to its target platform. Selective builds via `--filter` flag, and content-aware caching cuts CI time by 60-80%. The next-forge SaaS template and multiple Vercel official templates use this exact pattern.

### Architecture recommendation

For Afterset specifically, the recommended path forward:

**Phase 1 (ship now):** Vite + React SPA deployed as static assets (Cloudflare Pages, free) + Hono API on Railway ($5/month) or Cloudflare Workers ($5/month). Background jobs via Supabase pg_cron (included in your $25/month Pro plan). Single Git repo with a simple folder structure — no monorepo tooling needed yet. **Total: $30-35/month** (Supabase $25 + compute $5-10).

**Phase 2 (if needed):** If the API grows complex enough to warrant it, introduce Turborepo to manage `apps/web` and `apps/api` with shared type packages. Add BullMQ + Redis on Railway if background job requirements exceed what pg_cron handles.

The key insight: **Supabase is already doing the heavy lifting.** Your database, auth, and background job scheduling are all handled by infrastructure you're already paying for. The remaining compute needs — a CRUD API, webhook handlers, and a 5-10 second build pipeline — are modest enough for the cheapest deployment option available.

---

## Conclusion

Three non-obvious findings emerge from this research. First, **Cloudflare Workers at $5/month is architecturally ideal** for an R2-heavy build pipeline because R2 bindings are in-process (zero network hop) and I/O waiting doesn't consume CPU time — but Railway's superior DX and simpler mental model may be worth the extra $0-3/month for a solo developer who wants to ship fast. Second, **SSR frameworks add substantial complexity for zero measurable benefit** in an auth-gated dashboard — the React ecosystem's most mature component libraries (shadcn/ui, TanStack Table, Recharts) work identically in a Vite SPA without the Server/Client Component boundary tax. Third, **Supabase pg_cron eliminates the strongest argument for a persistent server**, since delayed email scheduling is the one requirement that pushes toward always-on compute — and you already have it included in your database plan. The total architecture cost of SPA + Workers + Supabase comes to **$30/month**, well under budget, with zero server management overhead.