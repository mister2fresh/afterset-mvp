# Phase 4 Code Review: Documentation

## Summary

CLAUDE.md is exceptionally accurate and serves as the de facto project guide — every claim (file structure, commands, dependencies, features, architecture) matches the actual codebase. The ADRs are best-in-class, with research, alternatives, and upgrade triggers documented for every decision. However, **there is no README.md**, inline code documentation is nearly nonexistent (zero JSDoc across the entire codebase), and no API spec exists. A new developer could onboard from CLAUDE.md + ADRs for the *what* and *why*, but would struggle with the *how* in complex components and API routes without reading raw source.

---

## README Gaps

- **No README.md exists.** A developer cloning this repo sees no entry point — CLAUDE.md is only useful if they know to look for it (or use Claude Code).
- Missing from any top-level doc:
  - **Prerequisites**: Node.js version, pnpm version, Supabase CLI, Wrangler CLI, OrbStack/Docker requirements
  - **First-run setup**: `pnpm install`, `.env` file creation from `.env.example`, Supabase local setup (`supabase start`), database migration steps
  - **Local development flow**: Which services to run simultaneously (`dev:web` + `dev:api` + `dev:worker`), what ports they bind, how auth works locally (Inbucket for magic links)
  - **Deployment steps**: How to deploy each service (Cloudflare Pages auto-deploy? Railway auto-deploy? Manual `pnpm deploy:worker`?)
  - **Contributing guide**: Branch conventions, PR process, test expectations

---

## CLAUDE.md Accuracy

CLAUDE.md is **99% accurate**. Verified against actual codebase:

| Category | Accuracy | Notes |
|---|---|---|
| File structure | 100% | All directories and files match |
| Commands | 100% | All `pnpm` scripts match `package.json` exactly |
| Dependencies | 100% | All major libs and versions correct |
| Features | 100% | Every documented feature is implemented |
| Architecture | 100% | ADRs, email service, SMS, broadcasts all present |
| Components list | 100% | All listed components exist |
| API routes | 100% | All endpoints match |
| Biome config | 100% | Tabs, 100-char, double quotes, semicolons confirmed |
| Env vars | 99% | See issues below |

**Issues found:**

1. **Unused documented env vars** — `api/.env.example` documents `TELNYX_API_KEY` and `SENTRY_DSN`, but neither has any reference in the codebase. They're either aspirational or leftover.

2. **CRASHCOURSE.md and QA-CHECKLIST.md are not mentioned** — Two substantial markdown files (57KB and 26KB respectively) exist at the project root but aren't referenced in CLAUDE.md's project structure section. These are valuable onboarding and testing resources that a new developer wouldn't discover.

3. **No mention of `api/src/lib/sms/` directory** — CLAUDE.md documents `api/src/lib/email/` but the parallel `api/src/lib/sms/` directory (SmsService abstraction referenced in ADR-005) is not listed in the project structure.

4. **Minor: review files not in .gitignore** — `review-phase1-readability.md`, `review-phase2-bloat.md`, `review-phase3-setup.md` (and now this file) are untracked but not ignored.

---

## High-Value Missing Documentation

### No API specification

No OpenAPI/Swagger spec, no route-level JSDoc, no API docs file. A frontend developer or third-party consumer cannot understand the API without reading source code. Key gaps:

- **Request/response shapes** — No exported TypeScript types for API responses. Zod schemas exist for request validation but response shapes are implicit.
- **Error codes** — Routes return 400/404/409/500 with JSON error bodies, but which errors each endpoint can return is undocumented.
- **Auth requirements** — No documentation of which routes require Bearer token vs. which are public (download, email webhooks, unsubscribe).

### `page-form.tsx` (1229 lines) — largest component, zero comments

- **Theme presets**: 6 color presets with magic hex values — no explanation of design rationale or how to add new ones
- **`isLightColor()` luminance formula**: Uses `0.299/0.587/0.114` RGB weights and threshold `150` — standard formula but unexplained, easy to break
- **`previewBackground()` gradient opacities**: Magic values `42`, `33` — no explanation of how they were chosen
- **`formFromPage()` / `stripEmpty()`**: Transform utilities with no JSDoc explaining input/output shapes
- **File upload flow**: Signed URL generation → XHR upload with progress → incentive enable — multi-step flow with no overview comment

### `broadcast-compose-dialog.tsx` (809 lines) — complex form, minimal comments

- Multi-step form state management with interdependent fields
- Preset templates array with no explanation of design intent
- Complex `useEffect` hooks with biome-ignore comments (justified, but the *business logic* they implement is undocumented)
- Segment filtering logic (page_ids, date range, method) — no explanation of how filters combine

### `sequence-step-editor.tsx` — business rules hidden in conditionals

- **Step 0 is special**: Welcome email has `delay_mode` (immediate/1_hour/next_morning) while steps 1–4 use `delay_days`. This critical business rule is encoded in `if (order === 0)` conditionals with no comment.
- **Delay validation**: `validateDelayMonotonic()` enforces that delay_days increase across steps — the rule and its purpose are undocumented.

### `worker/src/index.ts` (313 lines) — core capture flow, moderate documentation

- **Rate limiting implementation** (in-memory Map with 60s window) — works but no comment explaining why this is sufficient (Worker instances are ephemeral, limits are per-isolate)
- **Sequence email scheduling** — `calculateNextMorning()`, `calculateDaysSendAt()`, `calculateSendAt()` are clear functions but the *overall flow* (how a fan capture triggers a drip campaign) has no overview comment
- **`nineAmUtc()` timezone logic** — converts artist's local 9am to UTC, but edge cases (DST transitions, invalid timezones) aren't discussed

### `api/src/routes/send-batch.ts` — critical infrastructure, moderate documentation

- Top-level JSDoc explaining pg_cron integration exists (good)
- `claim_pending_emails` RPC function (Postgres `FOR UPDATE SKIP LOCKED`) prevents race conditions — the *why* of this pattern is undocumented
- Legacy vs. new template resolution fallback logic is complex and lacks step-by-step explanation
- Bearer token auth via `BATCH_SEND_SECRET` — not documented which system calls this endpoint

### `api/src/routes/incentive.ts` — poor documentation

- No endpoint-level documentation on any route
- File upload workflow (signed URL → R2 storage → auto-enable incentive link) is a multi-step process with no overview
- Storage bucket path structure (`artist_id/pageId/filename`) is undocumented
- File deletion cascade behavior is undocumented

### `api/src/routes/build.ts` — poor documentation

- No explanation of what "build" means in context (generate static HTML → upload to R2)
- `Promise.allSettled` in rebuild-all silently drops failures — no comment explaining this choice
- Return shape (slug, bytes) is undocumented

### Custom hooks — zero JSDoc across all hooks

- **`use-push-notifications.ts`**: Capacitor push notification flow with permission states, token registration, and listener cleanup — no documentation at all
- **`use-mobile.ts`**: 768px breakpoint constant is undocumented (matches Tailwind `md:` but that's not stated)
- **`web/src/lib/api.ts`**: Token refresh with 60-second threshold, XHR-based upload (why not fetch?), separate blob fetch function — none explained

### `api/src/routes/email-templates.ts` — sequence CRUD complexity

- Difference between legacy `/email-template` (singular) and new `/email-sequence` (plural) endpoints is undocumented in code — CLAUDE.md mentions it but the routes themselves don't explain the relationship
- `renumberStepsAfterDelete()` reindexes sequence steps — the algorithm and its constraints aren't explained

### `api/src/lib/email/render-template.ts` — email rendering

- `toEmailTheme()` converts capture page colors to email-safe theme — transformation rules undocumented
- Luminance threshold (150) for text contrast detection — same magic number as frontend, no shared constant or explanation
- Paragraph splitting (double newline → `<p>`) — implicit Markdown-lite behavior undocumented

---

## Type Hygiene

### `as unknown as T` — Supabase join result casting (9 occurrences)

Supabase's PostgREST client returns joined data as opaque types. The codebase works around this with double-cast patterns that bypass TypeScript entirely:

- **`api/src/routes/analytics.ts:110`** — `const fan = e.fan_captures as unknown as { email: string; name: string | null }`
- **`api/src/routes/analytics.ts:326`** — `const event = email.capture_events as unknown as { page_title: string | null }`
- **`api/src/routes/captures.ts:55-60`** — `row.fan_captures as unknown as { id: string; email: string; name: string | null }` and `row.capture_pages as unknown as { ... } | null`
- **`api/src/routes/captures.ts:138-139`** — Same pattern for CSV export
- **`api/src/routes/send-batch.ts:159-160`** — Streaming/social links cast
- **`api/src/routes/send-batch.ts:203-204`** — Same cast repeated
- **`api/src/routes/email-templates.ts:117-118`** — Streaming/social links
- **`api/src/routes/email-templates.ts:248-249`** — Same cast repeated

These inline type shapes are duplicated across files. A shared type (e.g., `FanCaptureRow`, `CapturePageJoin`) would reduce the blast radius when schema changes.

### `Record<string, string>` for JSON columns (6 occurrences)

- **`api/src/routes/broadcasts.ts:194-195`** — `streaming_links as Record<string, string>`, `social_links as Record<string, string>`
- **`api/src/routes/email-templates.ts:117-118`** — Same pattern
- **`api/src/routes/send-batch.ts:159-160`** — Same pattern

These JSON columns have known keys (`spotify`, `instagram`, `tiktok`, etc.) — a named type like `SocialLinks` / `StreamingLinks` would communicate the actual shape.

### Generated file (`routeTree.gen.ts`)

Multiple `as any` assertions — this is auto-generated by TanStack Router and excluded from lint. Not an issue.

### Zero `@ts-ignore` or `@ts-expect-error`

None found — good hygiene.

### Biome-ignore comments (4 total, all justified)

- **`web/src/components/page-form.tsx:376`** — `noArrayIndexKey` for static decorative placeholders
- **`web/src/components/broadcast-compose-dialog.tsx:285`** — exhaustive deps for ref-based callback
- **`web/src/components/broadcast-compose-dialog.tsx:317`** — intentional re-run on broadcastId change
- **`web/src/components/ui/sidebar.tsx:78,85,107`** — shadcn generated code

All four have inline explanations. No unjustified suppressions.

---

## What's Well-Documented

### ADRs are exceptional

Six ADRs in `afterset/docs/adr/` with research backing in `afterset/docs/research/`. Each includes: decision summary, context, alternatives considered (3–6 options with rationale), consequences (positive/negative/neutral), upgrade triggers with specific thresholds, and validation tasks. This is better documentation than most production systems.

### CLAUDE.md is remarkably accurate

Every claim verified — file structure, commands, dependencies, features, conventions, design tokens. This is the single best onboarding document in the project. The level of detail on email rendering, capture page constraints, and the single-page model is particularly valuable.

### Environment variable documentation

Both `web/.env.example` and `api/.env.example` exist with all required vars listed. Every env var used in code is documented (except the two unused ones noted above).

### Token/HMAC libraries

- **`api/src/lib/download-token.ts`** — Token format, HMAC signing, timing-safe comparison, expiry constant all clearly structured
- **`api/src/lib/email/unsubscribe-token.ts`** — Same high quality: payload structure documented, HMAC pattern consistent

### Email service abstraction

- **`api/src/lib/email/types.ts`** — Clean `EmailService` interface with `SendParams` and `SendResult` types
- **`api/src/lib/email/suppression.ts`** — `SuppressionReason` type clearly communicates the three suppression states

### Biome configuration

`biome.json` is well-configured with clear formatting rules, and the code consistently follows them.

### Help topics

`web/src/lib/help-topics.ts` is self-documenting structured content — a good example of in-app documentation that doubles as code documentation.

### CRASHCOURSE.md and QA-CHECKLIST.md

Two substantial onboarding/testing documents exist (57KB and 26KB). While not referenced from CLAUDE.md, they represent significant documentation effort.
