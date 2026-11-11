# BASELINE — measured state of the frozen legacy app

The regression baseline every rebuild wave is measured against. Every number below is produced by
a command stated next to it; CI/checkpoints re-run the commands rather than trusting this prose.

- **Measured object:** the frozen legacy app at tag `legacy-freeze-2026-11-08`
  (`dd0cf48120801ef8ea621be90eed7fd1c2bf3664`, annotated tag object `ed9c818`) and its production
  `dist/` build (built 2026-11-08T05:39:20Z / 00:39 local).
- **Captured:** 2026-11-08T06:15:34Z (`capturedAt` in `contracts/baseline/metrics.json`); workbench
  branch `rebuild/greenfield`; workbench HEAD at capture `891bfbe4f946a3ac9f8ccfc1a8a032616a9b3d39`
  (`captureCommit` in metrics.json).
- **Committed artefact:** [`contracts/baseline/metrics.json`](../../contracts/baseline/metrics.json)
  (validates against `baselineMetricsSchema` in `tools/lib/schemas.mjs`).
- **Gitignored heavy artefacts** (regenerate; never commit):
  `contracts/baseline/inventory.json`, `bundle.json`, `coverage.json`, `lighthouse-summary.json`,
  `lighthouse/*.json`.

Tools (plain Node ESM, no new dependencies):

| Command | Produces |
|---|---|
| `node tools/inventory/capture.mjs` | `contracts/baseline/inventory.json` (deterministic: no timestamps) |
| `node tools/baseline/capture.mjs` | `metrics.json` + `bundle.json` + `coverage.json` (bundle, tsc/tsc6/lint/unit timings, coverage, Lighthouse roll-up) |
| `node tools/baseline/lighthouse.mjs` | live Lighthouse capture: `lighthouse-summary.json` + raw LHR files |
| `node tools/baseline/coverage.mjs` | coverage only: parses `coverage/coverage-summary.json` |

`node tools/baseline/capture.mjs --lighthouse` runs the live Lighthouse capture first; the default
embeds the most recent `lighthouse-summary.json` if present. It never runs `npm run build` (Lead
owns builds) or the Playwright suites (WP-6 forbids them).

## Measurement conditions (read before comparing numbers)

- **Machine:** Windows 11 `win32/x64`, AMD Ryzen 7 3700X (16 logical CPUs reported by `os.cpus()`),
  32 GB RAM, Node `v26.8.1`, npm `11.19.0`, Lighthouse `13.5.0` via `chrome-launcher`.
- **Contention:** the machine was *not* quiet. Other rebuild agents (Parity browser captures,
  Supabase/Docker resets) and unrelated local workloads were active; the Lead measured 47–76% CPU
  from unrelated processes. Our own heavy commands were serialized (build finished before capture;
  the 12 Lighthouse runs were the only browser workload we started). Wall-clock timings are
  therefore relative baselines, not clean-machine absolutes.
- **Lighthouse conditions:** live production URL `https://www.theporadas.com`, read-only GETs, no
  logins. Mobile = Lighthouse defaults (Moto G emulation, simulated Slow-4G 10,240 kbps / 40 ms RTT,
  4× CPU slowdown). Desktop = official `desktop-config` preset (1,350×940, no mobile emulation).
  Two runs per page/profile, each in a fresh headless Chrome (`--headless=new`, temp profile), so
  caches never warm between runs. Both runs are recorded; the **better performance score** wins
  (ties: lower LCP, then lower TBT, then earlier run) — see `lighthouse.method.selection` in
  metrics.json.
- **Lighthouse flakes (recorded, not hidden):** `gallery-desktop` run 1 failed twice (Lighthouse
  `Protocol error (Runtime.evaluate): Execution context was destroyed`) and is recorded as
  `ok:false`; it has no LHR file. On `home-desktop` (both runs) and `film-desktop` run 1 the
  `best-practices` category could not be scored because Lighthouse's document gatherer errored
  (`charset` audit: `Network.getResponseBody ... No resource with given identifier found`); those
  entries are `null`, every other run scored 1.00.
- **Coverage conditions:** Vitest + jsdom, repo config untouched; `npx vitest run --coverage
  --coverage.reporter=json-summary --coverage.reporter=text-summary` writes `coverage/` only.

## Build (Lead-provided; metrics-eng did not run `npm run build`)

| Metric | Value | Source |
|---|---|---|
| Build command | `npm run build` (`vite build` + `postbuild`) | `package.json:21-23` |
| Total wall time | **20.2 s** | Lead build log, frozen commit, Node 26.8.1 / Windows |
| vite build phase | **12.02 s** | Lead build log |
| postbuild phase (derived) | ~8.2 s (`prune-local-media`, `copy-public-images`, `generate-sitemap`, `prune-sourcemaps`) | Lead build log + `package.json:23` |
| PWA precache reported by build | 63 entries / 1,800.52 KiB (JS+CSS+HTML only) | Lead build log; re-derived from `dist/sw.js` below |
| `dist/` build timestamp | 2026-11-08T05:39:20.129Z | `dist/index.html` mtime |

The build is reproduced only by the Lead. `VITE_MEDIA_BASE_URL` was configured for this build, so
`scripts/prune-local-media.js` removed `dist/video/`, `dist/background_audio/` and `dist/media/`
from it; only the copied `dist/images/` remains (verified: those three directories are absent in
`dist/`). The 3.6 GB local media is therefore **not** part of the 148.7 MB build output.

## Production bundle (`dist/`, as built from the frozen commit)

Command: `node tools/baseline/capture.mjs` (reads `dist/`; byte-compresses each emitted JS/CSS file).

| Measurement | Value |
|---|---|
| `dist/` total | **640 files / 148,717,076 B = 141.8 MiB** |
| App payload excluding copied photos | 98 files / **2,649,253 B = 2.53 MiB** |
| JavaScript | 46 files / 1,610,085 B raw / **481,696 B gzip (470.41 KiB)** / 416,744 B brotli |
| CSS | 2 files / 251,614 B raw / **34,301 B gzip (33.50 KiB)** / 25,499 B brotli |
| Fonts (woff + woff2, 3 families) | 22 files / 555,624 B |
| Copied public images | 542 files / **146,067,823 B = 139.3 MiB** |
| PWA icons | 12 files / 197,473 B |
| HTML | 2 files / 8,755 B (`index.html` 4,788 B) |
| Compression method | `gzipSync(buf, { level: 9 })`, `brotliCompressSync(buf)` over raw emitted files; no pre-compressed variants exist in `dist/` |

Initial load graph from `dist/index.html` (`node tools/baseline/capture.mjs` → `bundle.entry`,
`bundle.initialPayload`): one entry script `/assets/index-B_ACu2o8.js` (66,416 B gz), seven
`modulepreload`s (`rolldown-runtime`, `vendor-icons`, `vendor-react`, `vendor-motion`, `react`,
`middleware`, `app-supabase`) and one stylesheet (`index-DYP6bYj0.css`, 33,978 B gz); no inline
scripts. Combined initial payload: **9 files / 1,083,977 B raw / 284,549 B gzip = 277.88 KiB** /
241,828 B brotli, plus the 4,788 B HTML document. This is the cheapest possible first paint cost of
the legacy app.

### Top 20 chunks by gzip

| # | File | Kind | Raw B | gzip B | brotli B |
|---:|---|---|---:|---:|---:|
| 1 | `index-B_ACu2o8.js` | js | 205,154 | 66,416 | 57,549 |
| 2 | `vendor-react-BGKYjtwS.js` | js | 210,337 | 65,484 | 56,295 |
| 3 | `app-supabase-tZC6I57X.js` | js | 236,252 | 58,802 | 49,890 |
| 4 | `Gallery-DHy_wuF4.js` | js | 182,603 | 51,698 | 44,938 |
| 5 | `vendor-motion-oF9liMxR.js` | js | 141,017 | 45,115 | 40,106 |
| 6 | `Admin-DzQmlTIj.js` | js | 122,081 | 34,581 | 29,830 |
| 7 | `PhotoLightbox-DMewTB0W.js` | js | 103,444 | 34,545 | 29,569 |
| 8 | `index-DYP6bYj0.css` | css | 250,910 | 33,978 | 25,258 |
| 9 | `Film-BE4Os7uW.js` | js | 62,678 | 16,481 | 14,064 |
| 10 | `Home-CyiiJlAK.js` | js | 60,778 | 14,842 | 12,731 |
| 11 | `Upload-Dz0gK5aI.js` | js | 55,621 | 13,707 | 11,945 |
| 12 | `vendor-icons-Df_mJc13.js` | js | 33,546 | 11,567 | 9,889 |
| 13 | `Guestbook-BfzZDM2Z.js` | js | 24,666 | 7,437 | 6,512 |
| 14 | `workbox-835c8c05.js` | js | 21,863 | 7,425 | 6,732 |
| 15 | `Activity-xj1R_XZE.js` | js | 15,582 | 5,459 | 4,905 |
| 16 | `GuestShare-DLU1ADxY.js` | js | 13,847 | 4,299 | 3,739 |
| 17 | `FeaturedContentManager-Cvlh0LF6.js` | js | 11,872 | 3,522 | 3,055 |
| 18 | `ClaimsModeration-9z0w6s0j.js` | js | 11,079 | 3,421 | 2,973 |
| 19 | `Print-DNtVlyRy.js` | js | 8,573 | 2,713 | 2,422 |
| 20 | `GuestPhotos-DXrejCwN.js` | js | 6,948 | 2,460 | 2,155 |

Full chunk list: `contracts/baseline/bundle.json` (`chunks.all`; regenerate with
`node tools/baseline/capture.mjs`).

### PWA precache manifest (parsed from `dist/sw.js`)

| Measurement | Value |
|---|---|
| Precache entries | **63** (62 unique URLs; `offline.html` is listed twice) |
| JS+CSS+HTML payload | **1,843,728 B = 1,800.52 KiB** — exactly the build log's figure |
| Full manifest incl. `includeAssets` images | **2,003,781 B = 1,956.82 KiB** |
| Groups | js 1,583,359 B · css 251,614 B · html 8,755 B · icons 140,614 B · images 17,403 B · other 2,036 B |
| Missing from `dist/` | 0 |

The build log counts only emitted JS/CSS/HTML; Workbox also precaches the PWA icons, favicons and
`browserconfig.xml`. Both numbers are reproducible with
`node -e` over `dist/sw.js` or via `bundle.pwa.precache` in `bundle.json`.

## Code inventory (`src/**`)

Command: `node tools/inventory/capture.mjs` → `contracts/baseline/inventory.json` (deterministic;
re-running on the unchanged frozen app yields identical JSON). Line counts are newline counts of
text files; binary assets count bytes only.

### File/line cuts

| Cut | Glob / filter | Files | Lines | Non-blank lines | Bytes |
|---|---|---:|---:|---:|---:|
| `rawWalk` | all of `src/**` | 353 | 54,131 | 48,835 | 3,851,377 |
| `typescript` | `src/**/*.{ts,tsx}` | **337** | **51,877** | **46,867** | 1,736,787 |
| `productionTypeScript` | ts/tsx excluding tests | 298 | 46,603 | 42,311 | 1,551,713 |
| `code` | ts/tsx/js/jsx/mjs/cjs | 342 | 52,267 | 47,202 | 1,748,552 |
| `productionCode` | code excluding tests | 300 | 46,634 | 42,337 | 1,552,579 |
| `tests` | `*.test.*` / `*.spec.*` / `__tests__` | 42 | 5,633 | 4,865 | 195,973 |
| `stylesheets` | `src/**/*.css` | 6 | 1,412 | 1,220 | 31,430 |
| `assets` | images/svg/`.bak` | 5 | 452 | 413 | 2,071,395 |

**Reconciliation of the brief's "337 src files / 46,867 lines":** 337 is `src/**/*.{ts,tsx}`; 46,867
is that cut's **non-blank** line count (physical lines are 51,877). The raw all-extension walk is
353 files / 54,131 lines. All three cuts are recorded above so no reader has to guess.

### Shape by extension / category

| Extension | Files | Lines | Bytes |
|---|---:|---:|---:|
| `.tsx` | 181 | 28,135 | 1,024,038 |
| `.ts` | 156 | 23,742 | 712,749 |
| `.css` | 6 | 1,412 | 31,430 |
| `.js` | 3 | 177 | 6,520 |
| `.jsx` | 2 | 213 | 5,245 |
| `.png` | 3 | — | 2,051,591 |
| `.bak` | 1 | 451 | 15,678 |
| `.svg` | 1 | 1 | 4,126 |

| Category | Files | Lines | | Category | Files | Lines |
|---|---:|---:|---|---|---:|---:|
| component | 145 | 20,934 | | data | 8 | 1,510 |
| page | 59 | 9,891 | | types | 3 | 1,392 |
| test | 42 | 5,633 | | app-shell | 6 | 1,258 |
| lib | 30 | 4,901 | | styling | 5 | 1,109 |
| store | 9 | 2,062 | | provider | 7 | 770 |
| hook | 17 | 1,783 | | service | 3 | 626 |
| worker | 4 | 1,547 | | validator/composable/config | 11 | 714 |

Largest directories by lines: `src/pages` 19 files/4,128 · `src/components/ui` 38/3,761 ·
`src/utils` 23/3,383 · `src/components/admin` 16/3,336 · `src/components/gallery` 21/3,142 ·
`src/pages/admin` 11/2,947 · `src/stores` 11/2,360.

Largest files by lines (full table in `inventory.json → files.largestByLines`): `types/supabase.generated.ts`
1,081 · `components/timeline/LoveTimeline.tsx` 918 · `index.css` 805 ·
`components/photo-viewer/PhotoLightbox.tsx` 773 · `stores/mediaReviewStore.ts` 753 ·
`data/curated-photos.ts` 696 · `workers/media-rewrite/index.ts` 693 ·
`components/admin/AlbumOrganizer.tsx` 575 · `pages/Film.tsx` 570 · `pages/GuestShare.tsx` 549.

### Routes and import graph

- **12 routes / 12 lazy page modules**, parsed from `src/App.tsx` (route contracts are contracts-eng's
  deliverable; this is the inventory-side evidence): `/`, `/film`, `/gallery`, `/upload`,
  `/guestbook`, `/guest-photos`, `/activity`, `/admin/login`, `/admin/*`, `/guest/:token`, `/print`,
  `*` (NotFound).
- Import graph: 348 parsed modules, **654 internal edges** — static 576, re-export 50, dynamic 25,
  worker 3; 40 distinct package specifiers; **0 unresolved internal specifiers**. Four references
  point at repo files outside `src/` (tests importing `scripts/*` and `.lighthouserc.cjs`) and are
  recorded separately, not counted as dead code.
- Hottest modules by production inbound imports: `lib/supabase.ts` 61 (69 incl. tests) ·
  `lib/utils.ts` 43 · `components/ui/Button.tsx` 34 · `context/ToastContext.tsx` 17 ·
  `utils/media.ts` 14 · `components/ui/Input.tsx` 12 · `components/seo/SEOHead.tsx` 11 ·
  `components/gallery/constants.ts` 9 · `components/error/ErrorBoundary.tsx` 9 · `stores/authStore.ts` 9.
- Most-imported packages from `src/**`: `react` 163 importers, `framer-motion` 103,
  `lucide-react` 85, `vitest` 43 (tests), `@testing-library/react` 25, `react-router-dom` 23,
  `zustand` 8 files/15 imports, `@supabase/supabase-js` 4. `virtual:pwa-register` is imported only
  by `src/main.tsx` and resolves through `vite-plugin-pwa`.

### Dead-code evidence (zero inbound references)

**57 files / 7,735 lines** have no inbound static, dynamic, re-export or worker reference and are not
entry/test files. Largest: `workers/media-rewrite/index.ts` 693 · `components/search/Search.tsx` 439 ·
`components/timeline/HalloweenEngagement.tsx` 329 · `components/gallery/MapView.tsx` 327 ·
`components/gallery/PhotoGrid.tsx` 318 · `services/galleryService.ts` 300 ·
`design-system/theme.ts` 292 · `utils/guestTagging.ts` 286 · `components/sections/VideoSection.tsx` 272 ·
`utils/imageOptimization.ts` 264 · `components/ui/VirtualScroll.tsx` 253. Full list with per-file
lines: `inventory.json → deadCode.likelyDead`.

- **6 test-only modules** (imported only by tests, zero production value): nested
  `components/gallery/components/GalleryHeader.tsx` 130 · `components/layout/BackgroundMusic.tsx` 309 ·
  `components/layout/CustomCursor.tsx` 102 · `components/ui/RotateDevicePrompt.tsx` 131 ·
  `components/ui/ScrollProgress.tsx` 30 · `context/HalloweenContext.tsx` 33.
- **2 stray files**: `src/pages/Gallery.tsx.bak` (451 lines / 15,678 B) and
  `src/routes/.eslintrc.js` (5 lines, dead under ESLint 9 flat config).

### Barrels and duplicate families

- **12 `index.*` barrels; only 3 have production inbound imports** (`themes` 3, `types` 3,
  `stores` 2). The other 9 (`components/{activity,layout,ui,video}`, `composables`, `hooks`,
  `pages`, `validators`, `workers/media-rewrite`) have zero inbound — code imports the files
  directly instead. Barrel fan-in table: `inventory.json → barrels`.
- Same-basename collisions (4 groups): `types.ts` ×4, `constants.ts` ×3, `GalleryHeader.tsx` ×2,
  `utils.ts` ×2. 124 exported symbol names are declared by ≥2 non-test modules.
- Named duplicate/parallel families (`inventory.json → duplicates.families`, each entry carries
  size, inbound and cross-import evidence):
  - two `GalleryHeader.tsx` components, 162 lines total, 0 cross-imports;
  - `lib/utils.ts` vs `utils/`: 24 files / 3,476 lines / 5 cross-imports / 2 shared exported symbols;
  - `design-system/` vs `tokens/` vs `themes/`: 4 files / 791 lines / 1 cross-import / **4 shared symbols**;
  - `composables/` vs `hooks/`: 26 files / 2,455 lines / **16 cross-imports** / 10 shared symbols;
  - `context/` vs `providers/`: 4 files / 203 lines / 1 cross-import.

## Dependency inventory

Command: `node tools/inventory/capture.mjs` (scans `src/**`, `scripts/**`, `tools/**`, `tests/**`,
`supabase/**`, `netlify/**` and root configs, then classifies). Full evidence per package:
`inventory.json → dependencies.packages`.

| Classification | Count |
|---|---:|
| `browser-bundle` (imported by `src/**`) | 26 |
| `node-only` (scripts/tools/tests/edge/config/CLI) | 39 |
| `test-only` | 4 |
| `types-only` (`@types/*`) | 5 |
| **`unused`** (no import site and no tool/config mention) | **17** |
| **Total declared** | **91** |

- **17 unused:** `@fontsource/allura`, `@fontsource/inter`, `@fontsource/outfit` (3 of 6 font
  packages never imported; only cormorant-garamond, instrument-sans, pinyon-script are),
  `@radix-ui/react-dialog|dropdown-menu|tabs|toast|tooltip` (all five declared Radix primitives are
  unused), `@sentry/browser` (only `@sentry/react` is used), `@tensorflow/tfjs`,
  `@tensorflow/tfjs-backend-wasm`, `@vladmandic/human` (both ML stacks unused), `react-masonry-css`
  (gallery uses `@tanstack/react-virtual` instead), `web-vitals`, `@vitest/coverage-v8`,
  `@vitest/ui`, `husky` (installed but no `prepare` script installs the hooks).
- **Undeclared direct imports (6):** `@radix-ui/react-slot` (used by `src/components/ui/Button.tsx`),
  `workbox-window` (`src/utils/serviceWorker.ts`), `playwright` (`tools/parity/capture.mjs`; only
  `@playwright/test` is declared), `@netlify/functions` (netlify functions; Netlify provides it),
  `pg` and `tus-js-client` (scripts). These work only through hoisting; a dependency bump can break
  them.
- **Misplaced sections (5):** `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`,
  `@tailwindcss/vite`, `tailwindcss` are `dependencies` but only reach Node-side tooling; `exifr`
  is a `devDependency` but is imported by `src/components/photo-viewer/PhotoLightbox.tsx` (browser
  bundle).
- Overlap pairs recorded with usage evidence: Sentry entry points, masonry vs virtualization,
  dual TypeScript, testing-library surface, AWS S3 pair, minifiers, ML stacks, Radix surface,
  font sources (`inventory.json → dependencies.overlaps`).

## Lighthouse (live production site)

Command: `node tools/baseline/lighthouse.mjs` (12 runs = 3 routes × 2 form factors × 2 runs).
Method, environment and both runs: `metrics.json → lighthouse` and
`contracts/baseline/lighthouse-summary.json`; raw LHR per run under `contracts/baseline/lighthouse/`.

### Selected results (better of two runs)

| Page | Profile | Perf | A11y | Best-prac | SEO | LCP | TBT | CLS | Transfer | Requests |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `/` | mobile | **0.70** | 0.96 | 1.00 | 1.00 | 7,257 ms | 0 ms | 0 | 14.49 MB | 101 |
| `/` | desktop | **0.93** | 1.00 | n/a¹ | 1.00 | 1,611 ms | 28 ms | 0 | 14.49 MB | 53 |
| `/gallery` | mobile | **0.59** | 0.95 | 1.00 | 1.00 | 138,126 ms | 388 ms | 0.0001 | 32.68 MB | 175 |
| `/gallery` | desktop | **0.71** | 0.95 | 1.00 | 1.00 | 28,480 ms | 145 ms | 0.0475 | 38.01 MB | 132 |
| `/film` | mobile | **0.37** | 1.00 | 1.00 | 1.00 | 113,121 ms | 7,736 ms | 0 | 320.18 MB | 163 |
| `/film` | desktop | **0.67** | 0.96 | n/a¹ | 1.00 | 1,240 ms | 1,019 ms | 0 | 372.17 MB | 95 |

¹ best-practices was not scored on those cells (Lighthouse document-gatherer error), not a failing score.

### Both runs (evidence of variance)

| Run | Perf | LCP | TBT | Byte weight |
|---|---:|---:|---:|---:|
| home mobile 1 | 0.67 | 7,240 ms | 189 ms | 14.49 MB |
| home mobile 2 | 0.70 | 7,257 ms | 0 ms | 14.49 MB |
| home desktop 1 | 0.93 | 1,646 ms | 8 ms | 14.49 MB |
| home desktop 2 | 0.93 | 1,611 ms | 28 ms | 14.49 MB |
| gallery mobile 1 | 0.59 | 138,126 ms | 388 ms | 32.68 MB |
| gallery mobile 2 | 0.49 | 148,809 ms | 830 ms | 32.45 MB |
| gallery desktop 1 | — | — | — | failed twice: `Runtime.evaluate: Execution context was destroyed` |
| gallery desktop 2 | 0.71 | 28,480 ms | 145 ms | 38.01 MB |
| film mobile 1 | 0.37 | 116,698 ms | 6,131 ms | 329.97 MB |
| film mobile 2 | 0.37 | 113,121 ms | 7,736 ms | 320.18 MB |
| film desktop 1 | 0.67 | 1,240 ms | 1,019 ms | 372.17 MB |
| film desktop 2 | 0.48 | 18,741 ms | 695 ms | 162.21 MB |

Notable, and load-bearing for the rebuild's performance budgets: film transfers **162–372 MB in a
single page load** (video), gallery transfers 32–38 MB, home 14.5 MB; mobile LCP on gallery/film is
in the 113–149 s range under Lighthouse's simulated Slow-4G. Accessibility is already strong
(0.92–1.00), SEO is 1.00 everywhere, and the only measurable layout shift is gallery desktop CLS
0.047. Treat these as *regression ceilings*: a rebuild that is slower than this is a regression,
but these numbers are not a quality target.

## Gates and timings (measured once each, final capture)

| Gate | Command | Result | Wall time |
|---|---|---|---:|
| Typecheck (TS7) | `npx tsc --noEmit` | 0 errors | 2.6 s |
| Typecheck (TS6 compat) | `npx tsc6 --noEmit` | 0 errors | 15.5 s |
| Lint | `npm run lint` | **exit 0, 0 problems** | 22.9 s |
| Unit tests | `npm run test:run` | 42 files / **346 tests passed** (Vitest duration 10.54 s) | 11.5 s |
| Coverage | `npx vitest run --coverage --coverage.reporter=json-summary --coverage.reporter=text-summary` | exit 0 | 13.0 s |

Wall-time variance warning: these commands were captured four times while other agents ran
browser/Docker workloads; observed ranges were typecheck 2.6–8.0 s, tsc6 15.5–25.1 s, lint
22.9–43.0 s, unit 11.5–22.0 s, coverage 13.0–26.6 s. The committed `metrics.json` holds the final
(least-contended) capture. Coverage percentages were identical across every run.

Coverage totals (V8 provider, jsdom; `coverage-summary.json` contains 128 files — 123 under `src/`,
of which 115 have at least one covered line; Vitest only instruments files the tests import, so this
is not a share of the 337 src files):

| Metric | Covered / Total | % |
|---|---:|---:|
| Lines | 1,817 / 3,510 | **51.76%** |
| Statements | 1,928 / 3,865 | 49.88% |
| Functions | 511 / 1,133 | 45.10% |
| Branches | 916 / 2,420 | **37.85%** |

Lint note: the committed capture ran `npm run lint` (ESLint 9 flat config, whole repo) → **exit 0,
0 problems**. Earlier capture iterations transiently failed with 3 errors, all in another owner's
`tools/parity/*.mjs` work-in-progress files; the legacy-only scope was already clean then
(`npx eslint src scripts tests` → exit 0, 0 problems, measured). No legacy file was touched.

Vitest output also flags a DX cost and a future-config break: the jsdom environment dominates test
time (62–66% of tracked time across captures; 42 environment creations, one per test file), and
`vitest.config.js` uses `__dirname`, which Vite's future `configLoader: 'native'` drops.

## End-to-end suite (documented, not measured)

WP-6 forbids running the Playwright suites (Lead-owned heavy command). Quoted evidence:

- `.github/workflows/ci.yml:61-63`: *"full e2e suite takes 10+ min and is flaky on cross-browser
  matrix at PR-time"* — e2e is intentionally **not** in the PR gate.
- `playwright.config.ts:19-26`: `fullyParallel: false`, one worker in CI, `retries: 0`, 60 s
  per-test timeout; `playwright.config.ts:48-53` rebuilds and previews the app in `webServer`
  (180 s startup timeout).
- `package.json:63-64`: `test:e2e:public` gates 10 spec files, `test:e2e:admin` 5 more;
  `tests/e2e/` contains 18 specs total.

**Documented full-suite duration: 10+ minutes** on one CI worker; the gated public subset duration
is not documented anywhere in the repo.

## Not measured / known gaps

- `npm run build` wall time is Lead-provided (`20.2 s`), not independently measured (WP-6 forbids).
- No e2e duration measurement (see above); no browser-matrix timing.
- Lighthouse `best-practices` unscoreable on 3 cells (documented above); one cell failed both runs.
- No field/RUM data (real-user LCP/INP/CLS), no WebPageTest, no CI-run Lighthouse baseline here.
- Network/CPU variance is real: film byte weight ranged 162–372 MB between two runs; treat single
  runs as noisy and compare distribution/medians in later waves.
- `npm run format:check` and `npm run verify:release` were not run as part of WP-6 (not baseline
  metrics; CI covers them).

## Reproducing every number

```bash
# code inventory (deterministic; compare with git diff if inventory.json were tracked)
node tools/inventory/capture.mjs

# bundle + gate timings + coverage + embedded Lighthouse summary -> metrics.json
node tools/baseline/capture.mjs

# live Lighthouse (12 runs, ~15 min on a contended machine) then re-run capture to embed it
node tools/baseline/lighthouse.mjs
node tools/baseline/capture.mjs

# coverage alone
node tools/baseline/coverage.mjs

# validate the committed contract + freeze
node tools/verify-contracts.mjs --allow-missing
node tools/check-legacy-freeze.mjs
```

Re-running each command must reproduce the same *shape*; timestamps, Lighthouse measurement values
and wall times legitimately differ between runs on a contended machine.
