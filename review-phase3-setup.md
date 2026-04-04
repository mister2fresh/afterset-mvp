# Phase 3: Project Setup & Configuration Review

## Summary

The project setup is lean for a three-package monorepo — no eslint, no prettier, no postcss, no next.config clutter. Biome handles everything. The main issues are (1) a handful of phantom dependencies and env vars that were installed/declared but never wired up, (2) an API build pipeline that can't actually produce output, and (3) a nested `.git` repo left over from Vite scaffolding. A new developer could get running quickly, but would be confused by the broken `build`/`start` story in the API package and by the ~5 dead npm dependencies.

---

## Config Simplification Opportunities

### `web/.git/` — nested git repo from Vite scaffolding
A full `.git` directory lives inside `web/`. HEAD points to `refs/heads/master`, no remote, single commit ("Initial commit from create vite"). It's invisible to the monorepo's git but creates a confusing dual-repo state and can trip up tools that walk the filesystem (IDEs, search indexers). **Delete it:** `rm -rf web/.git`.

### `web/.gitignore` — redundant with root
Contains Vite scaffold boilerplate (log files, editor dirs, `*.local`). The root `.gitignore` already covers `node_modules`, `dist`, `.env`, `.env.local`, `.env.*.local`. The web-specific entries (yarn/lerna logs, `.idea`, `.DS_Store`) are unlikely to appear in this pnpm monorepo on Linux. **Can be removed entirely** — root gitignore handles everything relevant.

### `api/tsconfig.json` — contradictory `noEmit` + `outDir`
```json
"noEmit": true,
"outDir": "dist",
"rootDir": "src"
```
With `noEmit: true`, `outDir` and `rootDir` are dead settings — tsc will never write to `dist/`. These imply an emit-based build that doesn't exist. Either remove `noEmit` to enable compilation, or remove `outDir`/`rootDir` to stop pretending.

### `web/tsconfig.json` — duplicated path alias
The `baseUrl` + `paths` (`@/*`) alias is declared in both `web/tsconfig.json` (solution root) and `web/tsconfig.app.json` (actual compiler config). The solution root copy exists only for IDE resolution. Not a bug, but it's the kind of duplication that drifts — if one changes, the other won't. Consider whether the root-level one is even needed with modern IDE support for project references.

### `supabase/config.toml` — 390 lines, ~5 lines customized
This is the `supabase init` default with only `project_id`, `major_version = 17`, and `enable_anonymous_sign_ins = false` changed. Everything else is commented-out or default. The 14KB file is mostly noise. Not urgent to fix, but be aware that Supabase CLI regenerates this — custom settings can be lost if not clearly marked.

### `biome.json` — no issues
Clean config. `experimentalScannerIgnores` for node_modules/dist, override for `routeTree.gen.ts`, import sorting. Well done.

### `web/components.json` — no issues
Required for shadcn CLI. Style set to `radix-nova`, `rsc: false`. Correct for this stack.

### `worker/wrangler.toml` — no issues
Minimal. Routes scoped correctly. R2 bucket binding and vars look right.

---

## Script / Tooling Issues

### `api` build/start pipeline is broken
- `"build": "tsc -b"` — emits nothing because `tsconfig.json` has `noEmit: true`
- `"start": "node dist/index.js"` — `dist/` will always be empty

The dev script uses `tsx watch` which transpiles on-the-fly, so development works. But the production story (Railway deploy) presumably also uses `tsx` or the build step silently fails. This needs to be reconciled: either enable emit in tsconfig (remove `noEmit`, keep `outDir`), or change `start` to use `tsx` and remove the pretend `build` script.

### `api/src/scripts/rebuild-all-pages.ts` — no script entry
Standalone script with no package.json command. Must be invoked manually: `tsx api/src/scripts/rebuild-all-pages.ts`. Should be wired up as `"rebuild-pages": "tsx src/scripts/rebuild-all-pages.ts"` in the api package.json (and optionally exposed at root).

### Root `test` script only runs API
```json
"test": "pnpm --filter api test"
```
Meanwhile `lint` and `typecheck` use `pnpm -r` (run across all packages). If web tests are ever added, they won't be picked up. Consider `pnpm -r test` for consistency, or `pnpm -r --filter '!worker' test` (worker has no tests).

### `web` has `vitest` devDependency but no tests
`vitest` is in `web/package.json` devDependencies. There is no test script, no test files, and no `vitest.config.ts` in web. Dead devDependency — remove until tests are actually written.

### Worker `publish` script naming
```json
"publish": "wrangler deploy"
```
The name `publish` collides semantically with `npm publish`. The root already wraps it as `deploy:worker`. Rename to `"deploy": "wrangler deploy"` for clarity. Update root script to match.

### Cap scripts not exposed at root
`cap:sync`, `cap:open:ios`, `cap:open:android` exist in web's package.json only. Fine for now (Capacitor requires Mac), but if someone tries to find them from root they won't be discoverable.

---

## Folder Structure Observations

### `web/src/assets/` — empty directory
Leftover from Vite scaffold. Zero files. Delete it.

### `web/public/favicon.svg` vs `web/public/logo.svg` — identical
Byte-identical files confirmed via `diff`. `index.html` references `logo.svg` (as favicon) and `favicon-32.png`. The PWA manifest references `logo.svg` via vite config. One of these SVGs should be removed and the other referenced everywhere.

### `afterset/docs/` — confusing nesting
ADRs and research live at `afterset/docs/adr/` and `afterset/docs/research/`. The `afterset/` parent directory contains nothing else — it's a wrapper for `docs/`. Flattening to `docs/adr/` and `docs/research/` at the project root would remove one indirection level and match conventional project layout.

### Root-level scratch HTML files
`afterset-ig-post.html`, `afterset-ig-post-2.html`, `icon-preview.html` are untracked. Not harmful but add visual clutter. Consider a `scratch/` directory or adding them to `.gitignore`.

### Root markdown weight — 170KB+
`TASKS.md` (63KB), `BACKLOG.md` (10KB), `QA-CHECKLIST.md` (26KB), `CLAUDE.md` (16KB), `CRASHCOURSE.md` (57KB untracked). TASKS.md at 63KB likely includes a lot of completed/archived content. Consider archiving done tasks to keep the active file fast to navigate.

### Project structure is otherwise clean
`web/src/` layout (components, ui, routes, lib, hooks) is conventional and navigable. `api/src/` (routes, lib, middleware, scripts) is flat and obvious. `worker/src/` is a single file. No orphaned directories (other than `assets/`), no confusing nesting.

---

## Environment / Secrets

### Phantom env vars in `api/.env.example`
| Var | Status |
|---|---|
| `SENTRY_DSN` | Listed in `.env.example`, never read by any code. No Sentry SDK installed. |
| `TELNYX_API_KEY` | Listed in `.env.example`, never read by any code. Only `TELNYX_PHONE_NUMBER` is used. |

### Missing env var in `api/.env.example`
| Var | Status |
|---|---|
| `TELNYX_PHONE_NUMBER` | Used in `api/src/routes/sms-keywords.ts` (with `+10000000000` fallback), not in `.env.example`. |

### Dead env var in `web/.env.example`
| Var | Status |
|---|---|
| `VITE_API_URL` | Declared in `.env.example` and `vite-env.d.ts`, never read by application code. The SPA uses relative `/api` paths — Vite proxy in dev, same-origin in prod. |

### `wrangler.toml` hardcodes Supabase URL
`SUPABASE_URL` is in `[vars]` as a plaintext string. Not a secret, so not a security issue — but it's the only place the Supabase project URL appears as a literal. The other packages read it from `.env`. Minor style inconsistency.

### `.env` files are properly gitignored
Root `.gitignore` covers `.env`, `.env.local`, `.env.*.local`. Both `web/.env` and `api/.env` are excluded from git. Good.

---

## Dead Dependencies (web/package.json)

| Package | Evidence | Verdict |
|---|---|---|
| `@fontsource-variable/geist` | Zero imports in src or CSS. App uses Bricolage Grotesque, DM Sans, Space Mono. | Remove |
| `next-themes` | Zero imports. App is always-dark with hardcoded CSS variables. No theme toggle. | Remove |
| `react-helmet-async` | Zero imports. Meta tags are static in `index.html`. | Remove |
| `@radix-ui/react-popover` | Zero direct imports. All UI components use the unified `radix-ui` package. Redundant. | Remove |
| `@tanstack/react-table` | Zero imports. Captures table uses raw shadcn `<Table>` components, not react-table. | Remove |
| `vitest` (devDep) | No test script, no test files, no vitest config in web. | Remove until needed |

---

## TypeScript Config Assessment

| File | Target | Module | Strict | Notes |
|---|---|---|---|---|
| `web/tsconfig.app.json` | ES2023 | ESNext | Yes | Bundler mode, jsx: react-jsx, path aliases. Solid. |
| `web/tsconfig.node.json` | ES2023 | ESNext | Yes | Only includes `vite.config.ts`. Correct. |
| `api/tsconfig.json` | ES2023 | ESNext | Yes | `noEmit` + `outDir` contradiction (see above). `esModuleInterop` is redundant with `verbatimModuleSyntax`. |
| `worker/tsconfig.json` | ES2022 | ES2022 | Yes | Lower target for Workers runtime. `isolatedModules: true` — good for CF. |

All four configs enable `strict: true`. No path alias abuse. The three-file setup in web is Vite's standard pattern and justified.

The `esModuleInterop` flag in `api/tsconfig.json` is a no-op when `verbatimModuleSyntax` is enabled (VMS enforces explicit import syntax, making esModuleInterop's CJS interop irrelevant). Can be removed.

---

## Verification

```
$ git status  # confirms no files were modified by this review
```
