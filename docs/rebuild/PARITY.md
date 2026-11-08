# Parity — proving the rebuild is the same product

The rebuild may change every line of code. It may not change what a visitor sees or reads. This
document is the operating manual for `tools/parity/`: what it measures, what it tolerates, how a
reviewed exception is recorded, and the exact commands each rebuild wave runs.

The oracle is the **frozen legacy build** (`git tag legacy-freeze-2026-11-08`) served as a static
production build. The candidate is the **greenfield rebuild build**. The harness takes two base
URLs and compares them under one deterministic environment; it never compares a stored baseline
captured on another OS, machine or browser build.

---

## 1. What parity means

| Layer | Mechanism | Failure means |
|---|---|---|
| **Pixels** | every route/viewport/theme captured as viewport-sized slices at deterministic scroll offsets; slices decoded to raw RGB (sharp) and compared with a pixelmatch-compatible YIQ threshold | visible drift in the product |
| **Text / DOM** | per shot: `document.title`, `lang`, canonical, every `meta[name|property]` (incl. `robots`, OG/Twitter), h1–h6, anchor href/text/aria-label, image src/alt/loading, and the normalised visible body text | copy, metadata, navigation or media-wiring drift |
| **Status** | HTTP status of the navigation on both sides | route/redirect regression |

`contracts/routes.json` decides what is captured: routes with `parity === 1` are the **priority**
matrix; `all` captures every route. `contracts/ui.json` decides viewports, device scale factor,
themes and the fixed clock. The harness has documented in-code fallbacks, but **evidence runs must
use the real contracts** — `summary.json.contracts` records which source was used.

## 2. Tolerance policy

Defaults (CLI-overridable):

| Knob | Default | Meaning |
|---|---|---|
| `--max-diff-ratio` | `0.001` | max changed-pixel ratio per **slice**; the shot fails above it |
| `--pixel-threshold` | `0.12` | per-pixel colour threshold on pixelmatch's normalised YIQ delta (`0.5053y² + 0.299i² + 0.1957q² > 35215·t²`) |
| `--edge-tolerance` | `0` (exact) | optional **edge-raster tolerance**: a changed pixel also counts as matched when the other image has a pixel under the colour threshold within ±N px (Chebyshev neighbourhood). Opt-in per comparison; never a default |

Rules:

- A shot passes only if **every** pair of slices is at or below `--max-diff-ratio` and the text/DOM
  comparison is exactly equal.
- **Anti-aliasing heuristics are deliberately not implemented.** Both sides are captured with the
  same browser binary, same device scale factor and same fonts on the same machine, so identical
  output has identical AA; the pixelmatch AA detector would only hide real sub-pixel drift.
- `sizeMismatch` (different slice dimensions) and slice-count mismatch always fail — a layout that
  changes page height is a real difference, even if the overlapping region looks identical.
- Everything is compared **per shot** (route × viewport × theme). There is no global budget that
  lets one bad route hide behind good ones.
- Text/DOM drift cannot be tolerated at all: it has no allowlist field. It always fails the wave.

### Edge-raster tolerance (`--edge-tolerance N`)

Some GPU-composited effects rasterise at fractional (`.5px`) edges and can land on either side of
the boundary between captures — `backdrop-filter` surfaces are the proven case. That produces
single-scanline colour differences at edges even when geometry, computed styles and text are
identical (the frozen legacy app reproduces the same magnitude against **itself**).

`--edge-tolerance N` forgives exactly that: a mismatching pixel is considered matched when ANY
pixel of the other image inside the ±N neighbourhood is under the same per-pixel colour threshold.
`N = 1` is the documented mode; the CLI accepts integers `0..4`, and `0` (the default) is the exact
per-pixel comparison every other gate, the self-check and all Wave-0/1 evidence used.

What it **cannot** hide (proved by the selfcheck perturbations, which run *with* `--edge-tolerance 1`):

- text/label/copy changes, colour or font changes — they still exceed the colour threshold;
- moving or removing an element by more than one pixel, or any size/spacing change — the changed
  pixels have no match within ±1 px;
- text/DOM drift, HTTP-status drift, layout-size/slice-count mismatch — these fail independently of
  the pixel tolerance.

Usage is deliberately scoped: **only the mobile 404 shell comparison uses it** (see §6). Never make
it a default, and never use a larger `N` to paper over a real layout shift.

## 3. Determinism rules

The capture recipe (`tools/parity/capture.mjs`) is the contract that makes two runs comparable:

| Concern | Rule |
|---|---|
| Build | production static builds only, served over HTTP; never a dev server |
| Both sides | captured in **one harness run**, same machine, same browser binary, same OS |
| Clock | `contracts/ui.json.fixedNow` (currently `2026-11-08T17:00:00.000Z`, 12:00 America/New_York). Playwright's fake-timer clock is installed at that instant and **paused before the capture navigation**; fake time is then advanced only by fixed `runFor()` budgets, so animation phase is a function of the budget, never of wall-clock time. `fixedNow` is also the instant contracts-eng's rendered-copy snapshots use, so the DOM/text side lines up. |
| Why not `setFixedTime` alone | it pins `Date` but leaves timers running: JS-driven carousels/pulse/spinners then freeze at an arbitrary phase (measured 0.3–1.6 % drift run-to-run). |
| Why not pause before the first navigation | the frozen app's lazy route mount then never resolves (stuck on the Suspense loader). A warm-up navigation with the clock running mounts the app and fills the HTTP cache; the captured navigation starts with the clock already paused. |
| Locale / timezone | `en-US` / `America/New_York` |
| Motion | `reducedMotion: 'reduce'` emulated; CSS animation/transition timing collapsed; after every scroll offset a fixed fake-time budget is advanced so in-view reveal animations finish deterministically |
| Theme | seeded via the persisted UI store (`ui-store`) before app scripts run, plus `colorScheme` emulated; if the app does not report the requested `data-theme` the shot records a warning |
| Service worker | `serviceWorkers: 'block'` + registration neutralised (the built PWA reloads the tab) |
| Media | `window.__E2E__ = true`; all video/audio paused, muted and at `t=0`; `play()` neutralised |
| Assets | same-origin assets load from the served build (real bytes); remote media CDN images answered with ONE fixed git-tracked stub WebP; video/audio CDN requests return no bytes; analytics/Sentry/font CDN requests are isolated and never leave the machine |
| Fixtures | Supabase REST/RPC/Auth, R2 presign and guest-upload URL answered from `contracts/fixtures/*.json` (fallback: `tests/e2e/support/*.ts`, then built-in) |
| Layout | fonts ready, every image complete + decoded, lazy-load sweep in 600 px steps, `scrollbar-gutter: stable`, scrollbars not painted |
| Capture | fresh browser context per shot; **8 fixed viewport windows** at absolute scroll offsets `0, viewportH, 2*viewportH, …` clamped to the page bottom — the window count never depends on page height, so a legacy/rebuild page-height difference cannot change the capture plan; after each window scroll a fixed fake-time budget completes in-view reveal animations; caret hidden; max page height cap 60 000 px |
| Masks | optional per-route CSS selectors hidden before capture (see §5); a mask is not an allowlist entry — it is exempted decoration, documented per selector |

`summary.json.determinism` records the actual values used for a run, including fixture source,
media-stub SHA-256, toolchain versions and any masks.

## 4. Allowlist governance (`contracts/parity-allowlist.json`)

Shape (validated by `parityAllowlistSchema` in `tools/lib/schemas.mjs`):

```json
{
  "entries": []
}
```

Each entry is one reviewed, expiring exception for exactly one route/viewport/theme:

```json
{
  "route": "home",
  "viewport": "desktop",
  "theme": "dark",
  "reason": "Intentional: hero announcement ticker was replaced by a static banner in wave 3",
  "expiresAtWave": 4,
  "maxDiffPixelRatio": 0.004
}
```

Rules:

1. **An entry requires human reviewer approval.** An agent may propose an entry in its task
   evidence; it may not add one unilaterally. The allowlist starts empty otherwise.
2. `reason` must name the intentional difference and the wave that will remove it.
3. `expiresAtWave` is mandatory. The harness runs with `--wave <n>` (default 1); once
   `wave > expiresAtWave` the entry no longer suppresses anything and the shot fails with
   `pixel (allowlist entry expired)`.
4. `maxDiffPixelRatio` is the maximum tolerated changed-pixel ratio for that shot — not "any
   amount". An entry that would need more than a few tenths of a percent is a design change, not a
   tolerance.
5. Text/DOM drift, HTTP-status drift, layout-size mismatch and capture errors can never be
   allowlisted.
6. A covered shot is reported as **`allowed`, never silently `pass`**: `summary.json` keeps the
   measured ratio and the entry, and the report shows the reason. Expired/unused entries are
   reported too; remove them in the same PR that closes the underlying work.
7. A **mask** (`ROUTE_MASKS` in `tools/parity/config.mjs`) is the preferred tool for a genuinely
   time- or random-driven decorative widget (marquee, live ticker). Each mask selector needs a
   route, a reason and a PARITY.md entry. Masks are recorded in `summary.json.determinism.masks`.

### Allowlist state by wave (reviewed, current)

**Current state (Wave 2): 2 entries**, both desktop/dark capture residuals of the *identical* frozen
build (never product differences, never text/pixel drift between legacy and rebuild):
`home` and `film`. Wave 2 deleted the two mobile 404 entries by adding `--edge-tolerance 1` to that
comparison (see §2); the `film` entry was briefly deleted after one re-measurement showed 0 px, then
restored when a later repeat reproduced 1,041 px — the residual is intermittent and must stay
documented until the film player captures deterministically.

| Shot | Wave-2 re-measured residual (identical build, two captures) | Entry limit | Cause / owner action |
|---|---|---|---|
| `home` · desktop · dark | 48 / 59 / 62 px of 10,368,000 across repeats (≤0.0006 %; historical max 63 px) | `0.00001`, `expiresAtWave: 2` | sub-pixel phase of a fixed-position animated overlay in the deterministic window capture; not a product difference. Remove when window capture is replaced by an exact motion freeze |
| `film` · desktop · dark | **intermittent**: 0 px in one repeat, 1,041 px (0.0100 %) in another | `0.0002`, `expiresAtWave: 2` | video-player overlay spinner/pulse phase (mocked CDN serves no video bytes). MUST be re-reviewed at Wave 3: freeze the overlay animation in capture or remove with fresh evidence |
| ~~`/*` · mobile · dark/light~~ | **0 changed px** with `--edge-tolerance 1` (was 11,011 px / 0.4181 % each) — both entries deleted | — | `backdrop-filter` raster phase at fractional edges; the tolerance mode covers it without weakening the exact default |

These residuals are far below `--max-diff-ratio` (0.001), so a wave comparison passes them; they are
allowlisted so determinism evidence states the exception explicitly instead of claiming a strict 0.
Every other priority route should capture at **0 changed pixels**. Remaining entries expire at
Wave 2: a later wave must re-review, fix, or renew them with fresh measured evidence.

## 5. Masks

`ROUTE_MASKS` in `tools/parity/config.mjs` maps a route id to CSS selectors that are hidden with
`visibility: hidden` before capture and therefore omitted from the pixel diff. Current entries:
**none** (the harness is 0-diff without masks; see selfcheck evidence in task-3).

Adding a mask requires: the selector is time/random-dependent (proved by a repeated selfcheck
failure on that region only), it is decoration rather than content, and the fact is documented
here with the reason and the wave that will replace it.

## 6. Exact commands

```bash
# Harness self-check (legacy vs legacy must be 0 changed pixels twice + perturbation detection)
node tools/parity/selfcheck.mjs
# reduced first pass (what a wave starts with):
node tools/parity/selfcheck.mjs --routes priority --matrix desktop --themes dark
# full: node tools/parity/selfcheck.mjs --routes priority --matrix all --themes dark,light

# Compare legacy (oracle, served by the Lead on port 4174) against the rebuild build
node tools/parity/compare.mjs \
  --legacy-url http://127.0.0.1:4174 \
  --rebuild-url <rebuild-url> \
  --routes priority --matrix desktop,mobile --themes dark,light \
  --out tools/parity/output/wave-3 --wave 3

# Machine-readable result (exit code is authoritative):
node tools/parity/compare.mjs ... --json > summary.json

# Serve a static rebuild build for the harness (default port 4175)
node tools/parity/serve.mjs --dir rebuild/dist --port 4175

# Re-render report.html from an existing summary.json
node tools/parity/report.mjs --out tools/parity/output/wave-3
```

Exit codes: `0` pass, `1` unexplained diff (or a failed self-check), `2` harness/config error
(unreachable URL, invalid contract/allowlist, missing browser, capture exception).

### Wave 1 — 404 shell parity (`/people`)

`contracts/routes.json` declares the SPA catch-all as path `/*`, which is not a navigable URL.
`tools/parity/config.mjs` therefore owns `ROUTE_PATH_OVERRIDES`: the `not-found` route id is
captured at **`/people`**, the frozen app's retired face-recognition route. The SPA fallback serves
the shared shell and the router renders the NotFound view (noindex, nofollow, canonical `/404`) —
the same behaviour `tests/e2e/seo.spec.ts` and `smoke.spec.ts` assert. Overrides are applied by
route id before `:token`/`*` substitution and are recorded in
`summary.json.contracts.routes.capturePathOverrides`, so a summary always shows the URL actually
captured. New non-navigable contract routes belong in that map — never hardcoded in `capture.mjs`.

Wave 1's first parity target is that 404 shell. The rebuild build/serve steps (ports are
Lead-owned; the frozen oracle stays on 4174, the greenfield preview is 5175):

```bash
# Greenfield build + static preview (Lead-owned port; do not replace the oracle on 4174)
cd rebuild && npm install && npm run build && cd ..
node tools/parity/serve.mjs --dir rebuild/dist --port 5175

# 404 shell parity — contract route id "not-found" is captured at /people
node tools/parity/compare.mjs \
  --legacy-url http://127.0.0.1:4174 \
  --rebuild-url http://127.0.0.1:5175 \
  --routes not-found --matrix desktop,mobile --themes dark,light \
  --out tools/parity/output/w1-404

# Harness plumbing proof: two independent servers, same frozen build, 0 expected diff
node tools/parity/serve.mjs --dir dist --port 4176
node tools/parity/compare.mjs \
  --legacy-url http://127.0.0.1:4174 --rebuild-url http://127.0.0.1:4176 \
  --routes not-found --matrix desktop,mobile --themes dark,light \
  --out tools/parity/output/w1-404-plumbing

# Wiring self-proof (legacy vs legacy, oracle compared with itself)
node tools/parity/compare.mjs \
  --legacy-url http://127.0.0.1:4174 --rebuild-url http://127.0.0.1:4174 \
  --routes not-found --matrix desktop,mobile --themes dark,light \
  --out tools/parity/output/w1-404-selfcheck
```

Expected for the self-proof commands: 4 shots, `0` changed pixels, `0` text diffs, exit code 0.

### Wave 2 — edge-raster tolerance and the 404 gate (current)

Wave 2's 404 comparison uses the opt-in edge-raster tolerance (default stays exact, §2):

```bash
# 404 shell parity with edge-raster tolerance (this is the only comparison that uses it)
node tools/parity/compare.mjs \
  --legacy-url http://127.0.0.1:4174 \
  --rebuild-url http://127.0.0.1:4175 \
  --routes not-found --matrix all --themes dark,light \
  --wave 2 --edge-tolerance 1 \
  --out tools/parity/output/w2-404
```

Measured on the Wave-2 build (`rebuild/dist` rebuilt before the run):

| Shot | exact mode (no flag) | `--edge-tolerance 1` |
|---|---|---|
| not-found desktop dark | 0 / 6,500,640 px — pass | 0 / 6,500,640 px — pass |
| not-found desktop light | 0 / 6,500,640 px — pass | 0 / 6,500,640 px — pass |
| not-found mobile dark | 11,011 / 6,500,640 px = **0.4181 %** — fail | **0** — pass |
| not-found mobile light | 11,011 / 6,500,640 px = **0.4181 %** — fail | **0** — pass |

Final state: 4/4 pass, **0 allowed entries**, 0 text diffs, exit code 0 (`tools/parity/output/w2-404/`).
The tolerance cannot hide real changes: `selfcheck.mjs` runs both perturbation checks **with
`--edge-tolerance 1`** and they still fail the comparison (§9), and every other gate keeps the
exact default.

Outputs under `--out` (default `tools/parity/output`, gitignored):

```
shots/legacy/<route>__<viewport>__<theme>--sNNN.png
shots/rebuild/…
shots/diff/…            # magenta = changed pixel, dimmed = identical
text/legacy|rebuild/<route>__<viewport>__<theme>.json    # DOM/text contract capture
text/diff/…            # present only when text parity fails
summary.json            # machine-readable: shots, ratios, allowlist, determinism, verdict
report.html             # self-contained (images inlined), opens offline
```

## 7. How a rebuild wave uses the harness

1. Build the rebuild (production build) and serve it statically (`serve.mjs`, a port the Lead
   assigns). Never touch the legacy server.
2. Run `selfcheck.mjs` against the legacy URL first; a wave never trusts a harness whose repeat
   captures disagree.
3. Run `compare.mjs --routes priority --matrix all --themes dark,light --wave <n>`.
4. Open `report.html`:
   - `pass` → ship.
   - `allowed` → confirm the allowlist entry is still justified and not expired.
   - `fail` → fix the rebuild; if a difference is **intentional and reviewed**, implement it,
     then add an expiring allowlist entry (with the wave it disappears) or a documented mask.
   - `error` → harness/config problem; fix the harness before judging the rebuild.
5. Attach `summary.json` + `report.html` to the wave checkpoint as evidence. The wave gate is
   exit code 0 with an empty allowlist or only entries whose reasons were reviewed in that wave.
6. Re-run the **same** compare after the fix. Determinism means a repeated run on unchanged builds
   must produce identical reports.

## 8. Evidence discipline

- A baseline captured on another OS/machine is **not** evidence: never commit stored screenshots as
  the oracle. The harness always captures both sides in the same run.
- `summary.json.contracts` must say `contracts/ui.json` and `contracts/routes.json` (not
  `fallback`) for evidence runs.
- Do not copy media into the harness; the only media bytes in the repo are the fixed stub image and
  the real files already served by the build.
- Known limitations: admin-scoped captures need a Supabase project ref for the session storage key
  (derived from `contracts/fixtures/adminSession.json.storageKey`, override with
  `PARITY_SUPABASE_PROJECT_REF`); remote CDN video/audio is intentionally not fetched, so players
  show their poster/empty states; the fixture set is synthetic (`contracts/fixtures/`), not
  production data.

## 9. Self-check evidence (task-3)

`selfcheck.mjs` proves, against the frozen legacy oracle:

1. legacy vs legacy compare #1 → every shot passes with **0 changed pixels** (documented allowlist
   exceptions are reported explicitly, never silently passed);
2. compare #2 → repeats the same, and every captured window is **decoded and required to have 0
   changed pixels** vs run #1 (PNG byte equality is reported as a diagnostic only — ancillary
   chunk/metadata differences must never fail the gate); allowlisted shots are reported with their
   measured residual;
3. a deliberately perturbed copy of a captured window is **detected**, and this check runs with
   `--edge-tolerance 1` on purpose — the tolerance cannot hide a real change;
4. a page captured with an injected CSS change **fails** the ordinary compare (exit code 1), also
   with `--edge-tolerance 1` enabled.

Determinism checks (1 and 2) always use the default **exact** pixel comparison; only the two
perturbation checks deliberately enable the edge tolerance to prove it stays sensitive.

The run's verdict is written to `<out>/selfcheck.json`; the underlying compares each have their
own `summary.json` + `report.html` under `<out>/run1`, `<out>/run2` and `<out>/perturbed-capture`.
`npm run parity:selfcheck` runs the reduced gate (`priority` × `desktop` × `dark`); pass
`--routes priority --matrix all --themes dark,light` for the full matrix.
