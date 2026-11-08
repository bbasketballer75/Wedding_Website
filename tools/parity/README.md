# tools/parity — deterministic legacy-vs-rebuild parity harness

Stack-agnostic visual + text parity harness for the 2026 greenfield rebuild. It takes **two base
URLs** and captures both sides in one run under one deterministic environment, then diffs pixels
and DOM/text.

- Policy, tolerance, allowlist governance, commands and wave usage: [`docs/rebuild/PARITY.md`](../../docs/rebuild/PARITY.md)
- Source of truth for viewports/themes/clock: `contracts/ui.json`; for routes/priorities:
  `contracts/routes.json`; for API payloads: `contracts/fixtures/`.
- No new dependencies: PNG work uses the existing `sharp` devDependency; capture uses
  `@playwright/test`'s Playwright.

## Quick start

```bash
# 1. Legacy oracle must already be served (Lead-owned). Verify:
curl -s http://127.0.0.1:4174/ > /dev/null

# 2. Prove the harness is trustworthy (legacy vs legacy):
node tools/parity/selfcheck.mjs

# 3. Compare the rebuild build against the oracle:
node tools/parity/node tools/parity/compare.mjs \
  --legacy-url http://127.0.0.1:4174 \
  --rebuild-url http://127.0.0.1:4175 \
  --routes priority --matrix desktop,mobile --themes dark,light

# 4. Serve a static rebuild build when needed (default port 4175):
node tools/parity/serve.mjs --dir rebuild/dist --port 4175
```

Exit codes: `0` pass · `1` unexplained diff · `2` harness/config error.

## Modules

| File                 | Responsibility                                                                                                                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config.mjs`         | contract loading/validation, deterministic constants, masks, CLI parsing, route/viewport/theme selection, reachability probe                                                                                     |
| `mocks/fixtures.mjs` | loads `contracts/fixtures/*.json` (fallback: legacy e2e support fixtures) into one normalised fixture set                                                                                                        |
| `mocks/index.mjs`    | pre-app browser init (theme, `__E2E__`, SW suppression, media freeze, admin session) + stack-neutral network mocks (Supabase REST/RPC/Auth, media CDN stub, R2 presign, guest-upload URL, third-party isolation) |
| `capture.mjs`        | launches Chromium, warm-up navigation, fake-clock/paused capture navigation, lazy sweep, deterministic scroll-offset slices, DOM/text extraction, artifact writing                                               |
| `diff.mjs`           | PNG decode via sharp → raw RGB compare (pixelmatch-compatible YIQ metric), diff PNG encoding, text/DOM comparison, perturbation helper                                                                           |
| `allowlist.mjs`      | loads and validates `contracts/parity-allowlist.json`; evaluates reviewed/expiring entries against a shot                                                                                                        |
| `compare.mjs`        | CLI orchestrator: plan → captures → diffs → allowlist → `summary.json` + `report.html`; exit codes                                                                                                               |
| `report.mjs`         | self-contained offline HTML report (all images inlined); can re-render from `summary.json`                                                                                                                       |
| `serve.mjs`          | minimal SPA static server for a rebuild build (index.html fallback)                                                                                                                                              |
| `selfcheck.mjs`      | legacy-vs-legacy twice (0 px + byte-identical) + diff perturbation + capture perturbation                                                                                                                        |

## Determinism in one line

Production builds · one browser/machine for both sides · fake clock installed at
`contracts/ui.json.fixedNow` and paused before the capture navigation with fixed `runFor()` budgets
· warm-up navigation first (so lazy routes mount) · reduced motion · service workers blocked ·
`en-US` / `America/New_York` · same-origin assets real, remote media stubbed with one fixed WebP ·
Supabase/CDN/R2 answered from fixtures · videos paused/muted at 0 · fonts+images settled · lazy
sweep · viewport-slice capture at deterministic scroll offsets. Full rationale in
`docs/rebuild/PARITY.md`.

## Adding coverage

- **New route**: add it to `contracts/routes.json` (contracts-eng owns that file) with `parity`,
  `matrix` and `themes`; nothing else needed unless it needs `:token` (fixtures) or admin auth.
- **New fixture/endpoint**: extend `contracts/fixtures/*.json` and map it in
  `mocks/index.mjs` (`supabasePublicResponse` / `supabaseAdminResponse`).
- **Time-driven widget**: prefer fixing determinism; if genuinely impossible, add a selector to
  `ROUTE_MASKS` in `config.mjs` and document it in `docs/rebuild/PARITY.md` §5.
- **Reviewed tolerance**: an expiring entry in `contracts/parity-allowlist.json` — see PARITY.md §4.
  Agents must not add entries without reviewer approval.

## Troubleshooting

- `Cannot reach <url>` (exit 2): the preview server is down. The Lead owns servers — ask, do not
  start/replace one.
- `Could not launch Chromium`: Playwright browser may not be installed; the Lead owns installs.
- `contracts/ui.json is invalid` / `parity-allowlist.json must have shape`: fix the contract (wrong
  owner? ask) — the harness refuses to guess.
- A shot says `capture-error`: inspect `<out>/summary.json` → `shots[].legacy.error` and the
  report's console-error section; harness-level errors make the whole run exit 2.
