# Phase 1: Readability & Clarity Review

**Date:** 2026-04-03
**Scope:** All `.ts` / `.tsx` source files across `api/`, `web/`, `worker/`, and root configs (~85 files)

---

### Summary

The codebase is well-structured at the package level (api/web/worker split is clean) and most lib-layer files are short, single-purpose, and well-named. The main readability problems live in a handful of oversized components and route handlers: `PageForm` (740 lines), `BroadcastComposeDialog` (590 lines), `send-batch.ts` handler (360 lines), `OnboardingPage` (305 lines), and `handleCapture` in the Worker (132 lines). These files do too many things in a single function and would benefit most from extraction. A secondary theme is utility duplication (`escapeHtml`, `isLightColor`, `getAllTimezones`, timezone boundary logic) across files, which creates drift risk and makes the canonical implementation unclear.

---

### Critical (should fix soon)

#### Oversized functions / components

- **[api/src/routes/send-batch.ts:26-392]** -- The `POST /send-batch` handler is a single ~360-line function doing 8+ distinct things: claim rows, fetch artists, map fan-to-page, fetch templates, resolve broadcast themes, build send params, send + update statuses, update broadcast stats. Extract named functions like `claimPendingRows()`, `resolveSendParams()`, `updateBroadcastStats()`.

- **[web/src/components/page-form.tsx:491-1229]** -- `PageForm` is ~740 lines of JSX. It mixes slug validation, keyword management, file upload with drag-and-drop, theme customization, streaming/social link editing, and inline sequence editing. Extract at minimum: `ThemeEditor` (lines 848-1061), `LinkEditor` (lines 1131-1201), `IncentiveUploader` (lines 1063-1129), `KeywordField` (lines 776-846).

- **[web/src/components/broadcast-compose-dialog.tsx:112-703]** -- ~590 lines with 14 `useState` calls. Form state is spread across individual hooks rather than a single form object. The reset logic (lines 139-166) is a wall of setters that's easy to get wrong. Consolidate into a `useReducer` or single form-state object.

- **[web/src/routes/onboarding.tsx:66-371]** -- ~305-line component with 13+ state variables and 7 mutations/handlers. The wizard orchestrates four steps, email preview, QR download, and profile save all in one function. Extract each step into its own component (step 0, 1, 3 -- `EmailStep` at line 373 is already the right pattern).

- **[web/src/routes/_authenticated/pages.tsx:196-422]** -- `PageCard` is ~226 lines mixing inline title editing, QR preview, keyword display, delete confirmation, file type display, and capture count linking. The inline-edit block (lines 243-274) and QR/download section (lines 333-351) are extraction candidates.

- **[web/src/routes/_authenticated/fans.tsx:66-294]** -- ~228 lines. The filter bar JSX alone spans lines 111-185, and filter badges span 188-245. Extract `FilterBar` and `ActiveFilterBadges` sub-components.

- **[worker/src/index.ts:164-296]** -- `handleCapture` is 132 lines doing 6+ things: CORS/method gating, body parsing, validation, rate limiting, page lookup, fan upsert, capture event insert, email queueing. Split into `parseSubmission()`, `lookupPage()`, `persistCapture()`.

- **[api/src/routes/analytics.ts:259-388]** -- Overview handler is ~130 lines with 6 Maps all processing the same loop. Building `titleCounts`, `titleToPageId`, `titleLatestDate`, `titleMethods`, `titleDaily` in a single for-loop makes each concern hard to reason about independently. Extract `groupEventsByTitle(rows)`.

- **[web/src/components/page-form.tsx:595-653]** -- The `mutationFn` inside `useMutation` is ~40 lines doing four sequential concerns: create/update page, upload incentive, save/remove keyword, return result. Extract upload and keyword logic into separate named async functions.

#### Prop bloat

- **[web/src/routes/onboarding.tsx:373-554]** -- `EmailStep` accepts 16 props, violating the 4-parameter guideline. Group related props into objects (e.g., `emailForm: { subject, body, delayMode, includeIncentive }` with a single `onEmailFormChange`), or use context/store for wizard state.

#### Duplication

- **[api/src/lib/capture-template.ts + download-page.ts + render-template.ts + icons.ts]** -- `escapeHtml` and `isLightColor` are duplicated across 4 files with near-identical implementations. `BUTTON_RADIUS` is duplicated in 3 files. `cssBackground` is in 2 files. A new developer would not know which copy is canonical. Extract into a shared `api/src/lib/html-utils.ts`. Note: `render-template.ts`'s `escapeHtml` is missing the single-quote branch -- that inconsistency is a latent bug.

- **[api/src/routes/captures.ts:8-74 + 103-155]** -- List and export handlers share ~90% of query-building logic (same filters, joins, flatMapping). Only difference is output format. Extract `buildCapturesQuery(artistId, filters)`.

- **[api/src/routes/broadcasts.ts:335-363]** -- `checkDailyLimit` computes start-of-day differently than `getTodayRange` in analytics.ts. Two different timezone-boundary implementations doing the same job is a correctness risk. Consolidate into one shared `getTodayRange(tz)`.

- **[web/src/routes/settings.tsx + onboarding.tsx]** -- `ArtistSettings` type is duplicated (with slightly different fields). `getAllTimezones()` is also duplicated with different fallback lists. Extract both to `web/src/lib/types.ts` and `web/src/lib/timezones.ts`.

- **[web/src/components/inline-sequence-editor.tsx + email-template-dialog.tsx]** -- Nearly identical step-list rendering logic (~80 lines each): accordion with numbered circles, expand/collapse, `SequenceStepEditor` embedding, "Add Email" button. Extract a shared `SequenceStepList` component, or remove one if the dialog is deprecated.

#### Abstraction leaks / bypasses

- **[web/src/routes/onboarding.tsx:138-161]** -- `emailPreviewMutation` calls `fetch()` directly with manual auth token handling, bypassing the `api` abstraction that already handles token refresh and error normalization.

- **[web/src/components/broadcast-compose-dialog.tsx:249-260]** -- `handlePreview` uses raw `fetch` with manual `supabase.auth.getSession()` + header construction instead of the `api` helper. Same pattern in `sequence-step-editor.tsx:123-140`.

#### Misleading names

- **[worker/src/index.ts:37-53]** -- `nineAmUtc` does not return 9am UTC. It returns the UTC timestamp corresponding to 9am in a given timezone. Name should be `nineAmLocalAsUtc` or `localNineAmToUtc`. The companion `getTimezoneOffsetMs` has no comment explaining its sign convention.

---

### Minor (backlog-worthy)

#### Naming / clarity

- **[api/src/lib/download-token.ts:3]** -- `TokenPayload = { p: string; x: number }` -- single-letter keys are fine for wire format but confusing in code. Destructure into named variables immediately after parsing: `const { p: capturePageId, x: expiresAt } = parsed`. Same in `unsubscribe-token.ts:3` with `{ e, a, t }`.

- **[worker/src/index.ts:146-162]** -- `supabaseRpc` is misleading -- it makes REST API calls, not Postgres RPC calls. `supabaseFetch` or `supabaseRest` would be more accurate.

- **[worker/src/index.ts:124]** -- `ENTRY_METHODS` uses single-character codes `d/q/n/s` with no adjacent comment. The mapping exists 130 lines later at `entryMethodMap`. Co-locate these constants.

- **[web/src/components/dashboard-tonight.tsx:30-39]** -- `formatComparison` returns `undefined` for negative diffs, silently hiding them. The name doesn't convey this behavior -- rename to `formatPositiveComparison` or add a comment.

- **[web/src/components/stat-card.tsx:21]** -- `IconComponent` defaults to `TrendingUp` when no icon is passed, which is semantically wrong for cards like "Total Fans". Either require the icon prop or use a neutral default.

#### Control flow / complexity

- **[web/src/routes/_authenticated/help.tsx:60-103]** -- `TopicBody` is a mini markdown parser with mutable `listItems` array and side-effectful `flushList()` closure. Needs a comment explaining the streaming line-by-line approach. Rename `flushList` to `emitAccumulatedList`.

- **[web/src/routes/_authenticated/pages.tsx:379-385]** -- IIFE inside JSX for file type icon is hard to read. Assign `const FileIcon = fileTypeIcon(...)` before the return.

- **[web/src/routes/_authenticated/pages.tsx:154-179]** -- `useQrPreview` uses `useEffect` + `useCallback` + manual state instead of `useQuery`. The onboarding version already does this correctly with `useQuery`.

- **[worker/src/index.ts:204-205]** -- Invalid entry methods silently default to `"d"` (direct) with no comment explaining why.

- **[web/src/routes/onboarding.tsx:82-89]** -- Settings initialization calls `setState` during render. A `useEffect` with `settings` as dependency would be more idiomatic.

#### Missing comments

- **[api/src/lib/build-page.ts:24-45]** -- Retry loop uses `for (let attempt = 0; attempt < 3; attempt++)` with no backoff and silently swallows errors until the last attempt. No logging on intermediate failures. Add `console.warn` on retry.

- **[api/src/lib/capture-template.ts:169]** -- Inline `<script>` is a single minified line (~1200 chars) with non-trivial offline-queue logic. Add a comment explaining the offline-first flow.

- **[api/src/routes/analytics.ts:27-38]** -- `getTodayRange` computes timezone offset by parsing locale-formatted strings back through `new Date()`. Clever but needs a comment explaining *why*.

- **[web/src/components/broadcast-compose-dialog.tsx:192-212]** -- `fieldsRef` tracking 8 fields updated every render has no comment explaining why a ref mirror is needed for the debounced auto-save.

- **[web/src/components/page-form.tsx:294-307]** -- Inline hex math `${secondary}42` appending alpha channel without comment is cryptic. Note: `// 42 = ~26% alpha hex`.

- **[web/src/lib/auth.ts:28]** -- `void subscription` is cryptic. Comment: `// Keep subscription alive for the lifetime of the app`.

- **[worker/src/index.ts:10]** -- `rateLimitMap` is module-level mutable state with no comment about Worker isolate lifecycle.

- **[worker/src/index.ts:336]** -- Slug regex is complex enough to warrant a comment describing what it matches.

#### Abstraction / organization

- **[api/src/lib/email/index.ts:20-26]** -- `getResendClient()` reaches through the `EmailService` abstraction to expose the raw Resend client (used only for webhook verification). Add a `verifyWebhook` method to the `EmailService` interface instead.

- **[api/src/routes/capture-pages.ts:144]** -- `buildPage(data.id, artist.id).catch(() => {})` silently swallows build failures. Same at lines 239 and 269. At minimum: `.catch((e) => console.error("build failed", e))`.

- **[api/src/routes/send-batch.ts:330-335]** -- Provider message ID updates happen in a sequential `for` loop, one DB call per sent email. At 50-row batch limit, that's 50 serial queries. Batch into a single query.

- **[api/src/index.ts:51-66]** -- Six route modules all mounted at `"/api/capture-pages"`. Add inline comments showing which sub-paths each owns.

- **[api/src/index.ts:55-56]** -- Auth middleware applied separately for `/api/settings` and `/api/settings/*` (repeated 6 times). Use `app.use("/api/settings*", auth)` or group in a sub-app.

- **[web/src/lib/api.ts:37]** -- `return undefined as T` is a type lie for 204 responses. Change return type to `T | undefined` or add a DELETE-specific overload returning `void`.

- **[web/src/routes/_authenticated/emails.tsx:62-71]** -- `handleNewBroadcast` manages its own `creating` state instead of using `useMutation`. Every other async action uses mutations.

- **[web/src/routes/_authenticated/emails.tsx:78-82]** -- `handlePreviewBroadcast` is declared `async` but never awaits. Misleading.

- **[web/src/routes/_authenticated/emails.tsx:174]** -- Archived broadcasts filtered client-side twice on the same array. Filter once and reuse.

- **[web/src/hooks/use-mobile.ts:6]** -- Initial state `undefined` coerced to `false` causes flash of desktop layout on mobile. Initialize with `window.innerWidth < MOBILE_BREAKPOINT`.

- **[web/src/components/page-form.tsx:525-547]** -- Slug availability check uses raw `setTimeout` + `api.get` inside `useEffect`. Same debounce-check pattern in keyword checking and `keyword-dialog.tsx`. Extract a `useDebouncedCheck` hook.

- **[web/src/components/page-form.tsx:462-489]** -- `applyPreset` and `isPresetActive` both reference the same 9 theme fields independently. If a new field is added to one but not the other they'll silently drift. Derive from a shared `THEME_FIELDS` array.

- **[web/src/components/broadcast-compose-dialog.tsx:540-548]** -- Raw `<select>` with hand-copied Tailwind classes instead of a shadcn Select component.

- **[web/src/components/daily-chart.tsx:49-54 + show-drill-down.tsx:175-179]** -- Recharts gradient `id` attributes are hardcoded strings. If two chart instances render simultaneously, SVG gradient IDs will collide. Use `useId()`.

- **[web/src/components/dashboard-all-shows.tsx:110-193]** -- `CapturesByShow` takes 7 props (exceeds 4-parameter guideline). Pass a single `drillDown` config object.

- **[web/src/routes/_authenticated/help.tsx:105-117]** -- `formatInline` uses matched bold text as React `key`. Duplicate bold phrases cause key collisions. Use index.

- **[web/src/routes/login.tsx:37-46]** -- `handleResend` silently swallows all errors with no user feedback.

- **[worker/src/index.ts:140-143]** -- `notFound()` is a single-line HTML string (~400 chars). Extract to a multi-line template literal.

- **[worker/src/index.ts:260-265]** -- `entryMethodMap` declared inside `handleCapture` but is a static constant. Move to module level alongside `ENTRY_METHODS`.

- **[worker/src/index.ts:74-79]** -- `SequenceTemplate.delay_mode` typed as `string` instead of a union (`"immediate" | "1_hour" | "next_morning"`).

- **[api/tsconfig.json:10]** -- `noEmit: true` and `outDir: "dist"` are contradictory. One is stale.

- **[web/vite.config.ts:33-39]** -- PWA runtime caching regex `/^https:\/\/.*\/api\//` matches any domain's `/api/` path, not just the app's own API.

- **[api/src/routes/email-templates.ts:94-122 + 226-253]** -- Legacy and sequence preview handlers are nearly identical. Extract `renderPreview()` helper.

---

### Good Patterns Worth Keeping

#### Architecture

- **Clean package separation.** The pnpm workspace splits web/api/worker with each package having its own tsconfig targeting the correct runtime. Shared Biome config at root prevents lint drift. The `routeTree.gen.ts` override to disable all checks on the generated file is exactly right.

- **Consistent TypeScript strictness.** All three tsconfigs enable `strict: true`. Web adds `noUnusedLocals`/`noUnusedParameters`.

- **Service abstractions.** `EmailService` interface is minimal (2 methods), `ResendEmailService` implements it cleanly, singleton is lazy-initialized. Easy to swap providers.

- **Auth pattern is uniform.** The `AuthEnv` type + `c.get("artist")` pattern is used consistently across all API routes. On the frontend, every protected route uses the same `beforeLoad` + `context.auth.getUser()` guard. The `_authenticated` layout centralizes the onboarding check.

#### API layer

- **Zod schemas co-located with routes.** Every route that accepts a body defines its schema at the top of the file. Validation errors returned uniformly via `.error.flatten()`.

- **Timing-safe token verification.** Both `download-token.ts` and `unsubscribe-token.ts` use `timingSafeEqual` for HMAC comparison.

- **Defensive Supabase joins.** Captures route uses `fan_captures!inner` to enforce RLS through the fan-artist relationship, correctly handling deleted pages.

- **HMAC-based download tokens.** Self-contained, no DB lookup, 7-day expiry. Clean separation between token creation and page rendering.

- **Strong test coverage where it matters.** `capture-template.test.ts` has 35 tests covering XSS, accessibility, size budget, and all style permutations. Test factory pattern (`basePage(overrides)`) is consistent and scannable.

#### Frontend

- **`api.ts` abstraction is clean.** Thin wrapper with automatic token refresh, error normalization, and typed generics. Object-method API (`api.get`, `api.post`) is ergonomic.

- **Dashboard is a thin composition root.** `dashboard.tsx` is 27 lines -- just tabs delegating to extracted components. Ideal pattern for route files.

- **Help content as structured data.** Separating `help-topics.ts` (data) from `help.tsx` (rendering) means adding topics requires zero component changes.

- **Discriminated union props.** `PageFormDialogProps` uses a discriminated union to ensure `page` is only required in edit mode. Strong typing pattern.

- **Consistent empty states.** Every list page (pages, emails, fans) shows a branded empty state with icon, helpful copy, and CTA.

- **Small, focused sub-components.** `CaptureCard`, `SortBar`, `SortButton`, `CompactTable`, `PageLink`, `MethodBadge` in `captures-table.tsx` each stay under 30 lines and are self-documenting. `fillLast30Days` is a clean utility exported and reused across chart components.

- **Type exports co-located with components.** `CaptureRow`, `ShowStats`, `PageAnalytics`, `EmailTemplate` types are importable from their defining component files.

- **UI components are unmodified shadcn defaults.** Two meaningful customizations (dialog full-screen on mobile, `showCloseButton` prop) are clean and well-placed.

#### Worker

- **Rate limiting is appropriately simple.** In-memory per-isolate with periodic cleanup -- no over-engineering for what's a spam-prevention heuristic.

- **Security headers on served pages.** `servePage` sets `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`.

- **CORS handling centralized.** `CORS_HEADERS` constant and `json()` helper keep response construction consistent.

- **`satisfies ExportedHandler<Env>`** on the default export is the correct modern pattern -- type-checks without widening.
