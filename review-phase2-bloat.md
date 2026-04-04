# Phase 2 Code Review: Feature Bloat & Dead Code

## Summary

The codebase is reasonably lean for a pre-beta MVP. The most impactful waste comes from **7 unused npm dependencies** in `web/package.json` (including TanStack Table, next-themes, react-helmet-async, and Geist font — none imported anywhere), a **165-line dead component** (`EmailTemplateDialog`) that was superseded by the inline sequence editor, and **4 utility functions copy-pasted 3-4x** across API HTML-rendering modules. The API and worker are tight; almost all bloat lives in the web package.

---

## Dead Code (safe to remove)

### Components & Functions

- **[web/src/components/email-template-dialog.tsx:23-188]** — `EmailTemplateDialog` is exported but never imported anywhere. Only `EmailTemplateBadge` (line 190) is consumed (by `pages.tsx`). This is the predecessor to `InlineSequenceEditor` — 165 lines of dead code. Move `EmailTemplateBadge` to its own file or into `inline-sequence-editor.tsx` and delete the rest.

- **[web/src/components/captures-table.tsx:46,50,73-75,203-250]** — The `compact` prop (`compact = false`) and the entire `CompactTable` function (lines 203-250) are never used. No consumer passes `compact={true}`. Dead prop + dead branch + dead component.

### Exports never imported externally

- **[api/src/middleware/auth.ts:4-10]** — `export type Artist` is never imported by name from any other file. It's structurally consumed through `AuthEnv`, but the standalone export is dead.

- **[api/src/lib/download-page.ts:3-9]** — `export type DownloadPageParams` is never imported anywhere. Only used internally by `renderDownloadPage` in the same file; `download.ts` passes inline objects.

- **[web/src/components/page-form.tsx]** — 10+ exported symbols only used internally: `BackgroundStyle`, `ButtonStyle`, `FontStyle`, `TitleSize`, `LayoutStyle`, `FormData`, `EMPTY_FORM`, `formFromPage`, `THEME_PRESETS`, `CapturePagePreview`, `IncentiveFileDisplay`, `formatFileSize`. Only `CapturePage`, `fileTypeIcon`, and `PageForm` are imported externally.

- **[web/src/components/sequence-step-editor.tsx]** — `StepForm`, `EMPTY_STEP`, `formFromTemplate`, and `ToggleSwitch` are all exported but only consumed within the same file.

### Dead barrel re-exports

- **[api/src/lib/email/index.ts:4]** — `export { ResendEmailService }` — never imported from the barrel by any consumer.
- **[api/src/lib/email/index.ts:5]** — `export { isSuppressed }` — consumers import directly from `suppression.ts`.
- **[api/src/lib/email/index.ts:6]** — `export type { EmailService, SendParams, SendResult }` — `SendParams` imported directly from `types.ts` by `send-batch.ts`; the other two are only used in `resend-service.ts` via direct import.
- **[api/src/lib/email/index.ts:7]** — `export { createUnsubscribeToken }` — consumers import directly from `unsubscribe-token.ts`.

Note: This barrel file also violates the project's own TypeScript rule in `.claude/rules/typescript.md`: "No barrel files (index.ts re-exports) — import directly from source." The only non-re-export functions that justify this file's existence are `getEmailService()` and `getResendClient()`, which could live in `resend-service.ts`.

### Dead env declarations

- **[web/src/vite-env.d.ts:7]** — `VITE_API_URL` is declared in `ImportMetaEnv` but never referenced in any source file. The API client uses Vite's proxy config with relative `/api` paths.

- **[worker/wrangler.toml:16]** — `ENVIRONMENT = "production"` is bound as a var but not included in the `Env` interface (worker/src/index.ts:1-5) and never read in worker code.

### Bug (dead branch)

- **[api/src/lib/capture-template.ts:149]** — `.pw a{color:${isLightColor(bgColor) ? "#6b7280" : "#6b7280"}}` — The ternary always returns `"#6b7280"` regardless of lightness. Copy-paste error. Compare to line 148 which correctly uses different colors for the light/dark case.

---

## Over-Engineered (simplify)

### Utility duplication (past the "3x before extract" threshold)

- **`escapeHtml()`** — Identical implementation in 4 files: `capture-template.ts:51`, `download-page.ts:27`, `icons.ts:51`, `render-template.ts:100`. Extract to a shared `api/src/lib/html-utils.ts`.

- **`isLightColor()`** — Identical implementation in 3 files: `capture-template.ts:60`, `download-page.ts:36`, `render-template.ts:23`. Same extraction candidate.

- **`BUTTON_RADIUS`** — Identical `Record<string, string>` in 3 files: `capture-template.ts:22`, `download-page.ts:21`, `render-template.ts:17`. Same extraction candidate.

- **`cssBackground()`** — Identical implementation in 2 files: `capture-template.ts:41`, `download-page.ts:43`. At 2x this is below the threshold but worth noting since the other utilities in those files are already being extracted.

### Thin wrappers

- **[web/src/lib/capacitor.ts]** — `isNativePlatform()` just calls `Capacitor.isNativePlatform()` and `getPlatform()` just calls `Capacitor.getPlatform()`. One consumer (`use-push-notifications.ts`). The hook could import `Capacitor` directly — the wrapper adds no value.

### Redundant data structures

- **[worker/src/index.ts:124 + 260-265]** — `ENTRY_METHODS` Set and `entryMethodMap` Record encode the same knowledge (valid entry method shortcodes). A single `Record<string, string>` with an `in` check would eliminate one data structure.

### Type duplication

- **`Broadcast` type** — Defined independently in 3 files: `broadcast-engagement.tsx:5` (exported, 5 fields), `broadcast-compose-dialog.tsx:48` (local, 18 fields), `emails.tsx:16` (local, 14 fields). These are three competing definitions for the same entity at different levels of completeness. Should be a single shared type.

- **`METHOD_LABELS`** — Defined in `captures-table.tsx:26` (shorter labels: "Direct", "SMS") and `show-drill-down.tsx:36` (descriptive labels: "Direct Link", "Text-to-Join"). The values differ intentionally, but having two maps with the same name for the same concept is confusing.

### Ineffective rate limiter

- **[worker/src/index.ts:7-34]** — In-memory rate limiter (`rateLimitMap`) is per-isolate, not per-IP across Cloudflare's network. Multiple isolates/colos serve traffic simultaneously, so the rate limit is largely ineffective in production. Either use Cloudflare's built-in Rate Limiting / a Durable Object, or add a comment clarifying this is intentionally "best effort."

---

## Unused or Redundant Dependencies

### web/package.json — remove entirely

- **`@fontsource-variable/geist`** — Never imported in `web/src/`. App uses Google-hosted Bricolage Grotesque, DM Sans, and Space Mono.
- **`@tanstack/react-table`** — Never imported in `web/src/`. Captures table is built with raw `<Table>` shadcn components.
- **`next-themes`** — Never imported in `web/src/`. App is dark-mode-only with no theme switching.
- **`react-helmet-async`** — Never imported in `web/src/`. No `<Helmet>` usage exists.
- **`zod`** — Never imported in `web/src/`. All Zod validation is server-side in the API.
- **`@radix-ui/react-popover`** — Never imported in `web/src/`. All Radix imports go through the unified `radix-ui` package. Leftover from pre-migration.
- **`@capacitor/splash-screen`** — Never imported in `web/src/`. Config exists in `capacitor.config.ts` but the JS API is never called. May be needed by native side only — verify before removing.

### web/package.json — move to devDependencies

- **`shadcn`** — CLI scaffolding tool, never imported at runtime. Should be devDependencies.

### web/package.json — unused devDependencies

- **`vitest`** — No test files exist in `web/src/`. All tests are in `api/`.
- **`workbox-window`** — Never imported in `web/src/`. `vite-plugin-pwa` with `generateSW` strategy handles workbox internally.

### Cross-package redundancy

- **`@biomejs/biome`** — Listed as devDependency in all 3 packages (`web`, `api`, `worker`) individually. Since `biome.json` is at root and scripts run from root, a single root-level install would suffice.

---

## Unfinished / Unwired Features

- **[api/src/routes/capture-pages.ts:206-225]** — Slug-rename logic in the PATCH handler (tracking `oldSlug`, checking uniqueness, deleting old QR) exists and is syntactically reachable, but the frontend only shows the slug field in create mode. Per CLAUDE.md: "slug is permanent." This code path will never be exercised by the actual UI. It's defensive dead weight — either remove it or gate it behind an admin flag.

- **[web/src/routes/_authenticated/analytics.tsx]** — This entire route file is a one-time redirect (`throw redirect({ to: "/dashboard" })`). It's vestigial from when `/analytics` was a standalone page. This could be a single router config entry rather than a standalone route file. Very low priority.

- **[web/src/components/ui/sidebar.tsx]** — 11 exported subcomponents (`SidebarInput`, `SidebarRail`, `SidebarSeparator`, `SidebarGroupAction`, `SidebarMenuAction`, `SidebarMenuBadge`, `SidebarMenuSkeleton`, `SidebarMenuSub`, `SidebarMenuSubButton`, `SidebarMenuSubItem`, `useSidebar`) are never imported by app code. These are standard unused shadcn kit exports — not a bug, but the sidebar component carries significant weight for what the app actually uses from it. The mobile layout uses a custom bottom tab bar, not the sidebar's sheet-based mobile mode.

---

## Minor / Low Priority

- **[web/src/lib/auth.ts:27]** — `void subscription;` is a no-op statement to suppress an unused variable warning. The `subscription` from `onAuthStateChange` is never used to unsubscribe, which means the listener can never be cleaned up. Intentional for a long-lived app-global listener, but the `void` is noise.

- **[api/tsconfig.json]** — `outDir: "dist"` and `rootDir: "src"` are set alongside `noEmit: true`. These are contradictory — `outDir`/`rootDir` only matter when emitting. The build works because `tsc -b` silently overrides `noEmit`. Confusing but functional.

- **[web/src/routes/_authenticated/settings.tsx:22-38]** — `COMMON_TIMEZONES` fallback array for when `Intl.supportedValuesOf` throws. This won't throw in any modern browser/webview this app targets. Essentially unreachable but harmless safety net.
