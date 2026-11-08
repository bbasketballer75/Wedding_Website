# A6 — Quality, performance and DX audit (measured baseline)

Read-only audit of the frozen legacy app (`legacy-freeze-2026-11-08` / `dd0cf48`), produced from the
measured artefacts in [`../BASELINE.md`](../BASELINE.md) and `contracts/baseline/*`. Every claim has a
path, a command, or a measured number attached. Architecture (A1) and toolchain detail (A2) are those
documents' scope; this one records the quality/performance/DX consequences the rebuild must budget for.

Method/tooling: `node tools/inventory/capture.mjs`, `node tools/baseline/capture.mjs`,
`node tools/baseline/lighthouse.mjs`, `node tools/baseline/coverage.mjs` at the frozen commit; live
Lighthouse against `https://www.theporadas.com` (read-only). Machine was contended by other agents
(see BASELINE.md measurement conditions).

## 1. Media weight is the dominant product cost

Measured with `Get-ChildItem public -Recurse -File | Measure-Object Length -Sum` (and the same for
`dist/`), at the frozen commit:

| Location | Files | Bytes | Human |
|---|---:|---:|---:|
| `public/` (all local media) | 624 | 3,794,242,006 | **3.53 GiB / 3.79 GB** |
| `public/video/` | 14 | 3,104,823,136 | 2.89 GiB |
| `public/background_audio/` | 22 | 527,649,160 | 479.9 MiB |
| `public/images/` | 542 | 146,067,823 | 139.3 MiB |
| `public/media/` | 22 | 15,477,829 | 14.8 MiB |
| `dist/` (production build) | 640 | 148,717,076 | 141.8 MiB |

Findings/evidence:

- **Only 566 of the 624 public files are git-tracked** (`git ls-files public | Measure-Object` =
  566); video and background audio are gitignored (`.gitignore` `public/video/` etc.), so a fresh
  clone cannot build or serve the real film/audio without a separate media fetch. The build log
  proves the deploy path differs: `VITE_MEDIA_BASE_URL` made `scripts/prune-local-media.js` delete
  `dist/video`, `dist/background_audio`, `dist/media` before upload — `dist/` contains none of them.
- **`dist/` is 98.2% images**: 146,067,823 of 148,717,076 bytes. Every Netlify build copies the
  entire 139 MiB image tree through `scripts/copy-public-images.js` (postbuild), then uploads it.
  This is ~8 s of the measured 20.2 s build and the bulk of deploy artefact size.
- Measured Lighthouse transfer confirms the same cost on real routes: home **14.49 MB**, gallery
  **32.68–38.01 MB**, film **162.21–372.17 MB** per page load (Lighthouse network requests,
  2 runs/cell). The film page alone streams more than the entire public image library.
- Consequence for rebuild: media handling (CDN URLs, responsive image sets, poster/stream strategy,
  range requests, per-route byte budgets) is a first-class deliverable, not a cleanup task. The
  "cheap to host" invariant in `PRODUCT_CONTRACT.md` cannot hold if deploys keep copying 139 MiB
  and pages transfer 14–372 MB.

## 2. Performance baseline (Lighthouse, production)

Selected-of-two results (`metrics.json → lighthouse.pages`; full table in BASELINE.md):

| Page | Profile | Perf | LCP | TBT | Transfer |
|---|---|---:|---:|---:|---:|
| `/` | mobile | 0.70 | 7,257 ms | 0 ms | 14.49 MB |
| `/` | desktop | 0.93 | 1,611 ms | 28 ms | 14.49 MB |
| `/gallery` | mobile | 0.59 | 138,126 ms | 388 ms | 32.68 MB |
| `/gallery` | desktop | 0.71 | 28,480 ms | 145 ms | 38.01 MB |
| `/film` | mobile | **0.37** | **113,121 ms** | **7,736 ms** | **320.18 MB** |
| `/film` | desktop | 0.67 | 1,240 ms | 1,019 ms | 372.17 MB |

- Accessibility is already strong (0.92–1.00 on all 11 successful runs); SEO is 1.00 everywhere.
  The rebuild's a11y/SEO work is about *not regressing*, while performance has large real headroom
  to gain but is currently far below any reasonable budget (mobile perf 0.37–0.70).
- Layout shift is not a current problem: CLS 0 everywhere except gallery desktop 0.0475.
- **Measurement caveats that should never be dropped when quoting these numbers**: 11/12 runs
  succeeded (gallery desktop run 1 failed twice with Lighthouse `Runtime.evaluate: Execution context
  was destroyed`); `best-practices` was unscoreable on home desktop ×2 and film desktop run 1
  (documented gatherer error); film transfer varied 162→372 MB between the two runs, so single-run
  comparisons are noise. Raw LHRs are under `contracts/baseline/lighthouse/`.

## 3. Bundle shape

From `dist/` at the frozen commit (`node tools/baseline/capture.mjs`):

- JS 1,610,085 B raw → **470.41 KiB gzip**; CSS 251,614 B → 33.50 KiB gzip; fonts 555,624 B
  (22 files = woff+woff2 pairs for 3 families). Entry graph: 1 script + 7 modulepreloads + 1
  stylesheet (`index.html`), no inline scripts.
- The initial-load graph is heavy for an archive site: 9 files / **277.88 KiB gzip** (284,549 B)
  before first render, with `vendor-react` 65.5 KiB gz + `index` 66.4 KiB gz + `app-supabase`
  58.8 KiB gz + `vendor-motion` 45.1 KiB gz all on the preload path
  (`metrics.json → bundle.initialPayload`). `framer-motion` is imported by 103 source modules
  (`inventory.json → importGraph.topPackages`) and accounts for a dedicated 141 KB chunk.
- Manual chunking (`vite.config.js:322-330`) only special-cases 6 vendor families + `app-supabase`;
  everything else falls to per-entry lazy chunks. There is **no bundle budget gate** in CI
  (`chunkSizeWarningLimit: 500` at `vite.config.js:345` is a warning only).
- Terser drops console/debugger in production (`vite.config.js:351-357`); PWA precaches the whole
  built payload (63 entries / 1,800.52 KiB JS+CSS+HTML; 1,956.82 KiB including icons) —
  the precache itself is part of the offline cost budget.

## 4. Code inventory: duplication and vestiges

`node tools/inventory/capture.mjs` → `contracts/baseline/inventory.json`.

- 337 `.ts/.tsx` files / 51,877 physical lines (46,867 non-blank) under `src/**`; 42 of those
  files are tests (5,633 lines = 10.9% of ts/tsx lines).
- **57 zero-inbound files / 7,735 lines** (≈16.6% of production ts/tsx lines, 46,603) plus **6
  test-only modules** (735 lines) and **2 stray files** (`src/pages/Gallery.tsx.bak` 451 lines,
  `src/routes/.eslintrc.js`). Largest dead files: `workers/media-rewrite/index.ts` 693,
  `components/search/Search.tsx` 439, `components/timeline/HalloweenEngagement.tsx` 329,
  `components/gallery/MapView.tsx` 327, `components/gallery/PhotoGrid.tsx` 318,
  `services/galleryService.ts` 300. A rebuild that ports "everything" reintroduces ~8.5k lines of
  dead weight; the list is the delete-before-port checklist.
- **9 of 12 `index.ts` barrels have zero production inbound imports** — the barrel layer is mostly
  ceremony (`components/{activity,layout,ui,video}`, `composables`, `hooks`, `pages`, `validators`).
  Only `themes`, `types`, `stores` are actually imported as barrels.
- Named duplicate families with measured cross-coupling:
  `lib/utils.ts` vs `utils/` (24 files / 3,476 lines / 5 cross-imports);
  `composables/` vs `hooks/` (26 files / 2,455 lines / **16 cross-imports** / 10 shared exported
  symbols); `design-system/` vs `tokens/` vs `themes/` (4 files / 791 lines / 4 shared symbols);
  `context/` vs `providers/` (4 files / 203 lines); two `GalleryHeader.tsx` components (162 lines).
  124 exported symbol names are declared by ≥2 non-test modules. These are not "code smells" in the
  abstract: they are the places where a rebuild can accidentally keep two parallel implementations
  alive (parity would then force both to be maintained).
- Largest complexity concentrations (lines): `types/supabase.generated.ts` 1,081,
  `timeline/LoveTimeline.tsx` 918, `index.css` 805, `photo-viewer/PhotoLightbox.tsx` 773,
  `stores/mediaReviewStore.ts` 753, `data/curated-photos.ts` 696, `workers/media-rewrite/index.ts`
  693 (dead), `admin/AlbumOrganizer.tsx` 575, `pages/Film.tsx` 570, `pages/GuestShare.tsx` 549.

## 5. Dependency surface

`inventory.json → dependencies` (91 declared = 62 `dependencies` + 29 `devDependencies`):

- **17 declared packages have no import site and no tool/config mention**: `@sentry/browser`
  (only `@sentry/react` used), all five `@radix-ui/react-*` primitives, `web-vitals`,
  `react-masonry-css` (gallery uses `@tanstack/react-virtual`), both TensorFlow packages,
  `@vladmandic/human`, 3 of 6 `@fontsource` families, `@vitest/coverage-v8` (used via CLI),
  `@vitest/ui`, and `husky` (no `prepare` script installs hooks on a fresh clone).
- **6 undeclared direct imports** rely on hoisting: `@radix-ui/react-slot` (used by
  `src/components/ui/Button.tsx`), `workbox-window` (`src/utils/serviceWorker.ts`), `playwright`
  (`tools/parity/capture.mjs`; only `@playwright/test` is declared), `pg` and `tus-js-client`
  (scripts), `@netlify/functions` (Netlify-provided). Any lockfile bump can break these silently.
- **5 section mismatches**: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `tailwindcss`,
  `@tailwindcss/vite` sit in `dependencies` but are Node/build-only; `exifr` sits in
  `devDependencies` but ships in the browser bundle (`PhotoLightbox.tsx`).
- Duplicate/overlapping bets: two Sentry entry points, two gallery-grid strategies, two TypeScript
  compilers, two ML stacks, three minifiers/CSS processors (`terser`, `csso`), six font packages
  only three of which load. Each is a decision the rebuild must take exactly once.

## 6. Test and coverage shape

`npx vitest run --coverage --coverage.reporter=json-summary --coverage.reporter=text-summary`
(42 test files / 346 tests / jsdom, no config edits):

| Metric | Covered / Total | % |
|---|---:|---:|
| Lines | 1,817 / 3,510 | 51.76% |
| Statements | 1,928 / 3,865 | 49.88% |
| Functions | 511 / 1,133 | 45.10% |
| Branches | 916 / 2,420 | **37.85%** |

- Branch coverage is 14 points below line coverage: tests exercise happy paths, not the many
  gallery/upload/moderation states the product contract must preserve.
- Only 128 files were instrumented at all (123 under `src/`, 115 with ≥1 covered line) — the suite
  imports a small fraction of the 337 `src` ts/tsx files, and Vitest's default coverage only
  instruments what the tests touch, so this is not even a file-level denominator.
- **No coverage thresholds** exist (`vitest.config.js:19-23` has reporters only), and **CI never runs
  coverage** (`ci.yml` runs `npm run test:run`, not `test:coverage`) — coverage can rot invisibly.
- The suite also pays a known environment tax: jsdom creates one environment per test file (42
  creations) and accounts for 62–66% of tracked time across captures; Vitest's own output suggests
  `pool: 'vmThreads'` or `isolate: false` (measured in `metrics.json → gates.unit.outputTail`).
  10.5–12.2 s Vitest duration vs 11.5–13.1 s wall is acceptable now but scales badly.
- E2E is deliberately out of the PR gate ("10+ min and flaky on cross-browser matrix",
  `ci.yml:61-63`) — so the only browser-level coverage lives in nightly/manual workflows.

## 7. CI gate gaps (what can regress without a red PR)

Legacy PR gate = `lint`, `format:check`, `tsc`, `tsc6`, `test:run`, `build` (`.github/workflows/ci.yml`).
Gaps, with evidence:

- **No e2e / a11y / parity on PR**: `ci.yml:61-63` says e2e is intentionally excluded; parity lives in
  `.github/workflows/rebuild.yml` on schedule/dispatch/label only; axe checks exist in
  `tests/e2e/a11y.spec.ts`/`admin-a11y.spec.ts` (not gated).
- **Lighthouse is advisory only**: `.github/workflows/lighthouse-ci.yml:32-36` sets
  `continue-on-error: true` and the job is not in branch protection; `.lighthouserc.cjs` makes
  performance/best-practices/SEO warnings (`minScore` 0.6/0.8/0.9) and only accessibility an error —
  and it runs 1 run against a local preview (`numberOfRuns: 1`), not the deployed site.
- **No bundle-size budget**, no `size-limit`/visualizer gate (`ANALYZE` is opt-in,
  `vite.config.js:283-289`); no image-weight gate; no dependency-size regression check.
- **No coverage gate**, no flaky-test quarantine, no cross-browser matrix in PR.
- **Visual regression is nightly-only against production**, explicitly because it is "too slow +
  flaky (real CDN images, real Supabase timing)" (`.github/workflows/visual-prod.yml:8-12`).
- Stale label: `ci.yml:31` names the step "Setup Node 20" but installs `node-version: '22'` — the
  workflow drifts from its own text.

For the rebuild, the gate that matters is the *inverse*: every one of the above is a measurement the
new CI must gate on (bundle budget, image budget, route-level Lighthouse, coverage floor, a11y sweep)
because the parity contract says "performance never regresses" and the legacy CI cannot enforce it.

## 8. Node / npm / TypeScript drift

- Runtime floor vs reality: `package.json engines.node >=22.19.0`; `.nvmrc` = `22`; CI and Netlify
  pin 22; the machine that produced this baseline runs **Node v26.8.1**. Developing/testing on 26
  and deploying to 22 hides use of newer APIs until deploy (or the reverse for warnings).
- Package manager drift: `packageManager: npm@11.11.0` and `netlify.toml NPM_VERSION="11.11.0"`, the
  baseline machine runs **npm 11.19.0**. Lockfile regeneration noise/`npm ci` differences are latent.
- Two TypeScript compilers are installed via npm aliases: `typescript@npm:@typescript/typescript6@6.0.2`
  (binary `tsc6`) and `@typescript/native@npm:typescript@7.0.2` (binary `tsc`, the default
  `npx tsc`). `ci.yml` type-checks with **both** (`tsc` and `tsc6` steps). Measured: `npx tsc
  --noEmit` = 0 errors (final 2.6 s; 2.6–8.0 s across contended captures); `npx tsc6 --noEmit` =
  0 errors (final 15.5 s; 15.5–25.1 s across captures).
- `tsconfig.json` uses `target: ES2020`, `allowJs`, `checkJs: false`, and includes `scripts/**` and
  `tests/**`; the JS configs (`vite.config.js`, `vitest.config.js`) sit outside the TS graph.
  Vite 8 warns that `vitest.config.js`'s `__dirname` breaks the future `configLoader: 'native'`
  (`metrics.json → gates.unit.outputTail`) — a cheap fix with a known deadline.
- Vite 8/rolldown-era overrides (`package.json:194-203`) pin `@rolldown/binding-*` and
  `@rollup/plugin-terser`; the dist includes a `rolldown-runtime` chunk. The rebuild should decide
  whether it inherits this tooling at all rather than carrying the override list forward.

## 9. Flaky-visual and measurement risks (plan for these, do not rediscover them)

1. **Visual snapshots run against volatile data.** `playwright.config.visual.ts` uses the real dev
   server with real Supabase data; `playwright.config.visual-prod.ts` runs against live production
   (`baseURL: https://www.theporadas.com`). Gallery/guestbook content changes when guests upload or
   admins moderate, so snapshots can fail for reasons unrelated to code. Both configs set
   `maxDiffPixelRatio: 0.03` (3% of pixels) — a tolerance wide enough to hide real visual regressions.
2. **Headless video hacks.** The visual configs pause/hide videos because headless Chromium
   composites the background video as black (`playwright.config.visual.ts` header comment). Any
   rebuild parity harness inherits this class of hack; the frozen parity harness must pin one stub
   media asset instead of real video.
3. **Service worker + autoUpdate** (`vite.config.js:217-282`) can claim clients mid-session; the
   parity harness must block the SW for deterministic screenshots (the plan already says so).
4. **Lighthouse itself is flaky on a contended machine**: 1 of 12 cells failed twice
   (`Runtime.evaluate: Execution context was destroyed`), 3 runs could not score best-practices
   (document-gatherer error), film byte weight varied 162→372 MB between runs. A single-run
   performance gate will produce false alarms; use medians/multiple runs and record failures.
5. **No retries** in any Playwright config (`retries: 0` in `playwright.config.ts` and both visual
   configs), so a transient CDN/Supabase hiccup fails the nightly job with no recovery.
6. **E2E rebuilds the app on every invocation** (`playwright.config.ts:48-53`) and the full suite is
   documented as 10+ minutes/flaky, which is exactly why it was removed from the PR gate — the
   replacement gate must be faster (route subset + parity), not merely re-enabled.

## 10. Prioritized recommendations for the rebuild

**P0 — treat as budget/exit criteria**

1. Per-route byte and weight budgets in the greenfield CI (initial JS gzip, image bytes, film page
   streamed bytes) derived from this baseline, enforced on every PR.
2. Media plan before wave 1 UI work: CDN/R2 URLs, responsive `srcset` sizes, film streaming strategy
   (range requests / segmented renditions), poster-first LCP. The measured 14–372 MB per page and
   3.53 GiB origin are the largest product-level cost.
3. Delete-before-port list from `inventory.json → deadCode` (57 files / 7,735 lines) and decide each
   duplicate family once (design-system/tokens/themes, composables/hooks, context/providers,
   two GalleryHeaders) — never port both sides of a duplicate.
4. Coverage floor + coverage in CI (raise branches first); add the existing e2e specs to at least a
   nightly gate with retries so browser-level regressions cannot land silently.

**P1 — quality/DX wins**

5. Dependency decision table: drop the 17 unused packages, declare the 5 phantom imports, fix the 5
   section mismatches, pick one of each overlap pair (bundle savings are direct: Radix set, Sentry
   browser, tfjs/human, font packages, masonry libs).
6. Replace the 3% pixel tolerance in visual tests with a much tighter one once the parity harness
   controls media/data; add `retries: 1` to nightly visual jobs.
7. Fix `npx vitest` environment overhead (`pool: 'vmThreads'`/`isolate: false`) and replace
   `__dirname` in `vitest.config.js` before Vite's native config loader lands.
8. Pin the same Node/npm everywhere (CI 22 / Netlify 22 / `.nvmrc` 22 vs local 26.8.1 / npm
   11.19.0) or add an explicit "supported Node" range check so drift fails fast.
9. Make Lighthouse a required PR job with multiple runs or medians, and add axe route coverage to
   the PR gate.

**P2 — hygiene**

10. Remove `src/pages/Gallery.tsx.bak` and `src/routes/.eslintrc.js`; add a `prepare` script if husky
    hooks are meant to install on fresh clones; document the `@typescript/native`/`typescript` dual
    alias so nobody "fixes" one of them.
11. Keep the baseline artefacts reproducible: re-run `node tools/baseline/capture.mjs` after each
    intentional change and diff `metrics.json` shapes, not values.

## 11. Open questions for the owner (only genuinely owner-owned decisions)

1. Media end-state: keep 3.5 GiB of originals in the archive (and pay egress/CDN), or define a
   retention/download policy? The "no media loss" invariant requires the bytes to exist somewhere
   the owner can export.
2. Is the film page allowed to stream 100+ MB, or must it move to a lighter rendition ladder? This
   is a product-quality decision (video fidelity) with a hard performance cost.
3. Are the duplicate families (design-system/tokens/themes, composables/hooks) allowed to be
   collapsed for parity purposes, or does "pixel parity" require keeping the live code paths
   byte-for-byte until cutover? (Affects how much dead code may be deleted before parity gates.)
