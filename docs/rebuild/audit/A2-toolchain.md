# A2 — Toolchain audit (frozen legacy app)

Read-only audit of dependencies, configs, build/deploy pipeline and CI for the parity oracle.
Nothing was installed, upgraded or fixed. All numbers are from this checkout on 2026-11-08
(local Node 26.8.1 / npm 11.19.0, Windows). Outputs cited were produced with the commands quoted in
§8. The final section is a prioritized modernization backlog for A7 to consume; it does **not**
choose a framework.

## 1. Environment and versions (measured)

| Fact | Value | Evidence |
|---|---|---|
| `engines.node` | `>=22.19.0` | `package.json:7-9` |
| `packageManager` | `npm@11.11.0` (no corepack enforcement) | `package.json:6` |
| `.nvmrc` | `22` (floating) | `.nvmrc:1` |
| CI Node | `'22'` in `ci.yml:34`, `rebuild.yml:56,104,156`; step *title* says "Setup Node 20" | `.github/workflows/ci.yml:31` |
| Netlify | `NODE_VERSION="22"`, `NPM_VERSION="11.11.0"` | `netlify.toml:5-11` |
| Local runtime | Node 26.8.1, npm 11.19.0 (above `engines` floor, below CI pin) | `node --version`, `npm --version` |
| Installed majors | vite 8.3.5, vitest 5.0.5, jsdom 30.0.1, eslint 10.10.0, tailwindcss 4.3.3, react 19.3.0, react-router-dom 7.18.3, framer-motion 13.4.0, zustand 5.0.15 | `node_modules/*/package.json` |
| TypeScript | *two* compilers: `npx tsc --version` → **7.0.2** (`typescript` aliased to `npm:typescript@7.0.2`, `package.json:161`); `npx tsc6 --version` → **6.0.3** (`typescript` aliased to `npm:@typescript/typescript6@6.0.2`, line 188) | CLI output + alias table |
| Dependency tree | 1,208 installed packages (prod 153 / dev 1,027 / optional 183) | `npm audit --json` metadata |
| Lockfile | `package-lock.json` 642,971 bytes; `npm ci` in CI and Netlify | file, `ci.yml:38` |

Drift: local Node 26 + npm 11.19 vs CI/Netlify Node 22 + npm 11.11 (`RISK_REGISTER.md` R14 already
records this). There is no `engine-strict`/corepack enforcement, so a wrong local version produces
warnings at most.

## 2. Dependency inventory

40 `dependencies`, 51 `devDependencies` (`package.json:99-193`). Classification below combines
package-to-source grep counts with the reachability graph from A1: a dependency is "shipped" only if
a module reachable from `src/main.tsx` imports it.

**Scope ruling (owner, 2026-11-08): Wave 0 keeps the dependency manifest frozen — no legacy
`package.json` edits.** Everything in §2.2–§2.4 and in the backlog is therefore a **Wave 1 rebuild
deliverable**, recorded here as evidence for the scaffold, not as a legacy repair.

### 2.1 Shipped browser dependencies (used by reachable code)

| Package | Role | Usage evidence |
|---|---|---|
| `react` / `react-dom` | UI runtime | `main.tsx:1-2`; 90+ importers |
| `react-router-dom` | routing | `main.tsx:3`, `App.tsx:1`; 25 imports |
| `framer-motion` | animation (page transitions, timeline, lightbox) | 104 imports, e.g. `App.tsx:2`, `LoveTimeline.tsx:2` |
| `lucide-react` | icons | 85 imports, e.g. `Header.tsx:2` |
| `@supabase/supabase-js` | DB + auth client | `lib/supabase/client.ts:7`; reached via the `@/lib/supabase` barrel (81 imports) |
| `zustand` | state | 16 imports across 8 stores |
| `@sentry/react` | error reporting | `services/ErrorLoggingService.ts:8` (only importer) |
| `@dnd-kit/core`, `/sortable`, `/utilities` | admin drag-drop | `components/admin/AlbumOrganizer.tsx`, `useAlbumOrganizer.ts` (2/2/1) |
| `@tanstack/react-virtual` | gallery virtualization | `components/gallery/hooks/useVirtualizedMasonry.ts:2` |
| `class-variance-authority` | button/badge variants | `ui/Button.tsx`, `ui/Badge.tsx` (2) |
| `clsx`, `tailwind-merge` | `cn()` | `lib/utils.ts:1-2` (43 importers of `cn`) |
| `date-fns` | activity timestamps | `components/activity/ActivityCard.tsx` (1) |
| `exifr` | EXIF in lightbox **and** batch scripts | `photo-viewer/PhotoLightbox.tsx:34`; `scripts/photo-batch-utils.mjs:7` (see §2.3) |
| `jszip` | batch download | `utils/download.ts` (2) |
| `@fontsource/instrument-sans`, `/cormorant-garamond`, `/pinyon-script` | self-hosted fonts | CSS imports `src/index.css:1-11` (not JS imports) |
| `@radix-ui/react-slot` | `Button asChild` | `ui/Button.tsx:1` — **not declared** (transitive) |
| `workbox-window` | SW update handling (dynamic import) | `utils/serviceWorker.ts:32` — **not declared** (transitive of `vite-plugin-pwa`) |

Build-time only (not in the client graph): `tailwindcss`/`@tailwindcss/vite`, `vite`,
`@vitejs/plugin-react`, `babel-plugin-react-compiler`, `@sentry/vite-plugin`, `vite-plugin-pwa`,
`terser`, `rollup-plugin-visualizer`.

### 2.2 Declared but unused by reachable code (dead dependencies)

Measured by importing each package in the reachable module set: zero importers.

| Package | Status |
|---|---|
| `zod` | 5 importers, **all in dead modules** (`utils/validation.ts`, `validators/*`). Not in shipped graph. |
| `dompurify` | importers `utils/sanitize.ts`, `utils/security.ts` — both dead. |
| `lenis` | only `components/layout/Layout.tsx:3` (dead; also imports `lenis/dist/lenis.css`). |
| `canvas-confetti` | only `sections/LoveQuiz.tsx` (dead). |
| `blurhash` | only `hooks/useBlurHash.ts` (dead). |
| `react-masonry-css` | 0 imports anywhere. |
| `web-vitals` | 0 imports anywhere (performance is measured by Lighthouse scripts instead). |
| `@sentry/browser` | 0 direct imports; `@sentry/react` depends on it. Declaring both is redundant. |
| `@radix-ui/react-dialog`, `/dropdown-menu`, `/tabs`, `/toast`, `/tooltip` | 0 src imports each (5 packages). The only radix package the app needs is the undeclared `react-slot`. |
| `@fontsource/allura`, `/inter`, `/outfit` | not imported by `index.css` or any module (3 packages). |
| `@types/leaflet` | 0 references; `leaflet`/`react-leaflet` are no longer installed (`MapView.tsx` is CSS-only, 327 lines; `App.test.tsx:7-8` still mocks the removed libs). |
| `@types/canvas-confetti` | only dead `LoveQuiz.tsx`; moot once the package is dropped. |
| `@tensorflow/tfjs` | 0 direct imports; scripts load `@tensorflow/tfjs-backend-wasm` by path (`scripts/face-enrich-photo-batch.mjs:105`). |
| `esbuild` | 0 references in repo; Vite 8 is Rolldown-based (see `netlify.toml:6-9` comment), so a direct `esbuild` devDep looks vestigial. |
| `@typescript/native` + `typescript` dual aliasing | see §5 — two compilers for one job. |

### 2.3 Misclassified / missing dependencies (real defects)

- **`exifr` is a devDependency but ships in the client bundle.** `src/components/photo-viewer/PhotoLightbox.tsx:34` imports it and `PhotoLightbox` is lazy-loaded by the live Gallery page (`pages/Gallery.tsx:31-33`). A production install without dev deps cannot build.
- **`tus-js-client` is imported but not declared and not installed.** `scripts/publish-photo-batch.mjs:5`, `scripts/push-photo-review-batch.mjs:5`, `scripts/push-guest-photo-review-batch.mjs:5` import it; `package.json` has no entry and `node_modules/tus-js-client` is absent → those three media scripts fail on a clean checkout (**inference** from import + absence; not executed).
- **`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` are in `dependencies` but are Node-only** (`netlify/functions/guest-upload-url.ts:2-3`); `@aws-sdk/lib-storage` is correctly a devDependency for scripts. They must never reach the browser bundle.
- **`wait-on` is only used by CI** (`.github/workflows/rebuild.yml:183,194`) yet sits in devDependencies — fine, but it is the root of both high advisories (§4).

### 2.4 Overlaps/duplicates named in the task

- `framer-motion` vs `motion`: only `framer-motion` is declared and installed; `motion` is absent. No dual package. (framer-motion 13 already exposes the `motion` renderer APIs — the rebuild should pick one import path.)
- `react-masonry-css` vs `@tanstack/react-virtual`: masonry lib is unused; virtualization is live via one hook. Keep virtualization only.
- `@sentry/browser` + `@sentry/react`: keep `@sentry/react` only.
- `@radix-ui/*` 5 packages + undeclared `react-slot`: replace with either 1–2 radix primitives (`Slot`) or remove radix entirely; today 6 declared/resolved packages serve one `Slot` import.
- `@fontsource/*`: 6 declared, 3 loaded by CSS.

## 3. Outdated status (`npm outdated --json`, read-only)

50 packages outdated. Classification (measured from the JSON):

- 25 updates **within the declared range** (patch/minor): e.g. `vite 8.3.5→8.3.6`, `react 19.3.0→19.3.1`, `@supabase/supabase-js 2.116.0→2.119.0`, `eslint 10.10.0→10.14.0`, `lucide-react 1.47.0→1.70.0`, `vitest 5.0.5→5.1.0`.
- 17 out-of-range but same major (ranges pinned): `zustand 5.0.15→5.1.0`, `wait-on 9.1.0→9.5.1`, `prettier 3.9.6→3.9.10`, `@radix-ui/*` minors, `serve`, `terser`, `tailwind-merge`, `@typescript-eslint/parser`, `lenis`, etc.
- 8 **semver-major** upgrades available:

| Package | Current | Latest | Note |
|---|---|---|---|
| `@sentry/browser` | 10.75.0 | 11.11.0 | paired with `@sentry/react` (also 10→11) |
| `@sentry/react` | 10.75.0 | 11.11.0 | error-reporting API major |
| `framer-motion` | 13.4.0 | 14.10.1 | animation API major; 104 import sites |
| `jsdom` | 30.0.1 | 31.0.0 | unit-test env (history of vitest incompatibility, `docs/plans/2026-09-12-master.md:99`) |
| `vite-plugin-pwa` | 1.3.0 | 2.0.0 | PWA contract (`PRODUCT_CONTRACT.md` invariant 9) |
| `sitemap` | 9.0.1 | 10.0.0 | postbuild sitemap generator |
| `dotenv` | 17.4.2 | 18.0.9 | scripts/config only |
| `supabase` (CLI) | 2.117.0 | 3.0.0 | local schema/migration tooling |

No upgrade is performed or recommended for the frozen oracle (Wave 0 scope freeze,
`docs/rebuild/plans/2026-11-08-workbench.md:39-40`); this list is input for the rebuild scaffold.

## 4. Advisories (`npm audit --json`, read-only)

Recorded summary (exact metadata): `{"info":0,"low":2,"moderate":13,"high":2,"critical":0,"total":17}`.

- All 17 have `fixAvailable: true`. None is in the shipped client bundle: the two **high** findings
  are `joi` and `follow-redirects`, both reached only through `wait-on@9.1.0` → (`joi`, `axios` →
  `follow-redirects`), measured with `npm ls joi follow-redirects`. `wait-on` is used only in
  `.github/workflows/rebuild.yml`.
- Moderate chain: `minimatch`/`glob` → `eslint` (`@eslint/config-array`), `@typescript-eslint/parser`
  and `-plugin` (`typescript-estree`), `@sentry/vite-plugin` (`@sentry/bundler-plugins`),
  `vite-plugin-pwa` (`workbox-build`). Low: `deepmerge` via `@rollup/plugin-node-resolve`.
- All are build/CI-time, so archive risk is low; the policy gap is that **no CI job runs
  `npm audit`** and both dependency bots ignore majors (`dependabot.yml` `ignore:
  version-update:semver-major`), while an empty `renovate.json` is also present — two bots are
  configured for one job.

## 5. Toolchain drift and configuration gaps

| Area | Measurement | Consequence |
|---|---|---|
| Two TypeScript compilers | `tsc`=7.0.2 (`@typescript/native` alias), `tsc6`=6.0.3 (`@typescript/typescript6` alias); CI runs both (`ci.yml:46-53`) | Doubles typecheck time and lets code pass one compiler and fail the other; `typescript-eslint@8` is peer-wired to TS 6 (`docs/plans/2026-09-12-master.md:103`), so the TS7 pass is not type-aware-linted |
| TS config floor | `target`/`lib` `ES2020`, `allowJs: true`, `checkJs: false` (`tsconfig.json:3-4,27-29`); no `noUncheckedIndexedAccess`/`verbatimModuleSyntax` | Weaker than `QUALITY_BAR.md:7-16`; `include` names `.storybook/**/*` (`tsconfig.json:41`) although no `.storybook/` exists; includes `scripts/**` and `tests/**` in the app project |
| ESLint suppressions | `@typescript-eslint/no-explicit-any: off` (`eslint.config.js:142`), `no-non-null-assertion: warn` (143), `react-hooks/set-state-in-effect`/`refs` off (144-145); `project` set (116) but no type-aware rules enabled; no `import`/`no-cycle` plugin; `*.config.js` ignored (20); JS files `ecmaVersion: 2020` (67) | Lint does not enforce the quality bar; configs themselves are unlinted |
| Peer-dep workaround | `.npmrc:18` `legacy-peer-deps=true` because `eslint-plugin-jsx-a11y@6.10.2` peers cap at ESLint 9 | Every install bypasses peer resolution; masks future conflicts |
| Vitest gates | jsdom env, `coverage.provider: v8` but **no thresholds** (`vitest.config.js:19-23`); tests included only from `src/**` (17), `tests/**` excluded (18) | 346 tests protect behaviour but coverage can silently fall |
| Config format split | `vite.config.js` (400), `vitest.config.js` (30), `eslint.config.js` (153) are JS with `/* global process */` (`vite.config.js:1`); Playwright configs are TS (`playwright.config.ts`, `.visual.ts`, `.visual-prod.ts`) | `tsc` does not typecheck the build configs (`tsconfig.node.json:10` includes only `vite.config.js`; `allowJs`, not `checkJs`) |
| Entry mismatch | `index.html:133` loads `/src/main.jsx`; the file is `src/main.tsx` | Build only succeeds because Vite falls back `.jsx`→`.tsx`; a rebuild should fix the extension |
| Env contract drift | `.env.example` documents `VITE_ENABLE_UPLOADS`, `VITE_ENABLE_GUESTBOOK`, `VITE_REQUIRE_UPLOAD_APPROVAL` (lines 79-85) but no code reads them (grep); `.env.example` also documents `VITE_APP_VERSION` which only build/verify tooling uses | Three documented feature flags are unimplemented; readers cannot tell which keys are live |
| Husky not installed | `.husky/pre-commit` runs `npx lint-staged --no-stash`, but `package.json` has **no `prepare` script** (measured by grep) | A fresh clone does not install hooks; formatting/lint drift is only caught in CI |
| CI gate scope | `ci.yml` runs lint, format, `tsc`, `tsc6`, unit tests, build only; e2e explicitly excluded (`ci.yml:61-63`); no coverage gate, no bundle budget, no axe, no `npm audit`, no parity | Quality bar items (`QUALITY_BAR.md:26-48`) are unenforced on PRs; Lighthouse runs in a separate workflow with `performance: warn ≥0.6`, `accessibility: error ≥0.9`, `seo: warn ≥0.9` (`.lighthouserc.cjs:19-24`) — well below the rebuild targets |

## 6. Build and deploy pipeline inventory

- **Dev**: `npm run dev` → `node scripts/dev.js` (`package.json:20`). The wrapper kills whatever owns
  port 5173 (`scripts/dev.js:8-46`) then spawns `npx vite` (54-57) — the reason `RULES_OF_ENGAGEMENT.md`
  §4 forbids free-port dev servers. Vite dev/preview proxy media when `VITE_MEDIA_BASE_URL` is set
  (`vite.config.js:363-393`).
- **Build**: `vite build` then `postbuild` = `prune-local-media → copy-public-images →
  generate-sitemap → prune-sourcemaps` (`package.json:23`):
  - `prune-local-media` deletes `dist/{video,background_audio,media}` when `VITE_MEDIA_BASE_URL` is
    set — the mechanism that keeps 3.6 GB of untracked media out of deploys (`RISK_REGISTER.md` R3);
  - `copy-public-images` copies `public/images` → `dist/images` (tracked images still ship);
  - `generate-sitemap` emits `dist/sitemap.xml` + `dist/robots.txt` from a hard-coded 7-route list
    (`scripts/generate-sitemap.js:8-16`; `/people` is listed although `App.tsx` has no `/people`
    route), and sets `lastmod: new Date()` → non-deterministic output;
  - `prune-sourcemaps` re-asserts "no `.map` in `dist`" after the Sentry plugin, because
    `vite-plugin-pwa` can still write `sw.js.map` (`scripts/prune-sourcemaps.js:1-11`).
- **Vite config** (`vite.config.js`): React Compiler via Babel (199-208); Tailwind v4 plugin (209);
  `__SITE_URL__` HTML injection (210-215); Workbox PWA with 2 CacheFirst media routes, statuses
  `[200]` only (216-282, cache-bug history at 241-262); visualizer behind `ANALYZE` (283-289);
  Sentry upload with `errorHandler` that fails the build (293-312); `@` alias (314-318); manual
  chunks `vendor-react/router/supabase/motion/icons/radix` + `app-supabase` (319-334); terser with
  `drop_console` in production (351-357); sourcemaps only when Sentry upload is enabled (361);
  `__DEV__`/`__APP_VERSION__` defines (394-398).
- **Sentry release identity**: `scripts/lib/sentry-upload-config.js` (149 lines) is the single
  resolver for release naming/credentials, imported by `vite.config.js:14,40` and regression-tested
  (`src/__tests__/sentryReleaseConfig.test.ts` 404 lines, `sentryUploadConfig.test.ts`,
  `verifyReleaseEnvSentry.test.ts`, `sentryCspHeaders.test.ts`). This is the most rigorous piece of
  the pipeline and a good template for the rebuild's release contract.
- **Netlify** (`netlify.toml`): build `npm run verify:env && npm run build` (line 3), publish `dist`;
  `NODE_VERSION="22"`/`NPM_VERSION="11.11.0"` (5-11); apex→www 301 (13-18); **edge function**
  `gallery-share` on `/gallery` (20-22); SPA fallback `/* → /index.html` (24-27); deploy-preview and
  branch-deploy contexts repeat the same command (29-33).
- **Serverless surface**: 1 Netlify edge function (`netlify/edge-functions/gallery-share.ts`, OG tags
  for shared photos), 2 Netlify functions (`netlify/functions/download-pack.ts` — `jszip` +
  `@supabase/supabase-js`; `guest-upload-url.ts` — `@aws-sdk/client-s3` presign + `node:crypto`),
  1 Supabase edge function (`supabase/functions/guest-face-tagging-admin/index.ts`), 31 migrations.
- **Gates**: `verify:release` = env + secrets + supabase + lint + `tsc` + unit + build + public e2e
  (`package.json:79`); `verify:env` = repo hygiene + release env (73); `workbench:verify` =
  contracts + legacy freeze (88). CI (`.github/workflows/ci.yml`) runs a subset; `rebuild.yml` adds
  the workbench gates, a scaffold-conditional greenfield job and a nightly/label-gated parity job
  (`rebuild.yml:129-219`).

## 7. Prioritized modernization backlog (inputs to A7)

Scope key: **R** = must land in the greenfield rebuild; **decision input** = evidence A7 should
weigh, not an action. There is no legacy scope in this backlog: the owner confirmed on 2026-11-08
that Wave 0 keeps the dependency manifest and toolchain frozen, so every item below is a rebuild
deliverable. Effort: S ≤ 1 day, M 1–3 days, L > 3 days.

### P0 — decide/land before or with the Wave 1 scaffold

| ID | Change | Why (evidence) | Effort | Risk | Scope |
|---|---|---|---|---|---|
| P0-1 | Pin one runtime: Node 22.x + npm 11.11 in `.nvmrc`, `engines`, `packageManager`, CI, Netlify; enforce (`engine-strict` or corepack) | local 26.8.1/11.19 vs CI 22/11.11 (§1; `RISK_REGISTER.md` R14) | S | Low | R |
| P0-2 | One TypeScript compiler + type-aware lint: drop the `tsc`/`tsc6` alias pair, upgrade `typescript-eslint` when it supports the chosen TS, enable `recommended-type-checked`, `no-explicit-any: error`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax` | §5 rows 1–2; `QUALITY_BAR.md:7-16` | M | Medium (new violations surface) | R |
| P0-3 | Rebuild the dependency manifest from the live graph: drop the 20+ dead packages, declare the 2 phantom packages, add the 1 missing script package, move `exifr` to runtime deps, keep AWS SDK server/dev-only | §2.2–2.4 | S–M | Low | R (Wave 1; legacy manifest stays frozen in Wave 0) |
| P0-4 | CI quality gates from day one: coverage thresholds, lint warnings-as-errors, `npm audit --audit-level=high`, bundle-size budget, axe route check, parity gate on labelled PRs | `ci.yml` scope (§5); `QUALITY_BAR.md:26-63` | M | Low | R |
| P0-5 | Env contract: one typed env schema consumed by build + runtime; delete/deliver the 3 unimplemented `VITE_ENABLE_*` flags | §5 env row | S | Low | R |
| P0-6 | Fix the entry/extension and config typing: `main.tsx` referenced as `.tsx`; `vite`/`vitest` configs typed (`.mts`) and included in a typecheck | `index.html:133`; §5 | S | Low | R |

### P1 — Wave 1–4 hardening (parity-neutral)

| ID | Change | Why | Effort | Risk | Scope |
|---|---|---|---|---|---|
| P1-1 | Remove the `.npmrc` `legacy-peer-deps` workaround (upgrade `eslint-plugin-jsx-a11y` or pin an ESLint it supports) and add `import-x/no-cycle` + import ordering | §5 peer-dep row; 10 layering violations in A1 §3 | M | Medium | R |
| P1-2 | Define and enforce compile-time bundle boundaries: a size budget per route/chunk, manualChunks replaced by route-level splitting; keep the 180/120/450 KB gzip targets | `QUALITY_BAR.md:42-48`; current `chunkSizeWarningLimit: 500` only warns (`vite.config.js:345`) | M | Medium | R |
| P1-3 | Move the public e2e subset into the required PR path (or a merge queue), keep the full matrix nightly | `ci.yml:61-63` excludes e2e; `verify:release` is manual | M | Medium (flaky/time) | R |
| P1-4 | Collapse duplication before porting: one toast system, one token source, one accessibility folder, one lightbox path, delete-don't-port 110 dead modules | A1 §5 table (14,534 dead lines) | M–L | Low–Medium | R |
| P1-5 | Make build artifacts deterministic: sitemap `lastmod` from commit date not `now`, stable route list generated from `contracts/routes.json` | `scripts/generate-sitemap.js:8-16,23`; `contracts/README.md:41-44` demands byte-identical regeneration | S | Low | R |
| P1-6 | PWA: re-validate the offline/cache contract (opaque-response trap) and decide whether Workbox is kept | `vite.config.js:236-281` (statuses `[200]` only, cache-bust notes) | M | Medium | R |

### P2 — post-cutover / opportunistic

| ID | Change | Why | Effort | Risk | Scope |
|---|---|---|---|---|---|
| P2-1 | Upgrade the 8 semver-major packages one PR at a time, each behind the parity gate | §3 | M (spread) | Medium | R |
| P2-2 | Consolidate dependency automation: one bot, majors allowed on a schedule, `npm audit` gate | §4 (dependabot + empty renovate) | S | Low | R |
| P2-3 | Raise Lighthouse gates to the quality bar (perf ≥ 90, a11y ≥ 95 on priority routes) | `.lighthouserc.cjs:19-24` vs `QUALITY_BAR.md:47` | S | Medium (needs perf work) | R |
| P2-4 | De-duplicate media pipelines (`scripts/` 61 files, 22 media-batch entry points vs postbuild helpers) behind one documented publish command | `package.json:33-57`; A3 owns the contracts | M | Low | R |
| P2-5 | Reconsider `wait-on`/`serve`/`lighthouse`-only devDeps once CI moves to a managed server helper | §2.3, §4 | S | Low | R |

**Decision inputs for A7 (not recommendations):** (a) the oracle is client-rendered and its SEO is
runtime DOM writes + one edge function, so SSR is an optimisation, not a parity requirement
(A1 §8); (b) a Vite-class bundler with route-level splitting already meets the inherited chunking
model (A1 §11); (c) every candidate must keep the PWA/offline contract and the three-function
serverless surface if host compatibility is to stay; (d) the rebuild's first win is deleting 27% of
the source tree, independent of framework.

## 8. Evidence commands (read-only)

```
git rev-parse --abbrev-ref HEAD                                  # rebuild/greenfield
git rev-parse 'legacy-freeze-2026-11-08^{commit}'                # dd0cf481…
git log --oneline -5                                             # HEAD ef148a0
node --version; npm --version                                    # v26.8.1 / 11.19.0
npx tsc --version; npx tsc6 --version                            # 7.0.2 / 6.0.3
git ls-files 'src/*' | Measure-Object                            # 352 files
npm outdated --json                                              # 50 packages
npm audit --json                                                 # 17 (2 low, 13 moderate, 2 high)
npm ls joi follow-redirects                                      # wait-on@9.1.0 chain
git ls-files 'src/*' | ForEach-Object { (Get-Content $_).Count } # line counts
# reachability/import graph: inline Node ESM over git ls-files 'src/*'
```

## 9. Open questions for the owner

1. Is "`npm audit` clean at high/critical" a hard gate for the rebuild? The only high findings come
   from `wait-on` in CI; fixing them may mean replacing `wait-on` in `rebuild.yml`.
2. Is keeping the current PWA/Workbox behaviour a requirement, or may the rebuild choose a different
   (possibly simpler) offline strategy as long as `PRODUCT_CONTRACT.md` invariant 9 holds?
3. Should dependency automation stay on Dependabot (majors ignored) or move to Renovate with
   scheduled majors? Two bots are configured today and the choice affects maintenance load.

Resolved during checkpoint review (owner, 2026-11-08): legacy dependency repair is **out of scope** —
Wave 0 keeps `package.json` frozen; the manifest work in §7 is Wave 1 rebuild-only.
