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

### Phase B: Config & Build Pipeline Fixes ✅

- **Completed 2026-04-04**
- **Approach:** Production now uses `tsx` (same as dev) instead of broken `tsc -b` emit. `build` is a typecheck gate, `start` runs `tsx src/index.ts` directly.
- **Tasks:**
  - [x] Resolve `api/tsconfig.json` — removed `outDir`/`rootDir` (not needed with noEmit), removed redundant `esModuleInterop`
  - [x] Fix `api/package.json` — `build` → `tsc --noEmit`, `start` → `tsx src/index.ts`, added `rebuild-pages` script
  - [x] Rename `worker/package.json` `"publish"` → `"deploy"`; updated root `deploy:worker`
  - [x] Delete `web/.gitignore` — merged useful patterns (`*.log`, `.DS_Store`, `*.sw?`) to root `.gitignore`
  - [x] Remove dead `ENVIRONMENT = "production"` from `worker/wrangler.toml`
  - [x] Change root `test` to `pnpm -r test` for consistency with `lint`/`typecheck`

---

### Phase C: Shared Utility & Type Extraction (API) ✅

- **Completed 2026-04-04**
- **Tasks:**
  - [x] Created `api/src/lib/html-utils.ts` — canonical `escapeHtml` (with single-quote fix for render-template.ts bug), `isLightColor`, `BUTTON_RADIUS`, `cssBackground`; updated 4 consumers
  - [x] Created `api/src/lib/timezone.ts` — shared `getTodayRange(tz)`; updated `analytics.ts` and `broadcasts.ts`
  - [x] Extracted `applyFilters()` in `captures.ts` — deduplicates filter logic between list and export handlers while preserving Supabase's literal-type inference on `.select()`
  - [x] Consolidated `ENTRY_METHODS` Set + `entryMethodMap` → single `ENTRY_METHOD_MAP` const in worker
  - [x] Typed `SequenceTemplate.delay_mode` as `"immediate" | "1_hour" | "next_morning"` union
  - [x] Renamed `nineAmUtc` → `localNineAmToUtc` in worker
  - Skipped `supabase-types.ts` — inline casts only appear 2x cross-file (below 3x extraction threshold); captures dedup resolved the within-file duplication

---

### Phase D: Frontend Type & Consistency Fixes ✅

- **Completed 2026-04-04**
- **Tasks:**
  - [x] Added `api.postText()` method for HTML-returning endpoints; replaced raw `fetch()` in `onboarding.tsx`, `broadcast-compose-dialog.tsx`, `sequence-step-editor.tsx` — removed 3 direct `supabase` imports
  - [x] Created shared `Broadcast` type in `web/src/lib/types.ts`; updated `broadcast-engagement.tsx`, `broadcast-compose-dialog.tsx`, `emails.tsx`, `dashboard-all-shows.tsx` to import it
  - [x] Extracted `getAllTimezones()` to `web/src/lib/timezones.ts` (with full 15-timezone fallback); shared `ArtistSettings` type in `web/src/lib/types.ts`; updated `settings.tsx` and `onboarding.tsx`
  - [x] Fixed `use-mobile.ts` initial state: `useState(window.innerWidth < MOBILE_BREAKPOINT)` instead of `undefined` — eliminates flash of desktop layout on mobile
  - [x] Fixed Recharts gradient `id` collisions in `daily-chart.tsx` and `show-drill-down.tsx` using `useId()`

---

### Phase E: Component Decomposition ✅

- **Completed 2026-04-04**
- **Tasks:**
  - [x] Extracted `ThemeEditor` (440 lines) into `web/src/components/theme-editor.tsx` — includes THEME_PRESETS, CapturePagePreview, ColorPicker, OptionRow sub-components. `applyPreset`/`isPresetActive` now derived from `THEME_FIELD_KEYS` array. `ThemeFields` type exported for composition.
  - [x] Extracted `KeywordSection`, `IncentiveSection`, `LinkSection` as private sub-components in page-form.tsx. Extracted `uploadIncentiveFile()` and `saveKeyword()` from mutationFn. PageForm component: 740→300 lines.
  - [x] Refactored `broadcast-compose-dialog.tsx`: consolidated 8 form useState into single `FormState` object with `set()` helper. Added `formFromBroadcast()` and `formToPayload()` pure functions. Reset logic: 14 setters → 4. Removed `fieldsRef` in favor of `formRef`.
  - [x] Decomposed `onboarding.tsx` EmailStep: 16 props → 7 via grouped objects (`emailForm`, `preview`, `mutations`). Added `EmailFormData`, `EmailPreview`, `EmailMutations` types.
  - [x] Extracted `FilterBar` and `ActiveFilterBadges` from `fans.tsx`. FansPage orchestrator now ~100 lines of JSX.
  - [x] Extracted `InlineTitleEdit` and `QrSection` from PageCard in `pages.tsx`.

---

### Phase F: API & Worker Function Extraction ✅

- **Completed 2026-04-04**
- **Tasks:**
  - [x] Decomposed `send-batch.ts` POST handler into `claimPendingRows()`, `resolveSendContext()`, `buildSendParams()`, `updateBroadcastStats()` — handler body now ~60 lines
  - [x] Batch provider message ID updates via `Promise.all()` instead of sequential loop (50 parallel vs 50 serial)
  - [x] Extracted `groupEventsByTitle()` from analytics overview — replaces 5 separate Maps with single `TitleGroup` Map
  - [x] Extracted `renderPreview()` in `email-templates.ts` — both legacy and sequence preview routes share one handler
  - [x] Split worker `handleCapture` into `parseSubmission()`, `lookupPage()`, `persistCapture()` — orchestrator now ~30 lines
  - [x] Replaced `.catch(() => {})` on `buildPage()` calls with `.catch((e) => console.error("build failed", e))` in capture-pages.ts
  - [x] Added route-ownership comments for all 6 modules mounted at `/api/capture-pages` in index.ts
  - [x] Consolidated 12 auth middleware lines into `for` loop over protected paths in index.ts

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
