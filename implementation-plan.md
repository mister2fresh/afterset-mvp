# Implementation Plan

## Overview

The codebase is architecturally sound — clean package separation, consistent auth patterns, well-placed service abstractions, and thorough test coverage where it matters. Issues concentrate in three areas: **oversized components** (5 files over 200 lines, led by PageForm at 740 and BroadcastComposeDialog at 590), **utility duplication** (4 HTML-rendering functions copy-pasted 3-4x across API modules, one copy carrying a latent bug), and **accumulated dead weight** (7 unused npm dependencies, 165 lines of dead component code, phantom env vars). The API build pipeline is non-functional (`noEmit: true` + `tsc -b` produces nothing) but development works because `tsx watch` bypasses it. Overall, this is a healthy pre-beta codebase with localized problems — no systemic rot.

---

## Implementation Phases

### Phase A: Dead Code & Dependency Cleanup

- **Why first:** Removes noise before any refactoring. Prevents wasting effort extracting, documenting, or testing dead code. Reduces install size and import confusion.
- **Scope:** `web/package.json`, `web/src/components/` (3 files), `api/src/` (5 files), `web/src/` (2 config files), `web/.git/`, `web/src/assets/`, `web/public/`
- **Tasks:**
  - [ ] Delete `EmailTemplateDialog` from `email-template-dialog.tsx`; relocate `EmailTemplateBadge` to its own file or into `inline-sequence-editor.tsx` — **Critical** — (source: phase 2 dead code, phase 1 duplication)
  - [ ] Fix `capture-template.ts:149` dead ternary — `.pw a{color:...}` returns `"#6b7280"` for both branches (copy-paste bug, compare to line 148) — **Critical** — (source: phase 2 bug)
  - [ ] Delete `web/.git/` nested repo left over from Vite scaffolding — **Critical** — (source: phase 3)
  - [ ] Remove 7 unused deps from `web/package.json` (`@fontsource-variable/geist`, `@tanstack/react-table`, `next-themes`, `react-helmet-async`, `zod`, `@radix-ui/react-popover`, `@capacitor/splash-screen` — verify splash-screen isn't needed by native side before removing); move `shadcn` to devDependencies; remove unused devDeps (`vitest`, `workbox-window`) — **Moderate** — (source: phase 2 + phase 3 unused deps)
  - [ ] Clean `api/src/lib/email/index.ts` barrel: remove dead re-exports (`ResendEmailService`, `isSuppressed`, `SendParams`, `SendResult`, `createUnsubscribeToken`); keep only `getEmailService` and `getResendClient` — **Moderate** — (source: phase 2 dead barrel, phase 1 abstraction)
  - [ ] Remove dead slug-rename code from `capture-pages.ts` PATCH handler (lines 206-225) — UI only shows slug field in create mode per CLAUDE.md — **Moderate** — (source: phase 2 unwired feature)
  - [ ] Remove `SENTRY_DSN` and `TELNYX_API_KEY` from `api/.env.example` (never read by code); add missing `TELNYX_PHONE_NUMBER` — **Moderate** — (source: phase 3 phantom env)
  - [ ] Un-export internal-only symbols in `page-form.tsx` (`BackgroundStyle`, `ButtonStyle`, `FontStyle`, `TitleSize`, `LayoutStyle`, `FormData`, `EMPTY_FORM`, `formFromPage`, `THEME_PRESETS`, `CapturePagePreview`, `IncentiveFileDisplay`, `formatFileSize`) — **Moderate** — (source: phase 2 dead exports)
  - [ ] Un-export internal-only symbols in `sequence-step-editor.tsx` (`StepForm`, `EMPTY_STEP`, `formFromTemplate`, `ToggleSwitch`) — **Low** — (source: phase 2 dead exports)
  - [ ] Remove `CompactTable` component and `compact` prop from `captures-table.tsx` — **Low** — (source: phase 2 dead code)
  - [ ] Remove dead `export type Artist` from `api/src/middleware/auth.ts` — **Low** — (source: phase 2 dead exports)
  - [ ] Remove dead `export type DownloadPageParams` from `api/src/lib/download-page.ts` — **Low** — (source: phase 2 dead exports)
  - [ ] Remove `VITE_API_URL` from `web/src/vite-env.d.ts` and `web/.env.example` — **Low** — (source: phase 2 + phase 3 dead env)
  - [ ] Delete empty `web/src/assets/` directory — **Low** — (source: phase 3)
  - [ ] Deduplicate `web/public/favicon.svg` and `web/public/logo.svg` (byte-identical); keep one, update references in `index.html` — **Low** — (source: phase 3)

---

### Phase B: Config & Build Pipeline Fixes

- **Why second:** Fixes the broken production build story and cleans up config contradictions. Must happen before structural code changes so `pnpm build:api` and `pnpm typecheck` are trustworthy validation gates.
- **Scope:** `api/tsconfig.json`, `api/package.json`, `worker/package.json`, root `package.json`, `web/.gitignore`, `worker/wrangler.toml`
- **Tasks:**
  - [ ] Resolve `api/tsconfig.json` `noEmit: true` + `outDir: "dist"` contradiction — either remove `noEmit` to enable emit-based build, or change `start` script to use `tsx` and remove `outDir`/`rootDir` — **Critical** — (source: phase 1 + phase 2 + phase 3)
  - [ ] Fix `api/package.json` `build` and `start` scripts to match chosen tsconfig strategy — **Critical** — (source: phase 3 broken pipeline)
  - [ ] Remove redundant `esModuleInterop` from `api/tsconfig.json` (no-op when `verbatimModuleSyntax` is enabled) — **Low** — (source: phase 3)
  - [ ] Add `"rebuild-pages": "tsx src/scripts/rebuild-all-pages.ts"` script to `api/package.json` — **Low** — (source: phase 3 unwired script)
  - [ ] Rename `worker/package.json` `"publish"` to `"deploy"`; update root `deploy:worker` to match — **Low** — (source: phase 3)
  - [ ] Delete `web/.gitignore` — redundant with root `.gitignore` — **Low** — (source: phase 3)
  - [ ] Remove dead `ENVIRONMENT = "production"` var from `worker/wrangler.toml` (not in `Env` interface, never read) — **Low** — (source: phase 2 + phase 3 dead env)
  - [ ] Change root `test` script from `pnpm --filter api test` to `pnpm -r test` for consistency with `lint`/`typecheck` — **Low** — (source: phase 3)

---

### Phase C: Shared Utility & Type Extraction (API)

- **Why third:** Creates shared modules that eliminate 4x utility duplication (including a latent `escapeHtml` bug missing single-quote escaping) and consolidate inline type casts scattered across API routes. Must happen before component decomposition so extracted components import from clean shared modules.
- **Scope:** `api/src/lib/` (3 new files + 4 existing), `api/src/routes/` (5 files), `worker/src/index.ts`
- **Tasks:**
  - [ ] Create `api/src/lib/html-utils.ts` with canonical `escapeHtml` (including single-quote branch), `isLightColor`, `BUTTON_RADIUS`, `cssBackground`; update `capture-template.ts`, `download-page.ts`, `render-template.ts`, `icons.ts` to import from it — **Critical** — (source: phase 1 + phase 2 duplication; fixes render-template.ts missing single-quote bug)
  - [ ] Create `api/src/lib/timezone.ts` with shared `getTodayRange(tz)`; update `analytics.ts` and `broadcasts.ts` to use it instead of independent timezone-boundary implementations — **Moderate** — (source: phase 1 duplication, correctness risk)
  - [ ] Create `api/src/lib/supabase-types.ts` with shared types (`FanCaptureRow`, `CapturePageJoin`, `SocialLinks`, `StreamingLinks`); update inline `as unknown as {...}` casts in `analytics.ts`, `captures.ts`, `send-batch.ts`, `email-templates.ts`, `broadcasts.ts` — **Moderate** — (source: phase 4 type hygiene — 9 duplicated casts, 6 untyped JSON columns)
  - [ ] Extract `buildCapturesQuery(artistId, filters)` in `captures.ts` to deduplicate list and export handlers (~90% shared query logic) — **Moderate** — (source: phase 1 duplication)
  - [ ] Consolidate `ENTRY_METHODS` Set + `entryMethodMap` Record into a single data structure in `worker/src/index.ts`; move to module level alongside companion constants — **Low** — (source: phase 1 + phase 2 redundancy)
  - [ ] Type `SequenceTemplate.delay_mode` as `"immediate" | "1_hour" | "next_morning"` instead of `string` in worker — **Low** — (source: phase 1 weak typing)
  - [ ] Rename `nineAmUtc` to `localNineAmToUtc` in worker — **Low** — (source: phase 1 misleading name)

---

### Phase D: Frontend Type & Consistency Fixes

- **Why fourth:** Consolidates duplicated frontend types and fixes abstraction bypasses (3 components calling raw `fetch` instead of the typed `api` helper). Independent from Phase C so could run in parallel. Must precede component decomposition since extracted components will use these shared types.
- **Scope:** `web/src/lib/` (2 new files), `web/src/components/` (3 files), `web/src/routes/` (2 files), `web/src/hooks/` (1 file)
- **Tasks:**
  - [ ] Replace raw `fetch()` with `api` helper in `onboarding.tsx` (emailPreviewMutation, line 138), `broadcast-compose-dialog.tsx` (handlePreview, line 249), `sequence-step-editor.tsx` (preview, line 123) — bypasses token refresh and error normalization — **Critical** — (source: phase 1 abstraction bypass)
  - [ ] Create shared `Broadcast` type in `web/src/lib/types.ts`; update `broadcast-engagement.tsx` (5 fields), `broadcast-compose-dialog.tsx` (18 fields), `emails.tsx` (14 fields) to import it — **Moderate** — (source: phase 2 type duplication — 3 competing definitions)
  - [ ] Extract `getAllTimezones()` to `web/src/lib/timezones.ts`; deduplicate `ArtistSettings` type to `web/src/lib/types.ts`; update `settings.tsx` and `onboarding.tsx` — **Moderate** — (source: phase 1 duplication — different fallback lists)
  - [ ] Fix `use-mobile.ts` initial state: initialize from `window.innerWidth < MOBILE_BREAKPOINT` instead of `undefined` to prevent flash of desktop layout on mobile — **Moderate** — (source: phase 1)
  - [ ] Fix Recharts gradient `id` collisions in `daily-chart.tsx` and `show-drill-down.tsx` — use `useId()` instead of hardcoded strings — **Low** — (source: phase 1 SVG ID collision if two charts render simultaneously)

---

### Phase E: Component Decomposition

- **Why fifth:** Breaks apart the 5 oversized components that concentrate most readability issues. Depends on shared utilities (C) and types (D) being available. May span 2 sessions.
- **Scope:** `web/src/components/` (3 existing + 4-6 new files), `web/src/routes/` (3 files)
- **Tasks:**
  - [ ] Extract from `page-form.tsx` (740 lines): `ThemeEditor` (~213 lines, 848-1061), `IncentiveUploader` (~66 lines, 1063-1129), `LinkEditor` (~70 lines, 1131-1201), `KeywordField` (~70 lines, 776-846); derive `applyPreset`/`isPresetActive` from shared `THEME_FIELDS` array to prevent drift — **Critical** — (source: phase 1 oversized)
  - [ ] Extract `page-form.tsx` mutation logic: pull file upload and keyword save/remove out of the `useMutation` `mutationFn` (lines 595-653) into named async functions — **Moderate** — (source: phase 1)
  - [ ] Refactor `broadcast-compose-dialog.tsx` (590 lines, 14 `useState` calls): consolidate into `useReducer` or single form-state object; the reset logic (lines 139-166) is a wall of setters that's easy to get wrong — **Critical** — (source: phase 1)
  - [ ] Decompose `onboarding.tsx` (305 lines, 13+ state variables): extract each wizard step into its own component; reduce `EmailStep` from 16 props by grouping into objects (e.g., `emailForm: { subject, body, delayMode, includeIncentive }`) or using context — **Critical** — (source: phase 1 oversized + prop bloat)
  - [ ] Extract from `fans.tsx` (228 lines): `FilterBar` (lines 111-185) and `ActiveFilterBadges` (lines 188-245) — **Moderate** — (source: phase 1)
  - [ ] Extract from `pages.tsx` `PageCard` (226 lines): inline-edit block (lines 243-274) and QR/download section (lines 333-351) into sub-components — **Moderate** — (source: phase 1)

---

### Phase F: API & Worker Function Extraction

- **Why sixth:** Breaks apart oversized API route handlers. Could run in parallel with Phase E since they touch different packages.
- **Scope:** `api/src/routes/` (5 files), `api/src/index.ts`, `worker/src/index.ts`
- **Tasks:**
  - [ ] Decompose `send-batch.ts` POST handler (~360 lines) into named functions: `claimPendingRows()`, `resolveSendParams()`, `updateBroadcastStats()` — **Critical** — (source: phase 1 oversized)
  - [ ] Batch provider message ID updates in `send-batch.ts` (lines 330-335) into a single query instead of sequential per-email DB calls (50 serial queries at batch limit) — **Critical** — (source: phase 1)
  - [ ] Extract `groupEventsByTitle(rows)` from analytics overview handler (lines 259-388, 6 Maps in one loop) — **Moderate** — (source: phase 1)
  - [ ] Extract `renderPreview()` helper from `email-templates.ts` to deduplicate legacy (lines 94-122) and sequence (lines 226-253) preview handlers — **Moderate** — (source: phase 1)
  - [ ] Split worker `handleCapture` (132 lines) into `parseSubmission()`, `lookupPage()`, `persistCapture()` — **Moderate** — (source: phase 1)
  - [ ] Replace `.catch(() => {})` on `buildPage()` calls in `capture-pages.ts` (lines 144, 239, 269) with `.catch((e) => console.error("build failed", e))` — **Moderate** — (source: phase 1 silent failures)
  - [ ] Add inline route-ownership comments to `api/src/index.ts` for the 6 modules all mounted at `/api/capture-pages` — **Low** — (source: phase 1)
  - [ ] Consolidate repeated auth middleware mounting in `api/src/index.ts` (6 separate `.use()` calls) into grouped sub-app or wildcard — **Low** — (source: phase 1)

---

### Phase G: Documentation

- **Why last:** Documents the stabilized codebase after structural changes are complete. Updating docs before refactoring would create stale documentation.
- **Scope:** Root `README.md` (new), `CLAUDE.md`, targeted inline comments
- **Tasks:**
  - [ ] Create `README.md` with prerequisites (Node.js, pnpm, Supabase CLI, Wrangler), first-run setup (`pnpm install`, `.env` creation, Supabase local, migrations), local dev flow (which services + ports + auth), and deployment overview — **Moderate** — (source: phase 4 — no README exists)
  - [ ] Add comment to `sequence-step-editor.tsx` explaining step 0 special behavior (`delay_mode` vs `delay_days`) and `validateDelayMonotonic()` purpose — **Moderate** — (source: phase 4 hidden business rules)
  - [ ] Update `CLAUDE.md` project structure: add `api/src/lib/sms/` directory, reference `CRASHCOURSE.md` and `QA-CHECKLIST.md` — **Low** — (source: phase 4 accuracy gaps)
  - [ ] Add overview comment to worker capture-to-drip flow (how fan capture triggers email sequence scheduling) — **Low** — (source: phase 4)
  - [ ] Add comment to `capture-template.ts` inline `<script>` explaining the offline-queue logic (~1200 chars of minified JS) — **Low** — (source: phase 1)

---

## Parking Lot (not worth doing now)

**Cosmetic naming/style (no behavioral impact):**
- `TokenPayload` single-letter keys (`p`, `x`, `e`, `a`, `t`) in download-token.ts / unsubscribe-token.ts — wire format optimization, fine as-is (phase 1)
- `supabaseRpc` → `supabaseFetch` rename in worker — cosmetic (phase 1)
- `formatComparison` silently hides negative diffs — intentional UX choice (phase 1)
- `StatCard` defaults to `TrendingUp` icon when none passed — cosmetic (phase 1)
- `TopicBody` / `flushList` rename in help.tsx — cosmetic (phase 1)
- IIFE inside JSX for file type icon in pages.tsx — cosmetic (phase 1)
- `notFound()` single-line HTML in worker — cosmetic (phase 1)
- Worker slug regex comment — low-traffic code (phase 1)
- `METHOD_LABELS` intentionally differ between captures-table.tsx and show-drill-down.tsx — correct behavior, different contexts (phase 2)

**Low-risk code improvements (working correctly today):**
- `useQrPreview` uses useEffect+useCallback instead of useQuery in pages.tsx — works, onboarding already does it right (phase 1)
- Worker invalid entry method silently defaults to `"d"` — intentional safe fallback (phase 1)
- Onboarding `setState` during render — works, `useEffect` is debatable improvement (phase 1)
- `void subscription` in auth.ts — intentional for app-global listener lifetime, add comment if touching file (phase 1 + phase 2)
- `handleNewBroadcast` uses own state instead of `useMutation` in emails.tsx — works fine (phase 1)
- `handlePreviewBroadcast` declared `async` but never awaits — cosmetic (phase 1)
- Archived broadcasts filtered client-side twice in emails.tsx — negligible perf (phase 1)
- Raw `<select>` instead of shadcn Select in broadcast-compose-dialog — cosmetic (phase 1)
- `CapturesByShow` takes 7 props (exceeds 4-param guideline) — moderate complexity but works (phase 1)
- `formatInline` uses bold text as React key in help.tsx — collision requires duplicate bold phrases, unlikely (phase 1)
- `handleResend` silently swallows errors in login.tsx — low-traffic flow (phase 1)
- `useDebouncedCheck` hook extraction (page-form, keyword-dialog) — only 2-3 occurrences, below extraction threshold (phase 1)
- `api.ts` `return undefined as T` type lie for 204 responses — low risk, contained (phase 1)
- `build-page.ts` retry loop has no logging on intermediate failures — add if touching file (phase 1)
- `broadcast-compose-dialog.tsx` `fieldsRef` tracking 8 fields lacks explanation comment — add if touching file for Phase E (phase 1)
- `page-form.tsx:294` hex `${secondary}42` alpha opacity — add `// 42 hex = ~26% alpha` comment during Phase E extraction (phase 1)
- `analytics.ts:27` getTodayRange locale-parsing trick — will get a comment naturally when consolidated in Phase C (phase 1)
- `COMMON_TIMEZONES` fallback in settings.tsx — harmless safety net for older browsers (phase 2)
- `getResendClient()` exposes raw Resend through EmailService abstraction — only used for webhook verification, contained (phase 1)
- `web/vite.config.ts` PWA runtime caching regex matches any domain's `/api/` — low risk, only one domain in practice (phase 1)

**Dependencies & config (working, not worth churn):**
- `@biomejs/biome` in all 3 packages vs root-only — pnpm workspace handles it (phase 2)
- `capacitor.ts` thin wrappers around `Capacitor.isNativePlatform()` — 1 consumer, negligible (phase 2)
- `web/tsconfig.json` duplicate path alias alongside `tsconfig.app.json` — IDE compatibility, leave as-is (phase 3)
- `supabase/config.toml` is 390 lines with ~5 customized — CLI-managed, don't touch (phase 3)
- Capacitor scripts not exposed at root — requires Mac, niche use case (phase 3)
- `wrangler.toml` hardcodes `SUPABASE_URL` while other packages use `.env` — not a secret, style preference (phase 3)

**Structural/organizational (cosmetic or management decisions):**
- Flatten `afterset/docs/` to root `docs/` — would need to update references (phase 3)
- Root scratch HTML files (`afterset-ig-post*.html`, `icon-preview.html`) — untracked, harmless (phase 3)
- `TASKS.md` at 63KB could archive completed items — management decision, not code quality (phase 3)
- `analytics.tsx` is a vestigial 4-line redirect to `/dashboard` — harmless (phase 2)
- `sidebar.tsx` has 11 unused shadcn subcomponent exports — standard kit, not worth trimming (phase 2)
- Review markdown files not in `.gitignore` — temporary files (phase 4)

**Documentation (premature at pre-beta stage):**
- Full API spec / OpenAPI — too much churn, defer to post-launch (phase 4)
- JSDoc on all custom hooks — overkill for solo/small team (phase 4)
- `incentive.ts` and `build.ts` route documentation — low-traffic routes, code is readable (phase 4)
- `render-template.ts` `toEmailTheme` transformation docs — code is self-explanatory (phase 4)
- `email-templates.ts` legacy vs sequence endpoint relationship docs — CLAUDE.md already covers this (phase 4)
- Worker rate limiter is per-isolate (not global) — intentionally "best effort" per Phase 1's own assessment; add comment if touching file (phase 2 + phase 4)
