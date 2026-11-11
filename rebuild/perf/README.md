# Performance budgets & media delivery (Wave 8 W8-2)

Everything here is scoped to the greenfield app in `rebuild/`. The Lead owns builds:
these tools **never run `vite build`** — they measure a build the Lead produced.

| Tool                  | File                                   | What it does                                                                                                                  |
| --------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Budget gate           | `scripts/check-budgets.mjs`            | Measures `rebuild/dist` (gzip/brotli, initial vs lazy) and enforces QUALITY_BAR budgets.                                      |
| Budget baseline       | `perf/budgets.baseline.json`           | Recorded targets + measurements of a known build, so regressions are distinguishable from fixed-target misses.                |
| Media pipeline        | `scripts/media-optimize.mjs`           | Plans / checks / generates AVIF+WebP+JPEG derivatives at the frozen breakpoint widths.                                        |
| Pipeline config       | `perf/media.config.json`               | Widths, formats, quality, source/output paths, approved include scopes.                                                       |
| Delivery helpers      | `src/shared/media/responsive-image.ts` | Manifest → `srcset`/`sizes`, CDN fallback rules, blurhash placeholder decode.                                                 |
| Manifest types/parser | `src/shared/media/media-manifest.ts`   | JSON-free manifest types + runtime validation (imported by the Node scripts too).                                             |
| Pipeline helpers      | `src/shared/media/media-pipeline.ts`   | Raster header parsing, deterministic naming, planning, manifest serialisation.                                                |
| Budget helpers        | `src/shared/media/build-budget.ts`     | HTML reference parsing, chunk classification, verdicts, baseline (de)serialisation.                                           |
| Delivery component    | `src/shared/ui/OptimizedImage.tsx`     | `<picture>` AVIF/WebP/JPEG srcsets, sizes, aspect ratio, dominant-colour/blurhash placeholders, lazy/eager + `fetchpriority`. |

Both `.mjs` scripts import the `.ts` helpers directly. Node type stripping (default on
Node ≥22.19, which `rebuild/package.json` already requires) makes this work without a
build step. Scripts never import the generated manifest JSON, so Node's JSON import
attributes restriction does not apply.

## 1. Measured budgets (parity build, 2026-11-09)

Qualitative targets from `docs/rebuild/QUALITY_BAR.md` §Performance, measured with
`node scripts/check-budgets.mjs` (gzip level 9 over the raw emitted files):

| Metric                                      | QUALITY_BAR target            | Measured (`rebuild/dist`)                                                                  | Verdict                  |
| ------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------ | ------------------------ |
| Initial JS (entry + `modulepreload` chunks) | ≤ 180 KiB gz                  | **164.4 KiB**                                                                              | PASS (15.6 KiB headroom) |
| Largest route/lazy chunk                    | ≤ 120 KiB gz                  | **76.2 KiB** (`schema-*.js`, shared zod admin chunk; largest actual route `film` 20.1 KiB) | PASS                     |
| Total JS                                    | ≤ 450 KiB gz                  | **392.7 KiB**                                                                              | PASS (57.3 KiB headroom) |
| Initial CSS (tracked, no hard bar yet)      | ≤ 40 KiB gz (regression gate) | **27.1 KiB**                                                                               | PASS                     |

Build context for the baseline: Lead parity build in `rebuild/dist` (entry
`index-BzRrtMJO.js`, 20 initial JS files, 60+ emitted chunks), baseline captured in
`perf/budgets.baseline.json`. The build is being rebuilt by the Lead during Wave 8, so
re-measured values drift by a few KiB between builds — always re-run the gate against
the actual `dist`; refresh the baseline with `--write-baseline` after an intentional
change. Regression comparison uses aggregate metrics and per-route lazy sums, not
hashed file names, so it survives normal rebuilds.

### Initial JS chunks (the full first-paint graph)

| Chunk                                                                                                         | gzip           | Kind                 |
| ------------------------------------------------------------------------------------------------------------- | -------------- | -------------------- |
| `index-*.js`                                                                                                  | 77.1 KiB       | entry                |
| `createLucideIcon-*.js`                                                                                       | 63.0 KiB       | shared modulepreload |
| `cn-*.js`                                                                                                     | 8.4 KiB        | shared modulepreload |
| `query-*.js`                                                                                                  | 5.2 KiB        | modulepreload        |
| `AnimatePresence-*.js`                                                                                        | 1.9 KiB        | modulepreload        |
| `Button-*.js`                                                                                                 | 1.7 KiB        | modulepreload        |
| `play-*.js`                                                                                                   | 1.5 KiB        | modulepreload        |
| `ThemeToggle-*.js`, `useRouterState-*.js`                                                                     | 1.1 KiB each   | modulepreload        |
| `usePageMeta`, `PageLoader`, `publicNav`, `RouteErrorBoundary`                                                | ≤ 0.7 KiB each | modulepreload        |
| icon/vendor leaf chunks (`images`, `book-heart`, `printer`, `heart`, `arrow-left`, `x`, `use-reduced-motion`) | ≤ 0.3 KiB each | modulepreload        |
| **Σ initial**                                                                                                 | **164.4 KiB**  | 20 files             |

`createLucideIcon` (63.0 KiB gz) is the dominant non-entry cost: it is the shared icon
factory chunk required by the eager shell. If the initial budget ever tightens, the
first lever is importing only the shell's icons through per-icon deep imports so the
full icon module chunk stays lazy (Lead/`vite.config.ts` + shell scope decision).

### Largest lazy/route chunks

| Chunk                  | Route label                                  | gzip     |
| ---------------------- | -------------------------------------------- | -------- |
| `schema-*.js`          | shared (zod validation used by admin/upload) | 76.2 KiB |
| `admin-routes-*.js`    | `/admin/*`                                   | 37.1 KiB |
| `film-*.js`            | `/film`                                      | 20.1 KiB |
| `home-*.js`            | `/`                                          | 19.4 KiB |
| `gallery-route-*.js`   | `/gallery`                                   | 14.0 KiB |
| `UploadPage-*.js`      | `/upload`                                    | 12.1 KiB |
| `guestbook-route-*.js` | `/guestbook`                                 | 9.5 KiB  |
| `guest-share-*.js`     | `/guest/:token`                              | 6.4 KiB  |
| `mediaReview-*.js`     | shared (admin media review)                  | 5.6 KiB  |
| `ui-*.js`              | shared UI primitives                         | 4.5 KiB  |
| `activity-route-*.js`  | `/activity`                                  | 4.3 KiB  |
| `PrintPage-*.js`       | `/print`                                     | 3.5 KiB  |

Remaining chunks are ≤ 3.5 KiB (guest-photos, vendor/icon splits, hooks, etc.).

## 2. Running the budget gate

```bash
cd rebuild

# Strict QUALITY_BAR targets (fails now only if something regressed past a target)
node scripts/check-budgets.mjs

# CI mode while optimising: fail only on regressions vs the recorded baseline
node scripts/check-budgets.mjs --mode baseline

# Machine-readable report + artifact for CI
node scripts/check-budgets.mjs --mode strict --json --report-json perf/last-budget-report.json

# Refresh the documented baseline after an intentional build change
node scripts/check-budgets.mjs --write-baseline --documented-at 2026-11-09
```

Options: `--dist <dir>` (default `rebuild/dist`), `--baseline <file>`,
`--manifest <dist/.vite/manifest.json>` (precise initial-javascript closure once the
Lead enables `build.manifest: true` in `vite.config.ts`), `--mode strict|baseline`,
`--json`, `--report-json <file>`, `--write-baseline`, `--note <text>` (repeatable).

Exit codes: `0` pass, `1` budget/regression failure, `2` usage/IO error (e.g. no build
present). Suggested `package.json` scripts (Lead owns `package.json`):

```json
"perf:budgets": "node scripts/check-budgets.mjs",
"perf:budgets:ci": "node scripts/check-budgets.mjs --mode baseline --json --report-json perf/last-budget-report.json",
"perf:baseline": "node scripts/check-budgets.mjs --write-baseline"
```

Suggested CI step once Wave 8 lands (GitHub/Netlify build hook):

```yaml
- run: npm run build
  working-directory: rebuild
- run: node scripts/check-budgets.mjs --mode strict --report-json perf/last-budget-report.json
  working-directory: rebuild
```

Gating policy recommendation: keep CI on `--mode baseline` until the Lead confirms the
initial-payload shape is final, then switch to `--mode strict` (targets already pass on
the current build, so strict can be enabled immediately if desired).

## 3. Media pipeline

### 3.1 Where the widths come from (frozen evidence)

| Frozen source                                          | Value                                                                  | Used for                        |
| ------------------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------- |
| `contracts/ui.json` breakpoints                        | 768 / 1024 / 1280 / 1536                                               | layout tiers                    |
| frozen `OptimizedImage.tsx` `ResponsiveImage` defaults | 640×480, 768×576, 1024×768, 1280×960                                   | 640/768/1024/1280 widths        |
| frozen Home hero poster                                | `w-[min(92vw,72rem)]` (≤1152 CSS px)                                   | 1024/1152/1600 widths           |
| frozen engagement cards                                | `min-w-[220px] h-[280px]`, `<OptimizedImage width={220} height={280}>` | 480/640 widths (DPR-2)          |
| frozen gallery grid                                    | 2 cols <768px, 3 cols ≥768px, 4 cols ≥1024px                           | `sizes` presets + 320/480 tiles |

Configured derivative widths: **320, 480, 640, 768, 1024, 1280, 1600, 1920** (never
upscaled — sources narrower than a tier skip it and keep their own width tier).
Quality: AVIF 55, WebP 80, JPEG 82 (mozjpeg, progressive). Unknown/unsupported bytes are
rejected by the header parser; SVG/ICO are out of scope.

`sizes` presets exported from `src/shared/media/responsive-image.ts`:

| Preset           | Value                                                     | Frozen layout          |
| ---------------- | --------------------------------------------------------- | ---------------------- |
| `galleryGrid`    | `(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw` | frozen gallery columns |
| `engagementCard` | `220px`                                                   | frozen card            |
| `heroPoster`     | `(min-width: 768px) min(92vw, 72rem), 100vw`              | frozen hero            |
| `lightbox`       | `90vw`                                                    | frozen viewer          |
| `thumbnail`      | `160px`                                                   | frozen masonry thumbs  |

### 3.2 Output contract

- Sources stay read-only in `../public/images/**` (legacy checkout).
- Derivatives are written to **`rebuild/public/images/optimized/`** and are part of the
  deploy: no symlinks, no copies of the unprocessed sources.
- Deterministic naming: `home/intro-video-poster.png` →
  `/images/optimized/home-intro-video-poster-<width>.<avif|webp|jpg>`.
- Manifest: `src/shared/media/media-manifest.json` maps the original public path to
  dimensions, aspect ratio, dominant colour, source hash, encoding-config hash and every
  derivative's path/bytes/sha256. `OptimizedImage` consumes it; TS code imports it via
  Vite JSON support, scripts parse it through `media-manifest.ts` (JSON-free).
- `--check` fails when a derivative is missing or when its bytes/sha256 no longer match
  the manifest, when a source changed, or when the encoding config changed
  (`configHash`). Pre-generation (empty manifest) it reports a warning and passes.

### 3.3 Commands

```bash
cd rebuild

# Enumerate sources + planned output (no sharp needed) — run this before approval
node scripts/media-optimize.mjs --plan
node scripts/media-optimize.mjs --plan --json > perf/media-plan.json

# Verify every manifest derivative exists and is current (no sharp needed)
node scripts/media-optimize.mjs --check

# Generate only an explicitly approved scope
node scripts/media-optimize.mjs --generate --all                 # whole configured scope
node scripts/media-optimize.mjs --generate --only home/,film/    # subset
node scripts/media-optimize.mjs --generate --from-contract ../contracts/content/MEDIA_MANIFEST.json

# Re-encode stale files / remove unreferenced derivatives
node scripts/media-optimize.mjs --generate --all --force
node scripts/media-optimize.mjs --generate --all --prune
```

`--plan`/`--check` parse PNG/JPEG/WebP headers and hash files only. `--generate` lazily
imports `sharp`; it needs the pinned devDependency (Lead owns installs):

```bash
cd rebuild
npm install --save-dev --save-exact sharp@0.35.5
```

`sharp@0.35.5` matches the frozen app's `^0.35.5` line and ships N-API prebuilds that
work on Node 22+/26 (no compile step expected; the Lead should confirm on the CI image).

### 3.4 Measured plan (before generation)

`node scripts/media-optimize.mjs --plan` against the legacy source tree with the
configured scope (`perf/media.config.json` `include`):

| Scope                                                                               | Sources | Source size  | Planned files (3 formats) | Estimated output                           |
| ----------------------------------------------------------------------------------- | ------- | ------------ | ------------------------- | ------------------------------------------ |
| Phase 1 — `home`, `film`, `couple`, `parents`, `parent-film-cards`, `wedding-party` | 30      | 44.3 MiB     | 582                       | ≈10.4 MiB (AVIF 2.0 / WebP 3.2 / JPEG 5.2) |
| Phase 2 — `engagement`                                                              | 35      | 6.6 MiB      | 768                       | ≈14.2 MiB (AVIF 2.7 / WebP 4.4 / JPEG 7.1) |
| **All configured**                                                                  | **65**  | **50.9 MiB** | **1,350**                 | **≈24.7 MiB**                              |

Estimates use a bits-per-pixel model (AVIF 0.10, WebP 0.16, JPEG 0.26 bpp) — the Lead
should treat them as sizing guidance, not committed bytes. Generation is **not** run
yet: it needs the sharp install plus approval of the committed output scope/cadence.
Recommendation: approve Phase 1 first (30 sources / 582 files, small repo delta),
validate the UI consumes the manifest, then Phase 2. `shared-gallery-new/` (≈88 MiB of
legacy curated-pool originals) is deliberately **not** in the configured scope until the
content contract references which of those are actually shown.

Planned approval commands:

```bash
cd rebuild
# after the Lead installs sharp@0.35.5
node scripts/media-optimize.mjs --generate --only home/,film/,couple/,parents/,parent-film-cards/,wedding-party/
node scripts/media-optimize.mjs --check
```

## 4. `OptimizedImage` delivery upgrades

Public API is backward compatible; all additions are optional:

```tsx
<OptimizedImage
  src='/images/home/intro-video-poster.png'
  alt='Austin and Jordyn'
  priority                    // eager + fetchpriority=high (LCP)
  sizes='heroPoster'          // or any CSS sizes string; defaults to 100vw
  aspectRatio={16 / 9}        // optional; manifest aspect ratio fills in when omitted
  placeholder='blur' | 'color' | 'empty'
  blurDataURL='/images/...'   // frozen inline blur
  blurHash='LEHV6nWB2yk8pyo0adR*.7kCMdnj' // dependency-free decoded CSS gradient
  dominantColor='#123456'     // overrides the manifest colour
  onLoad={...}
  onError={...}
/>
```

Behaviour:

1. **Manifest-responsive**: if `src` is a local `/images/**` raster with a manifest
   entry, renders `<picture><source type=image/avif …><source type=image/webp …><img
src=largest-jpeg srcSet=jpeg sizes=…>` with `width`/`height` from the manifest and the
   wrapper's `aspect-ratio` set to protect CLS.
2. **Graceful fallback**: absolute R2 URLs and `/media/**` CDN paths render a plain
   `<img>` with the URL untouched (no invented `?w=&q=` params — the CDN Worker path
   contract has no resizer). Local unmanifested rasters keep the frozen
   `?w=&q=` behaviour so oracle parity of the component is preserved.
3. **Placeholders**: manifest dominant colour by default; `blurDataURL` (frozen) and
   `blurHash` (decoded inline to a tiny CSS gradient) supported; `empty` keeps the
   frozen skeleton.
4. **Lazy strategy**: `priority` → `loading="eager"` + `fetchpriority="high"`;
   otherwise IntersectionObserver reveal (frozen behaviour) + `loading="lazy"` +
   `fetchpriority="auto"`; `decoding="async"` by default (overridable).
5. `ResponsiveImage` now uses the manifest's AVIF/WebP/JPEG srcsets when available and
   keeps the frozen breakpoint/query behaviour otherwise.

Adoption note: no feature currently imports `OptimizedImage` (verified before this
wave), so nothing changes visually until a feature opts in. The media pipeline is
independent of adoption: generate derivatives, then swap `<img>` for
`<OptimizedImage sizes='galleryGrid' …>` in the gallery/home/film features (feature
scopes belong to the shell/Lead waves).

## 5. Lazy media + preload hints (for the Lead / W8-1)

Strategy:

- LCP element (`/` hero poster): `priority` on `OptimizedImage`, no manual
  IntersectionObserver; preload one candidate in `index.html`.
- Film poster (`/film`): `priority` inside the route; **do not** add a global
  `index.html` preload — the 2 MiB source would download on every route. Let the route
  chunk + eager image do the work.
- Gallery/engagement tiles below the fold: default lazy path (`loading='lazy'`,
  `fetchpriority='auto'`), no preload.
- Fonts: `@fontsource` woff2 files are hashed by Vite, so preload them via a small
  `transformIndexHtml` plugin (below) rather than hand-editing `index.html` with
  unstable names; `<link rel="modulepreload">` is emitted automatically by Vite — do
  not duplicate it.
- `index.html` must keep the entry `<script type="module">` + automatic
  `modulepreload` tags; `check-budgets.mjs` derives the initial JS set from exactly those
  tags, so any hand-added tag counts toward the budget.

Exact `index.html` snippet for the hero (static file, current fallback path):

```html
<link
  rel="preload"
  as="image"
  href="/images/home/intro-video-poster.png"
  type="image/png"
  fetchpriority="high"
/>
```

After Phase 1 generation, prefer the AVIF LCP candidate (matches the `<picture>`
`imagesrcset` that `OptimizedImage` will emit):

```html
<link
  rel="preload"
  as="image"
  type="image/avif"
  imagesrcset="/images/optimized/home-intro-video-poster-480.avif 480w, /images/optimized/home-intro-video-poster-768.avif 768w, /images/optimized/home-intro-video-poster-1024.avif 1024w, /images/optimized/home-intro-video-poster-1600.avif 1600w"
  imagesizes="(min-width: 768px) min(92vw, 72rem), 100vw"
  fetchpriority="high"
/>
```

Vite font-preload plugin snippet (Lead pastes into `vite.config.ts`; keeps hashed names
in sync — no manual `index.html` hashes):

```ts
// vite.config.ts — inside plugins[]
function fontPreload(): import('vite').Plugin {
  return {
    name: 'w8-font-preload',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const bundle = ctx.bundle ?? {}
        const wanted = [
          /instrument-sans-latin-400-normal-[^/]*\.woff2$/,
          /instrument-sans-latin-500-normal-[^/]*\.woff2$/,
          /cormorant-garamond-latin-600-normal-[^/]*\.woff2$/,
        ]
        const links = Object.keys(bundle)
          .filter(file => wanted.some(pattern => pattern.test(file)))
          .map(
            file => `<link rel="preload" as="font" type="font/woff2" crossorigin href="/${file}">`
          )
          .join('\n    ')
        return html.replace('</head>', `  ${links}\n  </head>`)
      },
    },
  }
}
```

(Adjust the three font files to the actual above-the-fold set before shipping; the
frozen design uses Instrument Sans for body/UI and Cormorant Garamond for display text.
Keep the plugin `enforce: 'post'` so it sees the final bundle filenames.)

## 6. Lighthouse method checklist (Lead executes after the parity build)

Preconditions: Lead-managed preview of `rebuild/dist` (currently `:4175`), production-like
env (`VITE_MEDIA_BASE_URL` pointing at the media stub/CDN), no dev server HMR, one tab.

Desktop (`/`, `/gallery`, `/film`):

```bash
cd rebuild
npx lighthouse http://127.0.0.1:4175/ --preset=desktop --quiet \
  --output=json --output=html --output-path=perf/lighthouse/home-desktop
npx lighthouse http://127.0.0.1:4175/gallery --preset=desktop --quiet \
  --output=json --output=html --output-path=perf/lighthouse/gallery-desktop
npx lighthouse http://127.0.0.1:4175/film --preset=desktop --quiet \
  --output=json --output=html --output-path=perf/lighthouse/film-desktop
```

Mobile (same three URLs, simulated throttling):

```bash
npx lighthouse http://127.0.0.1:4175/ --form-factor=mobile --throttling-method=simulate \
  --screenEmulation.mobile --quiet --output=json --output=html \
  --output-path=perf/lighthouse/home-mobile
```

Acceptance (QUALITY_BAR): performance ≥ 90 mobile on `/`, `/gallery`, `/film`;
LCP ≤ 2.0 s on a mid-tier mobile profile; CLS ≤ 0.05; INP ≤ 200 ms (Lighthouse reports
TBT as the lab proxy — record TBT and label it, INP needs field data). Also capture
`--only-categories=performance,accessibility` to keep the axe/accessibility gate honest.
Artifacts: keep `perf/lighthouse/*.json|html` out of the deploy (add to `.gitignore` if
the Lead wants them committed for evidence, otherwise they are transient).

Checklist status:

- [ ] Parity build available in `rebuild/dist` (Lead).
- [ ] Media pipeline generated + `--check` passes (pending sharp approval).
- [ ] Preload hints integrated by W8-1/Lead (`index.html` hero + optional font plugin).
- [ ] Desktop runs recorded for `/`, `/gallery`, `/film`.
- [ ] Mobile runs recorded; LCP/CLS/TBT compared against targets.
- [ ] Final numbers added to this README's measured table.

## 7. Known gaps / deferred

- **sharp not installed** (Lead-owned). Pinned request: `sharp@0.35.5`; run
  `npm install --save-dev --save-exact sharp@0.35.5` in `rebuild/`. Until then
  `--plan`/`--check` work; `--generate` exits with a clear message.
- **Derivative generation deferred** until the Lead approves the scope/cadence
  (Phase 1/Phase 2 above). No files under `rebuild/public/images/**` were generated in
  this wave.
- **Preload tags deferred** to W8-1/Lead (this wave must not edit `index.html`).
- **Lighthouse runs + CI wiring deferred** to the Lead (build/infra owned by the Lead).
- **Vite manifest mode optional**: default `check-budgets` derives the initial set from
  `index.html` (`entry` + `modulepreload`), matching the browser; `--manifest` gives a
  static-import closure view once `build.manifest: true` is enabled.
- **Blurhash generation**: the pipeline records dominant colours only (no blurhash
  encoder dependency). `OptimizedImage` supports inline `blurHash` for callers/data that
  provide one; the decoder and CSS-gradient placeholder are dependency-free.
- **Runtime manifest weight**: the generated manifest is one JSON file consumed through
  `responsive-image.ts`. Once generation runs, the full entry set (paths + bytes +
  sha256 for ~1,350 derivatives, estimate ≈200–250 KiB raw / ≈40–60 KiB gzip) would be
  bundled for any chunk that imports `OptimizedImage`. Before adopting the component in
  the eager shell, emit a runtime-stripped manifest variant (paths + dimensions +
  dominant colour only, without hashes/bytes) or load it as a route-level JSON asset.
  Until adoption the import is tree-shaken out of the current build (no feature uses
  `OptimizedImage` yet), so today's budgets are unaffected.
- **No feature adoption yet**: features still use plain `<img>`; adopting
  `OptimizedImage` is a feature-wave change (shell/Lead scopes), not part of W8-2.
- Repo-wide lint currently also reports pre-existing errors in other Wave 8 scripts
  (`generate-sitemap.mjs`, `prerender.mjs` missing `/* global */` node globals — W8-1
  scope); this file's scripts and modules are lint-clean separately.

## 8. Verification (this wave)

- `npx eslint src/shared/media src/shared/ui/OptimizedImage.tsx scripts/check-budgets.mjs scripts/media-optimize.mjs` — clean.
- `npx prettier --check` on the same paths — clean.
- `npm run typecheck` (TS7) and `npm run typecheck:ts6` — no errors in touched files.
- `npx vitest run src/shared/media src/shared/ui/OptimizedImage.test.tsx` — **56 tests pass**
  (39 media helpers + 17 component).
- `node scripts/check-budgets.mjs` — strict PASS on the current parity build;
  `--mode baseline` PASS; baseline written via `--write-baseline`.
- `node scripts/media-optimize.mjs --plan` — 65 sources / 1,350 planned derivatives;
  `--check` — pre-generation warning, exit 0.

Repo-wide state at hand-off (for attribution, not caused by this wave): the full
`npm run test:run` suite currently shows 4 failing files, all in in-flight feature
scopes — `src/features/gallery/data.test.ts` + `GalleryPage`/`useGalleryPhotos`
(curated fixture counts changed by the gallery wave, expected 30/35, currently 35/40)
and a guestbook focus test that passes in isolation. None of those files import
`OptimizedImage` (verified: `PhotoGrid.tsx` does not use it), so W8-2 changes cannot
explain them. Full `npm run typecheck` reports only `src/app/seo/telemetry.ts` errors
(W8-1 scope). Repo-wide `npx eslint .` likewise reports only other Wave-8 scripts and
feature files; this wave's files are clean in the scoped commands above.
