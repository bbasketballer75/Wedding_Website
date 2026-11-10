# ENVIRONMENT — configuration contract for the archive

Documentation only. This file records **where every variable comes from, who sets it, what breaks when
it is missing, and what must change for the greenfield app**. No secret values are recorded here and
no production action was taken while writing it. Measured on 2026-11-09 from the files cited on each
row; anything the repo cannot prove is marked `UNVERIFIED` with the step that would verify it.

Sources of truth read for this page: `.env.example:1-85`, `rebuild/.env.example:1-16`,
`rebuild/src/app/env.ts:15-65`, `src/lib/supabase/client.ts:9-17`, `netlify.toml:1-33`,
`netlify/functions/guest-upload-url.ts:22-44`, `netlify/functions/download-pack.ts:12-16`,
`netlify/edge-functions/gallery-share.ts:16-20`, `.github/workflows/rebuild.yml:42-46,150-155`,
`scripts/verify-release-env.js:28-30,132-140`, `scripts/lib/sentry-upload-config.js`,
`scripts/supabase-mgmt-api-push.mjs:9-40`, `supabase/config.toml:5,10,31-38,152-158`,
`wrangler.toml:1-11`, `rebuild/vite.config.ts:1-29`, and `docs/archival/SECURITY.md:3-54`.

## 1. How configuration reaches the running system

| Layer | Mechanism | Evidence |
|---|---|---|
| Browser/build | Vite inlines every `VITE_*` value **at build time**; there is no runtime env for the browser | `rebuild/src/app/env.ts:48-65` accesses each key statically, and documents that spreading `import.meta.env` does not survive a build |
| Local dev/build | `.env`, `.env.local`, `.env.*.local` (gitignored); `dotenv` in Node scripts | `.gitignore` env section; `scripts/verify-release-env.js:13-22` lists the loaded files |
| CI (GitHub Actions) | Workflow-level `env:` block with **placeholders only** | `.github/workflows/rebuild.yml:42-46` (workbench), `:150-155` (parity); `.github/workflows/ci.yml` legacy gate |
| Netlify build | Site environment variables from the Netlify UI, injected into the build command | `netlify.toml:1-11`; `scripts/verify-release-env.js` is the build guard in the legacy command (`netlify.toml:3`) |
| Netlify functions (Node runtime) | Function runtime env (`process.env`) — **not** the browser build env | `netlify/functions/guest-upload-url.ts:36-44`; `netlify/functions/download-pack.ts:12-16` |
| Netlify edge function (Deno) | `Netlify.env.get()` | `netlify/edge-functions/gallery-share.ts:16-20` |
| Scripts / operator | `dotenv` reads repo `.env` (gitignored) or shell env | `scripts/supabase-mgmt-api-push.mjs:22-58`; `scripts/list-r2.mjs:1-11` |
| Blank values | Treated as **absent** by the modern guards (empty string is not a value) | `.env.example:39-43`; `scripts/verify-release-env.js` (`isPlaceholderValue`); `rebuild/src/app/env.ts:15-19` (`blankToUndefined`) |

Precedence in practice: **shell/CI/Netlify-provided variable wins over a `.env` file** because `dotenv`
does not override existing env; for the browser build, Netlify/CI env is what Vite inlines. There is
no runtime override of an already-built bundle — a wrong build-time value requires a rebuild.

## 2. Public browser/build variables (`VITE_*`)

Public by definition (they are committed into the JS bundle). Never put a service-role key or token
in a `VITE_*` name — `docs/archival/SECURITY.md:15-29` states the policy, and
`npm run verify:secrets` / `npm run verify:env` enforce it.

| Variable | Required? | Who sets it (legacy → greenfield) | Missing failure mode | Greenfield change |
|---|---|---|---|---|
| `VITE_SUPABASE_URL` | **required** | Netlify prod env; CI placeholder `.github/workflows/rebuild.yml:43,151`; local `.env` | Legacy client throws at import (`src/lib/supabase/client.ts:12-17`); greenfield throws a readable schema error (`rebuild/src/app/env.ts:35-46`) | Same value (same Supabase project) unless the owner chooses a new project |
| `VITE_SUPABASE_ANON_KEY` | **required** | same as above | same as above | Same value; public anon key only |
| `VITE_SITE_URL` | recommended (legacy), defaulted (greenfield) | Netlify prod env; CI sets it; local optional | Legacy falls back to `https://www.theporadas.com` in `SEOHead`; sitemap/robots use the fallback (`scripts/generate-sitemap.js:6`); greenfield defaults in `rebuild/src/app/env.ts:24-27` | **Must be the final public origin at cutover**; the greenfield metadata/prerender table also pins `siteUrl` (`rebuild/src/app/seo/routeMeta.json`, IN FLIGHT) |
| `VITE_MEDIA_BASE_URL` | optional | Netlify prod env; **unset in CI/parity** | Unset ⇒ all media stays same-origin (`src/utils/media.ts:14-36`); in production this would ship/serve 3.6 GB of media from `dist` instead of the CDN, and the postbuild pruner keeps local media (`scripts/prune-local-media.js:1-30`) | Must point at the media CDN (`https://media.wedding.theporadas.com`) in the production site; parity builds keep it unset/mocked |
| `VITE_GA_ID` | optional | Netlify prod env | Analytics silently disabled: `hasAnalytics()` returns false (`src/services/AnalyticsService.ts:1-14`) | Rebuild has the key in its env schema (`rebuild/src/app/env.ts:30`) but **no initialiser yet** (Wave 8, IN FLIGHT) |
| `VITE_SENTRY_DSN` | optional | Netlify prod env; DSN host must be in CSP `connect-src` (`public/_headers`) or events are blocked — enforced by `src/__tests__/sentryCspHeaders.test.ts` | Error reporting silently disabled (`src/services/ErrorLoggingService.ts:37-46`) | Rebuild schema has it; wiring is Wave 8 IN FLIGHT; rebuild `netlify.toml` CSP keeps the Sentry host (untracked file, IN FLIGHT) |
| `VITE_APP_VERSION` | optional | Netlify/local; only a **fallback** release label | Release falls back to `package.json` version (`vite.config.js:24-42`) | Not needed: releases come from `COMMIT_REF`; keep unset to avoid stale labels |

Unused documented flags: `.env.example:74-85` documents `VITE_ENABLE_UPLOADS`, `VITE_ENABLE_GUESTBOOK`,
`VITE_REQUIRE_UPLOAD_APPROVAL`; no source file reads them (grep over `src/`, `scripts/`, `rebuild/src/`
found only `.env.example`). **Do not set them** — they have no effect.

## 3. Build-only secrets and Netlify built-ins

| Variable | Visibility | Who sets it | Rules / failure mode | Greenfield |
|---|---|---|---|---|
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | **secret** (build only) | Netlify UI, Production scope | **All three or none**: a partial set fails the build on purpose; present ⇒ hidden source maps uploaded then deleted from `dist` (`.env.example:35-49`; `scripts/lib/sentry-upload-config.js`; `scripts/prune-sourcemaps.js:1-11`) | Decide whether the greenfield deploys to the same Sentry project; wiring is Wave 8 IN FLIGHT |
| `COMMIT_REF` | build metadata | Set automatically by Netlify | Required for a credentialed deploy build: release identity must be the deploy commit (`.env.example:44-46`; `vite.config.js:24-42`; `scripts/lib/sentry-upload-config.js`) | Same mechanism can be reused; greenfield Sentry wiring IN FLIGHT |
| `CONTEXT` | build metadata | Set automatically by Netlify (`production`, `deploy-preview`, `branch-deploy`) | Used to decide whether Sentry upload is expected inside a deploy | Same |
| `NODE_VERSION` / `NPM_VERSION` | build config | Netlify site config / `netlify.toml` | Frozen app pins Node 22 / npm 11.11.0 (`netlify.toml:5-11`); Node 22 is required by Rolldown native bindings | Greenfield `rebuild/netlify.toml` keeps `NODE_VERSION="22"` (untracked, IN FLIGHT W8-1); `NPM_VERSION` not yet set there |
| `ANALYZE` | build flag | local scripts only | Enables the bundle visualizer (`vite.config.js:283-289`) | Optional, same idea |

## 4. Server-only secrets (never in a `VITE_*`, never in the repo)

| Variable | Consumer | Failure mode if missing | Evidence |
|---|---|---|---|
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_MEDIA_BUCKET`, `R2_PUBLIC_BASE_URL` | `netlify/functions/guest-upload-url.ts` (presigned PUT) and media scripts | Function returns HTTP 500 `Server configuration error`; guest uploads break (mint of the signed URL fails) | `netlify/functions/guest-upload-url.ts:22-44`; `scripts/list-r2.mjs:5-11`; `.env.example:63-72` |
| `SUPABASE_SERVICE_ROLE_KEY` | operator/scripts only (`scripts/verify_supabase.js`), never client | Verification scripts that need admin access skip/fail; **must never enter a browser env** | `docs/archival/SECURITY.md:15-29,42-48`; `scripts/verify_supabase.js` gates on `SUPABASE_ALLOW_SERVER_ROLE_VERIFY` |
| `SUPABASE_ACCESS_TOKEN` | `scripts/supabase-mgmt-api-push.mjs` (Management API migration push, `--dry-run` supported) | Script exits with `Missing SUPABASE_ACCESS_TOKEN in .env` | `scripts/supabase-mgmt-api-push.mjs:9-58` |
| `ADMIN_SMOKE_EMAIL`, `ADMIN_SMOKE_PASSWORD` | `scripts/verify-live-admin-smoke.js` | Live admin smoke cannot run | `.env.example:58-61`; `scripts/verify-live-admin-smoke.js` |

The Supabase project identity is public configuration: ref `zaczcyzvavetgfuucljf`
(`supabase/config.toml:5`, `package.json` `supabase:link`), local DB major version 17
(`supabase/config.toml:38`). Local Supabase ports are `54321`/`54334`/`54320` (`supabase/config.toml:5-38`);
the workspace sandbox must shift them (see `../audit/A3-data.md` §1.2).

## 5. Local dev vs CI vs Netlify vs parity

| Environment | Supabase | Site URL | Media base | Sentry/GA | Notes |
|---|---|---|---|---|---|
| Local dev (`npm run dev`) | real project values or placeholders | optional | optional (Vite dev proxy) | optional | `.env` gitignored; legacy dev wrapper kills port 5173 (`scripts/dev.js:8-57`) |
| Rebuild dev (`rebuild/npm run dev`) | `rebuild/.env.example` placeholders | defaults to production origin | unset | unset | greenfield validates lazily via `readAppEnv()` when the data layer calls it |
| CI (`ci.yml`, `rebuild.yml`) | `https://placeholder.supabase.co` + placeholder anon | `https://www.theporadas.com` | unset (workbench/rebuild jobs), CDN host (parity job) | unset | placeholders only; no real keys in CI (`rebuild.yml:42-46,150-155`) |
| Parity harness | placeholder + **mocked REST** | production origin | CDN host, then network mocked | unset | deterministic mocks from `contracts/fixtures/*` |
| Netlify legacy production | real project | `https://www.theporadas.com` | CDN host | real DSN/GA if configured | build command `npm run verify:env && npm run build` (`netlify.toml:3`) |
| Netlify greenfield (not created yet) | real project | final origin at cutover | CDN host | TBD | `rebuild/netlify.toml` exists **untracked/in flight (W8-1)**; site creation, base directory and env values are owner actions (`UNVERIFIED`: verify with `netlify sites:list` / site settings) |

## 6. Failure-mode verification (cheap, read-only)

```bash
# Legacy build guard: required public values + Sentry all-or-none + browser-facing secret scan
node scripts/verify-release-env.js          # then: npm run verify:env (chain incl. repo hygiene)
# Greenfield env parser is unit-tested (schema rejects bad URL / missing key)
cd rebuild && npx vitest run tests/unit/env.test.ts
# Which env names the greenfield code actually reads (grep; prints names only, no values)
grep -Rho "VITE_[A-Z_]*" rebuild/src/app/env.ts | sort -u
# Confirm no populated service-role assignment is committed
npm run verify:secrets
```

`UNVERIFIED` items on this page and how to close them:

- **Netlify greenfield site/env values** — no site exists in the repo and no authenticated call was
  made. Verify: `netlify status` / `netlify sites:list` with the owner's CLI session, then compare the
  site's env list with §2–§4 (names only; never print values into a report).
- **Whether the greenfield site will reuse the legacy Netlify site or a new staging site** — owner
  decision (`CUTOVER.md` OD-11). Verify after the decision: exactly one site points at `rebuild/` as
  base directory and production remains the frozen deploy until the switch.
- **Supabase production auth settings** (`site_url`, redirect allow-list) — local
  `supabase/config.toml:152-158` shows dev values; production values are dashboard-only. Verify:
  Supabase dashboard → Authentication → URL configuration (owner session), compare to the final origin.
