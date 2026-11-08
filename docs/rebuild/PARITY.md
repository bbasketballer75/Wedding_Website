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

### Wave 0 documented capture residuals (reviewed)

| Shot | Measured residual (identical build, two captures) | Entry limit | Cause / owner action |
|---|---|---|---|
| `home` · desktop · dark | ≤ 9 changed px of 10,368,000 (≈ 8.7e-7) | `0.00001` | sub-pixel phase of a fixed-position animated overlay; remove when window capture is replaced by an exact motion freeze |
| `film` · desktop · dark | ≤ 1,041 changed px of 10,368,000 (≈ 1.0e-4) | `0.0002` | video-player overlay spinner/pulse phase (mocked CDN serves no video bytes); remove when the film player captures deterministically |

Both are below `--max-diff-ratio` (0.001) so a wave comparison passes them; they are allowlisted
so determinism evidence states the exception explicitly instead of claiming a strict 0. Every
other priority route captures at **0 changed pixels**. Entries expire at wave 1: a later wave must
re-review or fix them.

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

1. legacy vs legacy compare #1 → **0 changed pixels** on every shot;
2. compare #2 → 0 changed pixels **and** every slice byte-identical (sha256) to run #1;
3. a deliberately perturbed copy of a captured slice is **detected** by the pixel threshold;
4. a page captured with an injected CSS change fails the ordinary compare (exit code 1).

The run's verdict is written to `<out>/selfcheck.json`; the underlying compares each have their
own `summary.json` + `report.html` under `<out>/run1`, `<out>/run2` and `<out>/perturbed-capture`.
