# tools/perf — Wave 8 performance harness (measurement only)

Independent, dependency-free measurement harness for the greenfield app. It answers two questions
with numbers, not opinions:

1. **Did the bundle stay inside the performance budgets?** (`bundle.mjs`, deterministic, no browser)
2. **Do the priority routes still hit the LCP/CLS budgets under a mid-tier mobile profile?**
   (`run.mjs`, Playwright Chromium + slow-4G/CPU-x4 emulation)

It is **measurement only**: it never builds, deploys, or writes outside `tools/perf/output/`. The
Lead owns `rebuild/dist` and the preview servers; CI owns nothing here until the Lead wires the
commands below into `.github/workflows/rebuild.yml`.

Budgets are copied from [docs/rebuild/QUALITY_BAR.md](../../docs/rebuild/QUALITY_BAR.md)
"Performance budgets":

| Budget                                                                   | Value                                     | Enforced by                                                          |
| ------------------------------------------------------------------------ | ----------------------------------------- | -------------------------------------------------------------------- |
| Initial JS for `/` (entry `<script>` + `<link rel=modulepreload>`)       | **≤ 180 KiB gzip**                        | `bundle.mjs --check`                                                 |
| Any route's incremental JS chunk (incl. transitive static chunk imports) | **≤ 120 KiB gzip**                        | `bundle.mjs --check`                                                 |
| Total JS (all chunks)                                                    | ≤ 450 KiB gzip (reported, not gated here) | `bundle.mjs` table                                                   |
| LCP (mobile profile)                                                     | **≤ 2.0 s**                               | `run.mjs --check`                                                    |
| CLS                                                                      | **≤ 0.05**                                | `run.mjs --check`                                                    |
| INP                                                                      | ≤ 200 ms                                  | _not measured yet_ — long-task count/duration is reported as a proxy |

## Commands

```bash
# 1. Bundle budgets (reads the built dist; no browser, deterministic)
node tools/perf/bundle.mjs                        # human-readable tables + PASS/FAIL
node tools/perf/bundle.mjs --check                # CI gate: exit 1 on violation
node tools/perf/bundle.mjs --json                 # machine-readable report on stdout
node tools/perf/bundle.mjs --out tools/perf/output/bundle.json
node tools/perf/bundle.mjs --dist rebuild/dist    # default; any Vite build output works

# 2. Runtime budgets against the production-like delivery of the build (gzip static server)
node tools/perf/run.mjs --serve-dist rebuild/dist          # table
node tools/perf/run.mjs --serve-dist rebuild/dist --check  # CI gate
#    (the harness starts the server on an ephemeral port in the same process,
#     so nothing has to be running beforehand)

# 3. Runtime budgets against an already-running server, exactly as it is served
node tools/perf/run.mjs --url http://127.0.0.1:4175 --check
node tools/perf/run.mjs --url http://127.0.0.1:4174 --label legacy   # other side of a comparison

# Options: --routes /,/gallery,/film  --viewports mobile,desktop (or 390,1440)
#          --runs 3  --warmup 1  --json  --no-mocks  --timeout 90000
#          --baseline <previous-report.json>   (before/after delta table)
#          --allow-dist-drift                  (record even if dist changed mid-run)
#          --out <file>  --markdown-out <file>  --label <name>
```

### Before/after proof (used for the Wave 8 CLS fix)

`--baseline` loads a previous `run.mjs` JSON report and adds a per-cell before/after delta table
(LCP, CLS, transfer bytes) to the report. Example, proving the footer-push CLS fix:

```bash
node tools/perf/run.mjs --serve-dist rebuild/dist \
  --baseline tools/perf/output/baseline-before-fix-compressed.json \
  --out tools/perf/output/after-fix-compressed.json
```

Exit codes for both scripts: **0** within budget (or no `--check`), **1** budget violation,
**2** harness/config error (missing dist, no server, missing Playwright).

## Exact commands for the Lead / CI (wire-ready; do not commit CI edits from this task)

```bash
# after the Lead's build produces rebuild/dist
node tools/perf/bundle.mjs --check
node tools/perf/run.mjs --serve-dist rebuild/dist --check
```

Minimal CI additions (Lead owns the workflow file; runner is Linux, so Playwright's browser deps are
needed once — the app's own e2e job already does this):

```yaml
- name: Install Playwright Chromium (rebuild)
  run: cd rebuild && npx playwright install --with-deps chromium
- name: Performance budgets (bundle)
  run: node tools/perf/bundle.mjs --check
- name: Performance budgets (runtime)
  run: node tools/perf/run.mjs --serve-dist rebuild/dist --check
```

Both commands are safe on a shared CI runner: no fixed ports, no production access, third-party hosts
are mocked and never leave the machine.

## Methodology

### Bundle (`bundle.mjs`)

- Parses `dist/index.html` for the module entry script, `modulepreload` links and stylesheets.
- **Initial JS** = entry + modulepreload JS (the JS a first route must fetch before rendering).
- **Route incremental JS** = the route's lazy chunk plus its transitive static chunk imports (chunk
  imports are parsed from the emitted ES module graph), excluding files already in the initial set.
  Route→chunk prefixes mirror the lazy imports in `rebuild/src/app/router.tsx` — since Wave 8 the
  router lazy-loads route wrappers (`routes/{gallery,guestbook,activity}-route`, `routes/admin-routes`),
  so those chunks carry the `*-route-` names. A route whose prefix matches nothing fails `--check`
  ("stale route mapping"); update `ROUTE_CHUNKS` in `bundle.mjs` when the router changes.
- gzip is computed with `zlib.gzipSync(level: 9)` over emitted bytes; brotli is reported for
  information. KiB = 1024 bytes, matching QUALITY_BAR. Requests to a static host would be compressed
  by the host (Netlify serves Brotli/gzip), which is why gzip — not raw bytes — is budgeted.

### Runtime (`run.mjs`)

- **Same-run rule** (from [PARITY.md](../../docs/rebuild/PARITY.md)): a number is only comparable to
  another number captured in the same run, same OS, same emulated network/CPU, same mocks. Never
  compare across runs, machines, or network conditions; re-run both sides instead.
- Fresh browser context per run (cold cache), one warm-up run per route × viewport discarded, then
  **3 measured runs, median** reported.
- Emulation: Playwright Chromium (the version installed for `rebuild/`, resolved from
  `rebuild/node_modules`), CDP `Network.emulateNetworkConditions` **slow 4G** (1.6 Mbps down /
  750 kbps up / 150 ms RTT) + `Emulation.setCPUThrottlingRate` **4×**.
- Viewports from [contracts/ui.json](../../contracts/ui.json): mobile 390×844, desktop 1440×900,
  DPR 1. Mobile emulation also sets `isMobile`/`hasTouch`.
- Deterministic mocks (default; `--no-mocks` disables):
  `*.supabase.co` REST/auth → empty JSON (`[]`) with CORS headers, images (any host) → one fixed 1×1
  PNG stub, video/audio → aborted, other third-party hosts → aborted; same-origin JS/CSS/fonts are
  real bytes from the served build. This mirrors the parity harness asset policy and keeps third
  parties off the machine.
- Settling: `load` event, capped `networkidle` wait (8 s), `document.fonts.ready`, two animation
  frames, then a 500 ms quiet window; metrics are then read from in-page `PerformanceObserver`s.
- Metrics: **LCP** = last `largest-contentful-paint` entry (element recorded); **CLS** = sum of
  `layout-shift` entries without recent input (simple cumulative, not 1 s/5 s session windows);
  **TTFB/DCL/load** from the navigation timing entry; **transfer bytes** from `transferSize` grouped
  by resource type; **long tasks** = count + summed duration (INP proxy).
- **Invalid runs are never averaged into a PASS.** A run counts only if the document returned 2xx, no
  module/chunk load error occurred, and an LCP was observed; otherwise it is listed as invalid and
  excluded from the median. A cell with no valid run FAILs with the concrete reason.
- **Build-drift guard.** With `--serve-dist`, the harness fingerprints `index.html` + emitted asset
  count before and after the runs. If the build changed underneath it (the Lead rebuilt mid-run), the
  numbers mix two builds: it warns and exits **2** instead of reporting them (`--allow-dist-drift`
  overrides). This is exactly what happened once during Wave 8 integration and is why the guard exists.
- `--serve-dist` starts a local static server that serves the build with **gzip** (`--compression
brotli|none` to change), i.e. the way a static host delivers it. `--url` measures whatever the
  target server actually sends — `vite preview` serves **uncompressed**, which inflates transfer and
  LCP; that mode is for parity-comparison against the legacy preview, not for budget gating.

## Outputs

- JSON (default `tools/perf/output/latest.json`, or `--out`): per-cell medians, every raw run
  (LCP element, CLS shift sources, transfer by type, requests, long tasks, mocks counters, validity),
  budget verdicts, toolchain versions, emulation profile, target description (+ build fingerprints
  for `--serve-dist`), and optional `baselineComparison` deltas.
- Markdown table printed to stdout (same content is a section in the Wave 8 checkpoint); optional
  `--markdown-out <file>`.
- Committed-for-the-checkpoint evidence from the Wave 8 run lives next to this README's output dir:
  `baseline-before-fix-compressed.json`, `baseline-before-fix-bundle.json`, `after-fix-compressed.json`,
  `after-fix-bundle.json` (generated; the Lead may want `tools/perf/output/` in
  `.gitignore`/`.prettierignore`, like `tools/parity/output/`).

## Known limitations (read before quoting a number)

1. **Parity-env build.** The current `rebuild/dist` was built with the parity environment: the
   Supabase URL is the unroutable placeholder and the media base is the production CDN. The harness
   mocks both, so pages render shell/fallback content — LCP/CLS reflect the shell, not real photos or
   video. Concretely, mocked image requests return a 1×1 stub, so the recorded LCP element can fall to
   a below-fold text node (`h2.font-display`) instead of a hero image. A fresh build with realistic
   data/media env will change contentful LCP; re-run the harness then (the Lead owns builds).
2. **Client-rendered SPA.** First contentful paint waits for the initial JS chunk to download, parse
   and execute, so LCP includes JS parse time under the 4× CPU throttle. Pre-rendered HTML +
   hydration is the Wave-8 structural lever for LCP; until that build lands, LCP numbers are
   _measured but not structurally fixed_.
3. **Localhost, no CDN/TLS/HTTP2.** Static gzip from a local Node server is not Netlify's Brotli,
   HTTP/2 and edge cache. Numbers are a deployment proxy, not field data.
4. **No real user metrics.** This is lab measurement on an emulated profile; device/network variance
   is intentionally frozen. There is no RUM/field LCP/INP.
5. **CLS method.** Simple cumulative sum of shifts (not the Core Web Vitals session-window
   definition), so it can read slightly higher than CrUX/Lighthouse; treat >0.05 as a failure signal
   and inspect the recorded shift sources.
6. **INP not measured.** Long-task count/duration is a proxy only.
7. **Machine contention.** Wall timings vary on a shared/contended machine; the median of 3 runs
   reduces but does not remove that. Record the machine state with any checkpoint.
8. **Image stub.** 1×1 PNG stubs are consumed by the app's image elements; if the app does not set
   explicit dimensions/aspect ratios the stub can produce larger layout shifts than a correctly sized
   real image. The recorded CLS sources show exactly which element moved — use them to diagnose.

## Troubleshooting

- `no server reachable at ...` — for `--url`, start the preview server first (Lead owns :4174/:4175);
  or use `--serve-dist rebuild/dist` to let the harness serve the build itself.
- `Playwright is not installed` — run `npm ci` in `rebuild/` (no new packages; the app already pins
  `@playwright/test`). Linux CI also needs `npx playwright install --with-deps chromium`.
- Missing `dist` — the Lead owns `npm run build` in `rebuild/`; this harness never builds.
