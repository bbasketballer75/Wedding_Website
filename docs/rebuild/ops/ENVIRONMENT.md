# ENVIRONMENT — configuration contract for the archive

Documentation only. This file records **where every variable comes from, who sets it, what breaks when
it is missing, and what changed for the greenfield app**. No secret values are recorded here. Refreshed
against the delivered Wave 8 pipeline (2026-11-09; branch `rebuild/greenfield` @ `056ae0c`). Anything the
repo cannot prove is marked `UNVERIFIED` with the step that closes it.

Sources of truth: `.env.example:1-85`, `rebuild/.env.example:1-16`, `rebuild/src/app/env.ts:15-65`,
`rebuild/src/app/pwa.ts:15,25-28`, `rebuild/src/app/seo/telemetry.ts:1-101`,
`src/lib/supabase/client.ts:9-17`, `netlify.toml:1-33`, `rebuild/netlify.toml:1-150`,
`rebuild/package.json:12,24-31`, `netlify/functions/guest-upload-url.ts:22-44`,
`netlify/functions/download-pack.ts:12-16`, `netlify/edge-functions/gallery-share.ts:16-20`,
`.github/workflows/rebuild.yml:42-46,114-150,164-170`, `scripts/verify-release-env.js:28-30`,
`scripts/lib/sentry-upload-config.js`, `scripts/supabase-mgmt-api-push.mjs:1-58`,
`supabase/config.toml:5,10,31-38,152-158`, `wrangler.toml:1-11`, `docs/archival/SECURITY.md:3-54`.

## 1. How configuration reaches the running system

| Layer | Mechanism | Evidence |
|---|---|---|
| Browser/build | Vite inlines every `VITE_*` value **at build time**; no runtime env in the browser | `rebuild/src/app/env.ts:48-65` (static access; spreading `import.meta.env` does not survive a build) |
| Local dev/build | `.env`, `.env.local`, `.env.*.local` (gitignored); `dotenv` in Node scripts | `.gitignore` env block; `scripts/verify-release-env.js:13-22` |
| CI (GitHub Actions) | Workflow `env:` with **placeholders only** | `.github/workflows/rebuild.yml:42-46,164-170` |
| Netlify build | Site env panel injected into the build command; greenfield config sets `NODE_VERSION=22` and `VITE_ENABLE_PWA=1` in `[build.environment]` | `netlify.toml:3-11` (legacy); `rebuild/netlify.toml:65-75` (greenfield) |
| Netlify functions (Node) | Function **runtime** env (`process.env`) — not the browser build env | `netlify/functions/guest-upload-url.ts:36-44`; `download-pack.ts:12-16` |
| Netlify edge function (Deno) | `Netlify.env.get()` | `netlify/edge-functions/gallery-share.ts:16-20` |
| Scripts / operator | `dotenv` reads repo `.env` (gitignored) or shell env | `scripts/supabase-mgmt-api-push.mjs:22-58`; `scripts/list-r2.mjs:1-11` |
| Blank values | Treated as absent (empty string ≠ value) | `.env.example:39-43`; `scripts/verify-release-env.js` (`isPlaceholderValue`); `rebuild/src/app/env.ts:15-19` (`blankToUndefined`) |

Precedence: shell/CI/Netlify-provided values win over `.env` (`dotenv` does not override); for the browser,
Netlify/CI env is what Vite inlines at build time. A wrong build-time value requires a rebuild.

## 2. Public browser/build variables (`VITE_*`)

Public by definition (committed into the JS bundle). Never put a service-role key, R2 secret, or Sentry
auth token in a `VITE_*` name (`docs/archival/SECURITY.md:15-29`; `npm run verify:secrets` /
`npm run verify:env` enforce it).

| Variable | Required? | Set by (legacy → greenfield) | Missing failure mode | Greenfield notes |
|---|---|---|---|---|
| `VITE_SUPABASE_URL` | **required** | Netlify prod env; CI placeholder (`rebuild.yml:43,165`); local `.env` | Legacy client throws at import (`src/lib/supabase/client.ts:12-17`); greenfield schema error (`rebuild/src/app/env.ts:35-46`) | Same project (`zaczcyzvavetgfuucljf`) unless owner chooses otherwise |
| `VITE_SUPABASE_ANON_KEY` | **required** | as above | as above | Public anon key only |
| `VITE_SITE_URL` | recommended (legacy), defaulted (greenfield) | Netlify env; CI sets it; local optional | Legacy falls back to `https://www.theporadas.com` (`SEOHead`, `scripts/generate-sitemap.js:6`); greenfield default `rebuild/src/app/env.ts:24-27` | **Final origin at cutover**; also pinned in `rebuild/src/app/seo/routeMeta.json` (prerender metadata; `{{SITE_URL}}` replacement) |
| `VITE_MEDIA_BASE_URL` | optional | Netlify env; **unset in CI/parity** | Unset ⇒ same-origin media (`src/utils/media.ts:14-36`); production would serve media from `dist` instead of CDN (`scripts/prune-local-media.js:1-30`) | Production: `https://media.wedding.theporadas.com`; parity builds keep it unset/mocked |
| `VITE_GA_ID` | optional | Netlify env | Silently disabled (`rebuild/src/app/seo/telemetry.ts:5-6,75-86`; legacy `AnalyticsService.ts:1-14`) | Now wired: env-guarded **and consent-gated** — nothing is sent until `localStorage['wedding-telemetry-consent']==='granted'` (`telemetry.ts:7-14`). Consent UX is owner decision OD-9 |
| `VITE_SENTRY_DSN` | optional | Netlify env; DSN host must be allowlisted in CSP `connect-src` (`rebuild/netlify.toml:112-115`; legacy `public/_headers`) | Silently disabled (`telemetry.ts:5-6,75-86`; legacy `ErrorLoggingService.ts:37-46`) | Same consent gate; no session replay, sanitised messages only (`telemetry.ts:1-25`) |
| `VITE_ENABLE_PWA` | **production build flag** (`"1"`), not a secret | `rebuild/netlify.toml:69-75` sets it for the production deploy build | Unset ⇒ no install metadata / no SW registration; the static head stays byte-identical to the frozen app | **Only the production build may set it**; parity/preview builds must not (`rebuild/netlify.toml:35-40`; `rebuild/src/app/pwa.ts:15,25-28`) |
| `VITE_APP_VERSION` | optional (legacy only) | Netlify/local | Release falls back to `package.json` version (`vite.config.js:24-42`) | Not needed by the rebuild (releases come from `COMMIT_REF`; rebuild has no Sentry upload config yet) |

Unused documented flags: `VITE_ENABLE_UPLOADS`, `VITE_ENABLE_GUESTBOOK`, `VITE_REQUIRE_UPLOAD_APPROVAL`
(`.env.example:74-85`) — **no source file reads them**; do not set them.

## 3. Build-only secrets and Netlify built-ins (legacy pipeline; greenfield equivalent `UNVERIFIED`)

| Variable | Visibility | Set by | Rules / failure mode | Greenfield |
|---|---|---|---|---|
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | **secret** (build only) | Netlify UI, Production scope | **All three or none**; partial set fails the build; present ⇒ hidden maps uploaded then deleted from `dist` (`.env.example:35-49`; `scripts/lib/sentry-upload-config.js`; `scripts/prune-sourcemaps.js:1-11`) | The rebuild has **no Sentry source-map upload plugin** in `rebuild/vite.config.ts`; enabling it is a Wave-9/owner decision (OD-9), `UNVERIFIED` |
| `COMMIT_REF` | build metadata | Set automatically by Netlify | Required for a credentialed deploy build (release identity; `.env.example:44-46`; `vite.config.js:24-42`) | Reusable if Sentry upload is enabled |
| `CONTEXT` | build metadata | Netlify (`production`, `deploy-preview`, `branch-deploy`) | Decides whether Sentry upload is expected in a deploy | same |
| `NODE_VERSION` / `NPM_VERSION` | build config | Netlify site config / `netlify.toml` | Frozen app pins Node 22 / npm 11.11.0 (`netlify.toml:5-11`); Rolldown needs Node ≥22.12 | Greenfield `rebuild/netlify.toml:72-74` sets `NODE_VERSION="22"`; `NPM_VERSION` not set there (Netlify default) — `UNVERIFIED` that the default is 11.11.x |
| `ANALYZE` | build flag | local scripts only | Enables the legacy bundle visualizer (`vite.config.js:283-289`) | not used by the rebuild (uses `scripts/check-budgets.mjs` + `tools/perf`) |

## 4. Server-only secrets (never in a `VITE_*`, never in the repo)

| Variable | Consumer | Missing failure mode | Evidence |
|---|---|---|---|
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_MEDIA_BUCKET`, `R2_PUBLIC_BASE_URL` | `netlify/functions/guest-upload-url.ts` (presigned PUT), media scripts | Function returns HTTP 500 `Server configuration error`; guest uploads break | `netlify/functions/guest-upload-url.ts:22-44`; `scripts/list-r2.mjs:5-11`; `.env.example:63-72` |
| `SUPABASE_SERVICE_ROLE_KEY` | operator/scripts only (`scripts/verify_supabase.js`) | admin-access verification fails/skips; must never reach a browser build | `docs/archival/SECURITY.md:15-29,42-48`; guarded by `SUPABASE_ALLOW_SERVER_ROLE_VERIFY` |
| `SUPABASE_ACCESS_TOKEN` | `scripts/supabase-mgmt-api-push.mjs` (Management-API migration push; `--dry-run` supported) | script exits `Missing SUPABASE_ACCESS_TOKEN in .env` | `scripts/supabase-mgmt-api-push.mjs:1-58` |
| `ADMIN_SMOKE_EMAIL`, `ADMIN_SMOKE_PASSWORD` | `scripts/verify-live-admin-smoke.js` | live admin smoke cannot run | `.env.example:58-61` |

Supabase project identity is public config: ref `zaczcyzvavetgfuucljf` (`supabase/config.toml:5`), DB major
version 17 (`supabase/config.toml:38`), local ports 54321/54334/54320 (`supabase/config.toml:5-38`); the
workspace sandbox must shift them (`../audit/A3-data.md` §1.2).

## 5. Environment matrix (which values each context uses)

| Context | Supabase | Site URL | Media base | PWA flag | Telemetry | Build command |
|---|---|---|---|---|---|---|
| Legacy dev (`npm run dev`) | real or placeholder | optional | optional (Vite dev proxy) | n/a | optional | dev server |
| Rebuild dev (`rebuild/npm run dev`) | `rebuild/.env.example` placeholders | defaults to production origin | unset | **unset** | unset (disabled) | dev server |
| CI (`rebuild.yml` workbench/rebuild) | `https://placeholder.supabase.co` + placeholder anon | `https://www.theporadas.com` | unset | unset | unset | `npm run build:prod` + checks |
| CI parity job | placeholder + **mocked REST** | production origin | CDN host, network mocked | unset | unset | `npm run build` (parity build) |
| Netlify legacy production | real project | `https://www.theporadas.com` | CDN host | n/a | DSN/GA if configured | `npm run verify:env && npm run build` |
| Netlify greenfield production | real project | final origin at cutover | CDN host | **`1`** | owner decision | `npm run build:prod` |
| Netlify greenfield preview | real project (staging) | staging origin | CDN host or unset | **unset** | unset | `npm run build` (no PWA/prerender) |

## 6. Failure-mode verification (cheap, read-only)

```bash
# Legacy build guard: required public values + Sentry all-or-none + browser-facing secret scan
node scripts/verify-release-env.js          # or: npm run verify:env
# Greenfield env parser unit test
cd rebuild && npx vitest run tests/unit/env.test.ts
# PWA/telemetry gates are unit-tested (not browser-dependent)
cd rebuild && npx vitest run src/app/pwa.test.ts
# Which env names the greenfield code reads (names only)
grep -Rho "VITE_[A-Z_]*" rebuild/src/app/env.ts rebuild/src/app/pwa.ts rebuild/src/app/seo/telemetry.ts | sort -u
# Generated SEO/PWA artifacts must match the route table
cd rebuild && npm run build:seo:check
# Secret scan
npm run verify:secrets
```

`UNVERIFIED` items and how to close them:

- **Netlify greenfield site/env values** — no site exists in the repo and no authenticated call was made.
  Verify: `netlify status` / `netlify sites:list` with the owner CLI session; compare names (never values)
  with §2–§4; confirm `VITE_ENABLE_PWA=1` only on the production site and `NODE_VERSION=22`.
- **Netlify default npm version** on the greenfield site (only `NODE_VERSION` is pinned in
  `rebuild/netlify.toml`). Verify in the site build log or set `NPM_VERSION=11.11.0` to match the frozen
  site.
- **Supabase production auth URL/redirect settings** — local dev values in `supabase/config.toml:152-158`;
  production is dashboard-only. Verify: Supabase dashboard → Authentication → URL configuration against
  the final origin.
- **Sentry source-map upload for the rebuild** — not wired; if OD-9 enables Sentry, decide the
  release/upload mechanism (legacy resolver documented in `scripts/lib/sentry-upload-config.js`).
