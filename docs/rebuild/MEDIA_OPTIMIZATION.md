# Media optimisation adoption decision (W9-8, measured)

Status: **decision proposal — owner sign-off required** (measured 2026-11-09).
Scope: post-cutover adoption of the W8-2 media pipeline (`rebuild/scripts/media-optimize.mjs`,
`rebuild/perf/media.config.json`, `rebuild/src/shared/media/**`, manifest-driven
`OptimizedImage`). No code, public assets, or contracts were changed by this note.

## 1. Decision summary

**Recommendation: Option B (adopt manifest `<picture>` on all image-heavy surfaces), staged,
with Option-A pinning as the per-surface fallback.** The measured numbers support it: the
Phase-1 render set (`home`, `film`, `couple`, `parents`, `parent-film-cards`,
`wedding-party`) drops from **44.32 MiB of Phase-1 originals (~43.8 MiB referenced by the content contracts) to 0.86 MiB of AVIF at the same
rendered widths (−98.1%)**, including the `/` hero LCP image from **239.9 KiB → 9.7 KiB
(−96.0%)** and the `/film` poster from **2.02 MiB → 38.6 KiB (−98.1%)**; decoded quality is
PSNR 35.8–47.9 dB, and the worst per-image pixel divergence is **0.01 % of pixels** beyond
the parity harness's own 0.12 colour threshold — at least 10× under the harness
`maxDiffRatio 0.001` even if an image covered the entire screenshot. The measured risk is
concentrated in two pipeline defects that must be fixed first (slug collisions, and the
JPEG fallback flattening 22 alpha cut-outs) and in the DOM parity gate if the `<img src>`
attribute changes; keeping the original as the `<img>` fallback while AVIF/WebP load via
`<source>` removes both risks while keeping the byte savings. Option C (defer) is not
recommended: the cutover deploy must serve the Phase-1 originals anyway (≈43.8 MiB are referenced by the content contracts)
(including two 20 MiB `couple` PNGs referenced by `party.json`), and deferring leaves the
LCP and bandwidth reductions unclaimed with no measured quality justification.

## 2. Current state and the parity constraint

- The rebuild production/parity build (`rebuild/dist`) currently ships **no archive
  images**: `dist/images` contains only the W8-1 social image and PWA icons. The parity
  preview serves the legacy `public/images/**` tree byte-identically through
  `tools/parity/serve.mjs --fallback-dir` (see `docs/rebuild/PARITY.md` §10.4).
- The parity gate compares screenshots **pixel-wise** (`maxDiffRatio 0.001`,
  `pixelThreshold 0.12` on pixelmatch's YIQ delta, `edgeTolerance 0`) and the DOM/text
  gate compares **`image src/alt/loading`** (`PARITY.md` §2). Serving different image bytes
  therefore changes the parity result by design; this is why adoption is a documented
  post-cutover decision rather than part of the parity build.
- The pipeline is delivered but neither generated nor consumed: no
  `rebuild/public/images/optimized/**` exists, `media-manifest.json` is empty, and no
  feature imports `OptimizedImage` (verified: features use plain `<img>`/CSS backgrounds).
- After cutover the deploy must ship _something_ for `/images/**`: the configured source
  scope is **50.9 MiB / 65 files** (Phase 1 alone 44.32 MiB of referenced originals), so
  the “do nothing” option still carries a media-deploy and LCP cost.

## 3. Method (reproducible; tmp only)

Environment: Node 26.8.1, `sharp@0.35.5` (Lead-installed, exact pin in `rebuild/package.json`).
Everything below writes only to the gitignored `tmp/media-optimize/`; **no derivative was
written to `rebuild/public` and nothing was committed**.

```bash
cd rebuild

# 1. Plan (no sharp needed)
node scripts/media-optimize.mjs --plan
# -> 65 raster sources, 50.9 MiB, 1350 derivative files (450 per format)

# 2. Temp-output Phase-1 generation (script's --out/--manifest overrides)
node scripts/media-optimize.mjs --generate \
  --only "home/,film/,couple/,parents/,parent-film-cards/,wedding-party/" \
  --out ../tmp/media-optimize/phase1/images/optimized \
  --manifest ../tmp/media-optimize/phase1-manifest.json \
  --json
# -> {"generated":582,"skipped":0,"images":30,
#     "bytes":26665763,"errors":[]}

# 3. Measurement harness (tmp; composited alpha, PSNR, parity-equivalent YIQ diff)
node ../tmp/media-optimize/measure2.mjs
```

Artifacts (all gitignored, available for inspection/cleanup with
`Remove-Item tmp/media-optimize -Recurse`):

| Artifact                                                                    | Contents                                                                           |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `tmp/media-optimize/plan.txt`                                               | captured `--plan` output                                                           |
| `tmp/media-optimize/generate-phase1.json`                                   | generation summary (582 encoded files, 25.43 MiB encoded)                          |
| `tmp/media-optimize/phase1/**`                                              | 534 files / 22.46 MiB on disk (48 files were overwritten — see defect D1)          |
| `tmp/media-optimize/phase1-manifest.json`                                   | generated manifest (152,484 B raw / 29,575 B gzip)                                 |
| `tmp/media-optimize/measurements2.json`                                     | full measurement payload (byte distribution, served sizes, quality, extrapolation) |
| `tmp/media-optimize/measure2.mjs`, `alpha-audit.mjs`, `measure-quality.mjs` | harnesses                                                                          |

Quality method: each derivative is decoded with sharp and compared against the original
resized to the same target dimensions (lanczos3, `fit: fill`); both are composited onto the
page canvases before comparison — cream `#f5f2ec` (`--color-cream-200`) and dark `#131110`
(`--color-charcoal-800`) — because 22 of the 30 Phase-1 sources are alpha cut-outs and
dropping alpha without compositing produces meaningless PSNR. Pixel divergence uses the
same metric as `tools/parity/compare.mjs` (pixelmatch YIQ delta, threshold
`35215 · 0.12²`).

## 4. Measured plan and generated output

### 4.1 Plan (`--plan`, captured)

| Field               | Value                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------- |
| Configured sources  | 65 rasters / 50.9 MiB                                                                     |
| Planned derivatives | 1,350 files (AVIF 450 / WebP 450 / JPEG 450)                                              |
| Widths              | 320, 480, 640, 768, 1024, 1280, 1600, 1920 (frozen tiers, source-capped)                  |
| Quality             | AVIF 55, WebP 80, JPEG 82 (mozjpeg, progressive)                                          |
| Groups              | engagement 35, wedding-party 14, couple 6, parents 4, parent-film-cards 4, film 1, home 1 |

### 4.2 Phase-1 generation (temp output)

30 sources → **582 encoded derivatives, 25.43 MiB encoded** (actual filesystem: 534 files /
22.46 MiB because of defect D1):

| Format    | Files   | Bytes          | MiB       | Measured bpp |
| --------- | ------- | -------------- | --------- | ------------ |
| AVIF      | 194     | 6,139,019      | 5.85      | 0.292        |
| WebP      | 194     | 8,835,158      | 8.43      | 0.420        |
| JPEG      | 194     | 11,691,586     | 11.15     | 0.556        |
| **Total** | **582** | **26,665,763** | **25.43** | —            |

By source group (encoded derivative bytes vs the group's original files):

| Group             | Sources | Original bytes | Derivative bytes (all widths × 3 formats) |
| ----------------- | ------- | -------------- | ----------------------------------------- |
| couple            | 6       | 40.73 MiB      | 10.87 MiB                                 |
| wedding-party     | 14      | 0.95 MiB       | 9.58 MiB                                  |
| parents           | 4       | 0.26 MiB       | 2.72 MiB                                  |
| film              | 1       | 2.02 MiB       | 1.06 MiB                                  |
| parent-film-cards | 4       | 0.12 MiB       | 0.87 MiB                                  |
| home              | 1       | 0.23 MiB       | 0.34 MiB                                  |

The derivative sets are complete width ladders (every configured width ≤ source width × 3
formats), so small originals produce more derivative bytes than their single original file;
the comparison that matters for users is served bytes per rendered slot (§5).

### 4.3 All-configured extrapolation (Phase 2 not generated)

Using the measured bits-per-pixel above and the engagement pixel plan (229,764,224 pixels
per format vs 168,259,841 for Phase 1):

| Scope                            | AVIF      | WebP      | JPEG      | Total          |
| -------------------------------- | --------- | --------- | --------- | -------------- |
| Phase 1 (measured)               | 5.85 MiB  | 8.43 MiB  | 11.15 MiB | **25.43 MiB**  |
| Phase 2 — engagement (estimated) | 7.99 MiB  | 11.51 MiB | 15.23 MiB | ≈34.7 MiB      |
| **All configured (estimated)**   | 13.85 MiB | 19.93 MiB | 26.38 MiB | **≈60.16 MiB** |

This corrects the earlier `rebuild/perf/README.md` §3.4 model estimate of 24.7 MiB for the
full scope (the bpp model used 0.10/0.16/0.26; measured 0.292/0.420/0.556 — 2.4× low).
Consequence: **Phase 1 is the high-value slice** (large originals replaced at low cost);
Phase 2 engagement derivatives would _increase_ deploy size (≈34.7 MiB derivatives for
6.6 MiB originals) and must not be generated wholesale without a reduced width set.

## 5. Served-size delta at rendered widths

Rendered width assumptions from the frozen layouts: hero 1024, film poster 1280,
couple/party portraits 640, parents 640, parent-film-cards 480. (Browser picks by DPR and
`sizes`; the table uses the single representative width per group.)

| Group                 | Originals     | AVIF         | WebP         | JPEG         | AVIF saving |
| --------------------- | ------------- | ------------ | ------------ | ------------ | ----------- |
| couple (6)            | 40.73 MiB     | 0.38 MiB     | 0.55 MiB     | 0.71 MiB     | −99.1%      |
| film (1)              | 2.02 MiB      | 0.04 MiB     | 0.05 MiB     | 0.08 MiB     | −98.1%      |
| home (1)              | 0.23 MiB      | 0.01 MiB     | 0.01 MiB     | 0.02 MiB     | −96.0%      |
| parent-film-cards (4) | 0.12 MiB      | 0.02 MiB     | 0.03 MiB     | 0.04 MiB     | −83.3%      |
| parents (4)           | 0.26 MiB      | 0.09 MiB     | 0.13 MiB     | 0.16 MiB     | −65.9%      |
| wedding-party (14)    | 0.95 MiB      | 0.32 MiB     | 0.45 MiB     | 0.55 MiB     | −66.2%      |
| **Total (30 files)**  | **44.32 MiB** | **0.86 MiB** | **1.23 MiB** | **1.56 MiB** | **−98.1%**  |

The `couple` row dominates because `party.json` references the PNG originals
(`austin.png`, `jordyn.png`: 6,863×10,292, ~20 MiB each), while the repo also holds ~545 KiB
WebP siblings for the same images (a zero-pipeline quick win worth noting, but still a
parity-visible byte change). The named hero/parent-film-cards rows are referenced by
`wedding.json`/`film.json`/`party.json`; the unreferenced couple WebP siblings are included
in the totals above but not in page payloads.

### 5.1 Hero LCP variants (`/` poster, original 239.9 KiB PNG, 1920×1080)

| Width | AVIF        | WebP     | JPEG     |
| ----- | ----------- | -------- | -------- |
| 320   | 2.9 KiB     | 3.4 KiB  | 4.4 KiB  |
| 480   | 4.6 KiB     | 5.6 KiB  | 6.8 KiB  |
| 640   | 6.1 KiB     | 8.4 KiB  | 10.2 KiB |
| 768   | 7.2 KiB     | 10.5 KiB | 12.3 KiB |
| 1024  | **9.7 KiB** | 15.1 KiB | 18.4 KiB |
| 1280  | 11.8 KiB    | 20.0 KiB | 25.1 KiB |
| 1600  | 14.9 KiB    | 25.1 KiB | 34.3 KiB |
| 1920  | 16.2 KiB    | 29.0 KiB | 42.8 KiB |

At a 1024 CSS px slot the LCP image drops 230.2 KiB; even the 1600 px DPR-2 variant
(14.9 KiB) is 225 KiB smaller than today's single PNG.

## 6. Quality and parity pixel impact (honest risk)

Pixel divergence is reported as the percentage of composited pixels whose pixelmatch YIQ
delta exceeds the parity threshold at `t = 0.12` (equal to the harness's per-pixel gate).

| Sample (rendered width)                   | Format | Bytes KiB | PSNR cream  | PSNR dark | Over-threshold cream | Over-threshold dark | Alpha preserved         |
| ----------------------------------------- | ------ | --------- | ----------- | --------- | -------------------- | ------------------- | ----------------------- |
| home/intro-video-poster.png (1024)        | AVIF   | 9.7       | 44.79 dB    | 44.79 dB  | 0.01%                | 0.01%               | yes (opaque)            |
| home/intro-video-poster.png (1024)        | WebP   | 15.1      | 47.92 dB    | 47.92 dB  | 0.00%                | 0.00%               | yes (opaque)            |
| home/intro-video-poster.png (1024)        | JPEG   | 18.4      | 40.68 dB    | 40.68 dB  | 0.07%                | 0.07%               | n/a                     |
| film/main-film-poster.png (1280)          | AVIF   | 38.6      | 39.60 dB    | 39.60 dB  | 0.00%                | 0.00%               | yes (opaque)            |
| film/main-film-poster.png (1280)          | WebP   | 56.1      | 39.61 dB    | 39.61 dB  | 0.00%                | 0.00%               | yes (opaque)            |
| film/main-film-poster.png (1280)          | JPEG   | 86.1      | 40.18 dB    | 40.18 dB  | 0.00%                | 0.00%               | n/a                     |
| parents/christine.webp (640)              | AVIF   | 25.6      | 38.49 dB    | 38.49 dB  | 0.00%                | 0.00%               | yes (28.9% transparent) |
| parents/christine.webp (640)              | WebP   | 35.9      | 38.75 dB    | 38.75 dB  | 0.00%                | 0.00%               | yes                     |
| parents/christine.webp (640)              | JPEG   | 45.1      | **5.95 dB** | 28.49 dB  | **28.87%**           | 0.00%               | no (flattened)          |
| wedding-party/…/brinnah-helsel.webp (640) | AVIF   | 23.2      | 39.93 dB    | 39.93 dB  | 0.00%                | 0.00%               | yes (31.0% transparent) |
| wedding-party/…/brinnah-helsel.webp (640) | WebP   | 30.4      | 39.92 dB    | 39.92 dB  | 0.00%                | 0.00%               | yes                     |
| wedding-party/…/brinnah-helsel.webp (640) | JPEG   | 38.4      | **5.63 dB** | 28.26 dB  | **31.03%**           | 0.00%               | no (flattened)          |
| parent-film-cards/jerame.webp (480)       | AVIF   | 3.8       | 43.35 dB    | 43.35 dB  | 0.00%                | 0.00%               | no (opaque)             |
| parent-film-cards/jerame.webp (480)       | WebP   | 5.2       | 42.00 dB    | 42.00 dB  | 0.00%                | 0.00%               | no                      |
| parent-film-cards/jerame.webp (480)       | JPEG   | 7.8       | 39.05 dB    | 39.05 dB  | 0.07%                | 0.07%               | n/a                     |
| couple/496…_n.webp (1024)                 | AVIF   | 121.5     | 35.81 dB    | 35.81 dB  | 0.00%                | 0.00%               | no                      |
| couple/496…_n.webp (1024)                 | WebP   | 191       | 37.79 dB    | 37.79 dB  | 0.00%                | 0.00%               | no                      |
| couple/496…_n.webp (1024)                 | JPEG   | 224       | 37.34 dB    | 37.34 dB  | 0.00%                | 0.00%               | n/a                     |

**AVIF/WebP risk estimate.** The AVIF path — what every current browser and the parity
harness's Chromium uses — stays within **0.00–0.01%** over-threshold pixels per image and
PSNR ≥35.8 dB. Since the parity allowance is a _ratio over the whole screenshot_
(`maxDiffRatio 0.001` = 0.1%), the measured per-image divergence stays under the allowance
even if the image fills the entire viewport (0.01% ≪ 0.1%). No parity allowance increase is
proposed on this evidence.

**Residual risks (state honestly).**

1. **Alpha cut-outs + JPEG fallback (defect D2).** 24 of 30 Phase-1 sources carry an alpha
   channel and 22 are real cut-outs (26.1–52.6% transparent pixels): the `parents`,
   `parent-film-cards`, `wedding-party`, and `couple` portraits. The generated JPEG
   derivatives flatten alpha onto black, so on light surfaces they diverge from the
   original by 28.9–31.0% of pixels and look wrong (black halo/background). AVIF/WebP
   preserve alpha and measure 0.00%. This does not affect parity (Chromium takes AVIF) but
   does affect old-browser fallbacks and requires a policy (keep original as `<img>`
   fallback — recommended — or flatten JPEG onto the surface canvas colour).
2. **DOM/text parity gate (not just screenshots).** `PARITY.md` compares image
   `src/alt/loading`. If adoption rewrites `<img src>` to a derivative path, the text gate
   fails even though pixels pass. Keeping the **original path as the `<img src>`** while
   AVIF/WebP load through `<source>` keeps the DOM gate byte-identical (and doubles as the
   old-browser/alpha fallback); this requires a small `OptimizedImage` change (a
   `fallbackSrc` override, currently the fallback is the largest JPEG derivative).
3. Browser decoders differ from sharp's decoder; the screenshots use Chromium. The
   measured divergence should be re-confirmed with a real parity run after adoption
   (rollout step 8), with Option-A pinning if any route fails.
4. Determinism: regenerating with a different `sharp` version or quality settings changes
   bytes; keep `sharp` pinned and treat manifest `configHash`/`sourceSha256` as the gate
   (already enforced by `--check`).

## 7. Defects found during measurement (fix before generation)

| ID  | Defect                                                                                                                                                                                              | Evidence                                                                                                                                | Fix (required)                                                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Slug collision for same-basename source formats.** `couple/austin.png` and `couple/austin.webp` (likewise `jordyn`) map to the same deterministic slug, so their derivatives overwrite each other | 2 collisions; 48 of 582 derivative files overwritten; manifest 582 vs 534 files on disk; `media --check` would fail with sha/size drift | Make names collision-proof (append source extension/short path hash) and add a regression test; regenerate                                                           |
| D2  | **JPEG fallback flattens alpha cut-outs to black**                                                                                                                                                  | 28.87%/31.03% over-threshold pixels on cream for `parents/christine` and `bridesmaid` JPEGs; 0.00% for AVIF/WebP                        | Skip JPEG for non-opaque sources (use original as fallback) **or** flatten onto the surface canvas colour; document per-source policy                                |
| D3  | **Plan estimate was 2.4× low**                                                                                                                                                                      | README §3.4 model 24.7 MiB all-config vs measured-extrapolated 60.16 MiB                                                                | Update the perf README with measured bpp (follow-up; out of scope for this note)                                                                                     |
| D4  | **Runtime manifest weight**                                                                                                                                                                         | Phase-1 manifest 152,484 B raw / 29,575 B gzip for 30 sources; all-config extrapolates to ~350 KiB raw / ~66 KiB gzip                   | Emit a stripped runtime manifest (paths/dims/dominant colour only) or route-level JSON before `OptimizedImage` enters the eager bundle (README §7 caution confirmed) |

D1 means no derivative set should be generated into `rebuild/public` until the naming fix
lands; the temp measurement is otherwise valid because encoded bytes were recorded in the
manifest before the overwrite (quality samples avoided the collided pair).

## 8. Options

|                        | A — originals on parity-critical surfaces, derivatives below the fold                                                                      | B — manifest `<picture>` on all image-heavy surfaces (+ parity allowance/re-baseline)                                                                                                       | C — defer entirely                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| What changes           | Party/gallery/thumbnail images adopt `<picture>`; hero poster, film poster, and any parity-sensitive surface keep byte-identical originals | All image-heavy surfaces adopt `<picture>` with original as `<img>` fallback; parity matrix re-run, allowance kept at current tolerance; Option-A pinning for any failing surface           | No image bytes change; parity untouched                                   |
| Measured served saving | ≈66–83% on adopted groups; hero 240 KiB and film 2 MiB remain                                                                              | **−98.1%** Phase-1 served bytes (44.32 → 0.86 MiB AVIF); hero 239.9 → 9.7 KiB; film 2.02 MiB → 38.6 KiB                                                                                     | 0%                                                                        |
| Quality evidence       | AVIF/WebP PSNR 35.8–47.9 dB; divergence ≤0.01% (same as B on adopted surfaces)                                                             | Same, measured per image; worst 0.01% ≪ 0.1% allowance                                                                                                                                      | none measured (risk stays: 44.32 MiB originals on critical paths)         |
| Parity risk            | Low: critical surfaces untouched; DOM `src` unchanged on those                                                                             | Low on AVIF path (≤0.01%); requires DOM-fallback design + re-run; JPEG/alpha fallback irrelevant to Chromium parity but must be handled for legacy browsers                                 | None                                                                      |
| Deploy size (Phase 1)  | Both sets for adopted groups + originals for critical ≈ 44.3 MiB originals + subset derivatives                                            | Derivatives 25.43 MiB; retaining originals for OG/JSON-LD/fallback ≈ +2.3 MiB (hero+film poster) and optionally cut-out originals → ≈28–30 MiB total (smaller than originals-only 44.3 MiB) | Originals 44.32 MiB (Phase 1; ≈43.8 MiB referenced) / 50.9 MiB configured |
| Effort                 | Medium: per-surface adoption, parity matrix, no pipeline naming fix strictly needed (still D2)                                             | Medium: D1+D2 fixes, runtime-manifest strip, DOM fallback change, full parity matrix, Lighthouse                                                                                            | None now, revisit later                                                   |
| Verdict                | Acceptable fallback                                                                                                                        | **Recommended**                                                                                                                                                                             | Not recommended                                                           |

## 9. Recommendation and owner decision

**Adopt Option B, staged, starting with Phase 1, after fixing D1/D2 and with the DOM-safe
fallback design.** The supporting number is the served-bytes collapse at identical rendered
sizes: **44.32 MiB → 0.86 MiB AVIF (−98.1%)**, with the hero LCP image **−96.0%** and the
film poster **−98.1%**, while decoded AVIF quality stays at PSNR 35.8–47.9 dB and measured
pixel divergence stays at ≤0.01% of pixels (10× inside the harness's 0.1% allowance). Keep
the original path as `<img src>` so DOM parity and legacy/alpha fallbacks stay intact, and
pin any surface that fails the post-adoption parity matrix to Option A.

**Owner decisions required:**

1. **Approve Option B (Phase 1)** and authorize the D1/D2 pipeline fixes + generation of
   Phase-1 derivatives into `rebuild/public/images/optimized/**` (25.43 MiB encoded; the
   derivative set replaces ~44.32 MiB of referenced originals in the deploy if the
   cut-out originals are kept only as `<img>` fallback — decide the final deploy accounting).
2. **Choose the alpha fallback policy** for the 22 cut-outs: keep the original as
   `<img src>` fallback and skip JPEG derivatives for them (recommended), or flatten JPEG
   onto the surface canvas colour.
3. **Parity policy:** keep `maxDiffRatio 0.001` and the existing pixel threshold (measured
   AVIF path fits without relaxing them), re-run the parity matrix with derivatives served,
   and accept Option-A pinning for any surface/route that exceeds it.
4. **Phase 2 (engagement) is not approved wholesale:** its estimated 34.7 MiB of
   derivatives for 6.6 MiB of originals increases deploy size; decide a reduced width set
   (or defer) separately.
5. **Commit/generate cadence:** commit the generated derivatives (25.43 MiB) or run
   generation in the deploy pipeline; either way wire `node scripts/media-optimize.mjs
--check` into CI so drift fails the build. Tie the media end-state to the open OD-12
   (keep R2 as the origin; derivatives are deploy-only).

## 10. Rollout and integration steps (once approved)

1. **Fix the pipeline:** D1 collision-proof slugs (+ regression test/regenerate), D2 alpha
   policy, and add the `media:check` CI step. Verify with a fresh temp run that 582/582
   files are written and `--check` passes.
2. **Generate Phase 1** into `rebuild/public/images/optimized/` with the script (same
   `--only` scope as this measurement) and commit the derivatives + manifest (or generate
   during deploy), then run `--check`.
3. **`OptimizedImage` adoption (feature owners/Lead):** swap plain `<img>`/CSS backgrounds
   for `<OptimizedImage sizes='heroPoster' | 'galleryGrid' | 'engagementCard' …>` with a
   `fallbackSrc` = original for DOM parity, OG/JSON-LD URLs unchanged, and `priority` on
   `/` hero and `/film` poster.
4. **Runtime manifest:** emit a stripped `media-manifest.runtime.json` (paths, dimensions,
   dominant colour; drop sha/bytes/configHash) before the component enters the eager
   bundle, or load the manifest as route-level JSON — the full Phase-1 manifest is 152 KiB
   raw / 29 KiB gzip (D4).
5. **`index.html` preload (W8-1):** replace the hero PNG preload with the AVIF
   `imagesrcset`/`imagesizes` block from `rebuild/perf/README.md` §5 once generated.
6. **Cache headers (W8-1):** add immutable long-cache for `/images/optimized/*` in
   `rebuild/netlify.toml` (hashed-free deterministic names are content-stable while the
   manifest pins hashes).
7. **Parity matrix:** re-run all priority routes with derivatives served; confirm the
   image-only diffs stay within `maxDiffRatio 0.001`; pin any failing surface to originals
   (Option A) and record the decision in `docs/rebuild/PARITY.md`.
8. **Lighthouse:** re-run mobile `/`, `/gallery`, `/film` (method in
   `rebuild/perf/README.md` §6) and record LCP/CLS/TBT; expected LCP improvement on `/`
   from −230 KiB on the LCP image and on `/film` from the −2 MiB poster.
9. **Deploy/rollback:** keep originals for one release (OG/social URLs and `<img>` fallback
   require them anyway); rollback = revert the adoption commit (originals still served).
   Account for deploy size: Phase-1 derivatives + retained originals ≈28–30 MiB vs
   44.32 MiB originals-only (or 44.32 + 25.43 MiB if every original is kept).
10. **Follow-up:** correct `rebuild/perf/README.md` §3.4 estimates with the measured bpp
    (24.7 MiB → 60.16 MiB all-config) when the doc owner is available.

## 11. Verification

- Measurements are reproducible with the commands in §3; artifacts retained under `tmp/`
  (gitignored) and contain the full per-file payloads (`measurements2.json`).
- No changes were made outside `docs/rebuild/MEDIA_OPTIMIZATION.md` and `tmp/`: no
  `rebuild/**` edits, no public assets written (`git status` shows no
  `rebuild/public/images/optimized`), no builds run.
- `node scripts/media-optimize.mjs --check` against the temp manifest was not used as a
  gate because of D1; the manifest's recorded byte counts are the source of truth for the
  numbers above.
