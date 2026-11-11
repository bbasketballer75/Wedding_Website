# DEPLOY — greenfield deploy runbook

Documentation only. **No deploy was executed while writing this page.** Steps are for the Lead/owner
after the final parity matrix is signed (`CUTOVER.md` §5 G1) and the owner authorises the cutover
(`CUTOVER.md` §6). Commands marked `UNVERIFIED` need the owner's Netlify/Cloudflare session; nothing
here is a production action by itself.

Context: branch `rebuild/greenfield` @ `53cda7b` (2026-11-09; Wave 8 + Wave 9 evidence committed). Wave 8
evidence is committed in `../checkpoints/2026-11-09-waves-7-8.md` (Wave 9 section at the end); the
greenfield deploy config is `rebuild/netlify.toml` (committed); the final parity matrix is
`tools/parity/output/w9-matrix-final5/` (immutable for the cutover record).

## 1. Preconditions (all must be true before any deploy command)

| # | Precondition | Verify with | Expected | Status 2026-11-09 |
|---|---|---|---|---|
| P1 | Legacy freeze intact | `node tools/check-legacy-freeze.mjs` | `Legacy freeze intact`, exit 0 | **PASS** (re-measured: 624 allowlisted branch changes) |
| P2 | Contracts valid for the exact commit | `node tools/verify-contracts.mjs` | `contracts valid: …`, exit 0 | **PASS** (8 contracts / 8 fixtures / 9 content / 12 rendered / 7 schema) |
| P3 | Rebuild gates green **on the exact cutover commit** | CI `Rebuild Workbench` (`.github/workflows/rebuild.yml` jobs `workbench`, `rebuild`); local `cd rebuild && npm run lint && npm run typecheck && npm run typecheck:ts6 && npm run test:coverage` | all green | **GREEN at the final integration snapshot `53cda7b`**: 127 files / 1077 tests passed (9 skipped), coverage thresholds met, TS7+TS6 0, ESLint 0 errors (11 documented warnings), prettier clean (`../checkpoints/2026-11-09-waves-7-8.md` Wave 9 l.126-128). Re-run CI for the exact cutover commit and record the run id |
| P4 | **Final parity matrix acceptable** | `node tools/parity/matrix.mjs --legacy-url <u> --rebuild-url <u> --wave 9 --out tools/parity/output/matrix`; compare with the recorded `tools/parity/output/w9-matrix-final5/` | `matrix-summary.json` + `MATRIX.md`; no unexplained diffs | **RECORDED — CONDITIONAL**: 46 rows = 35 PASS / 5 reviewed ALLOWED / 6 FAIL, all failures **mobile-only** (gallery mobile capture-pagination text delta; admin/admin-login mobile chrome pixels). Desktop and every non-mobile row green. **Not mobile green** — deploy requires the owner to accept the documented residual bundle (`../CUTOVER.md` §2.3/U16) or order a pre-switch fix. Prerender-aware matrix run against the production build remains a follow-up (U15) |
| P5 | Wave 8 artifacts drift-free + budgets/perf green | `cd rebuild && npm run build:seo:check`, `node scripts/check-budgets.mjs --mode baseline`, `node ../tools/perf/bundle.mjs --check` | exit 0 each | **PASS at `53cda7b`**: initial **160.14 KiB gz / 180**; public routes **≤118.94 / 120**; admin 116.41; total 411.83 (informational 450). Runtime **LCP 920–1092 ms ≤2000 / CLS 0.0000–0.0010 ≤0.05**, all 6 cells PASS (`../checkpoints/2026-11-09-waves-7-8.md` l.105-109; `tools/perf/output/before-after-wave8.md` FINAL) |
| P6 | Production schema/RLS/RPC reconciliation report | read-only diff vs `contracts/schema/*` (`../audit/A3-data.md:171-186`; `DATA_CUTOVER.md` §5 Phase 0) | no divergence, or accepted list | **UNVERIFIED** — no production access was used |
| P7 | Backup created + restore drill passed | `BACKUP_RESTORE.md` §2–§3 | dump checksum + restore-into-scratch + RTO recorded | **NOT DONE** |
| P8 | Owner authorisation recorded | `CUTOVER.md` §6 | A1 DNS switch, A2 production migration, A3 prod data writes (+ others) approved | **NOT YET** |
| P9 | Rollback rehearsal passed | `ROLLBACK.md` §6 | evidence bundle recorded | **NOT DONE** |

Do not deploy while the P4 mobile-residual acceptance, P6, P7, P8 or P9 are open.

## 2. What actually deploys (two sites, one repo)

| Site | Config | Build command | Publish dir | State |
|---|---|---|---|---|
| Legacy production (`www.theporadas.com`) | root `netlify.toml` (frozen; read-only) | `npm run verify:env && npm run build` (`netlify.toml:3`) | `dist` | live, serves the archive today |
| Greenfield (staging → production at switch) | `rebuild/netlify.toml` (committed; **not deployed yet**, line 5) — Netlify **base directory must be `rebuild`** | `npm run build:prod` (`rebuild/netlify.toml:65-67`) | `dist` relative to base (`rebuild/dist`) | no greenfield Netlify site exists yet (`UNVERIFIED`; verify `netlify sites:list` with owner session — CUTOVER OD-11) |

Pipeline as delivered (measured commands from `rebuild/package.json:12,24-29`):

- **Parity/preview build**: `npm run build` (= `vite build`). Emits the frozen static head byte-for-byte,
  no prerender/PWA layer — this is what keeps the parity text gate green (`rebuild/netlify.toml:11-13`).
- **Production build**: `npm run build:prod` = `vite build && npm run build:seo`.
  - `build:seo` = `node scripts/generate-sitemap.mjs && node scripts/prerender.mjs` — writes
    `public/{sitemap.xml,robots.txt,manifest.webmanifest,sw.js}`, then **12 prerendered HTML route files**
    (`rebuild/package.json:24-26`; `../checkpoints/2026-11-09-waves-7-8.md:26-28`).
  - `build:seo:check` = the same two scripts with `--check`; CI fails on drift/tamper
    (`.github/workflows/rebuild.yml:138-140`).
- **PWA/install layer**: production-only, gated by `VITE_ENABLE_PWA=1` (`rebuild/netlify.toml:35-40,69-75`;
  `rebuild/src/app/pwa.ts:15,25-28`). Parity/preview builds must **not** set it.
- **Budgets**: `node scripts/check-budgets.mjs --mode baseline --report-json perf/last-budget-report.json`
  (CI `rebuild.yml:142-144`); targets in `rebuild/perf/budgets.baseline.json`.
- **Cutover checkers (read-only)**: `node ../tools/cutover/check-data.mjs --ignore-known` and
  `node ../tools/cutover/check-migrations.mjs` (CI `rebuild.yml:146-150`).
- **Edge OG**: `gallery-share` stays at the repository root (`netlify/edge-functions/gallery-share.ts`,
  `rebuild/netlify.toml:49-55`); a base-`rebuild` site must keep that directory in sync (Lead decision,
  CUTOVER OD-11).

## 3. Environment

Use `ENVIRONMENT.md` §2–§5 as the checklist. Greenfield site minimum: `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`, `VITE_SITE_URL` (staging origin first, final origin only at the switch), and at
production `VITE_MEDIA_BASE_URL=https://media.wedding.theporadas.com`. Production-only:
`VITE_ENABLE_PWA=1` (build flag, not a runtime secret). Sentry/GA stay unset until the owner approves the
privacy posture (CUTOVER OD-9); if set, telemetry is consent-gated and PII-scrubbed
(`rebuild/src/app/seo/telemetry.ts:1-25`). Never place `R2_*`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_ACCESS_TOKEN` or `SENTRY_AUTH_TOKEN` in a `VITE_*` variable.

## 4. Preview / staging deploy

Performed by the Lead/owner with their Netlify session (`netlify-cli/24.0.1` present on this workstation;
no command executed here):

```bash
cd rebuild
netlify link                                        # link to the greenfield site (owner session)
netlify build                                       # optional local build with the site env
netlify deploy --build --context deploy-preview     # draft deploy URL (no VITE_ENABLE_PWA unless intended)
```

Verification after the deploy returns its URL (all read-only):

| Check | Command | Expected evidence |
|---|---|---|
| Site up + headers | `curl -sSI <deploy-url>/` | 200; `X-Frame-Options: DENY`, HSTS, CSP present (`rebuild/netlify.toml:84-145`) |
| Prerendered metadata | `curl -s <deploy-url>/film` (and `/gallery`, `/guestbook`) | per-route `<title>`/canonical/OG from `rebuild/src/app/seo/routeMeta.json`; `/admin/*`, `/guest/*` noindex |
| SEO/PWA drift | `cd rebuild && npm run build:seo:check` | exit 0, no diff vs committed `rebuild/public/*` |
| Budgets | `cd rebuild && npm run perf:budgets` (after a prod build) | no violations (`rebuild/perf/budgets.baseline.json`) |
| Cutover checkers | `node tools/cutover/check-data.mjs --ignore-known && node tools/cutover/check-migrations.mjs` | exit 0 both (R17 gate still exits 1 **by design** until D-01) |
| Routes | `curl -sSI <deploy-url>/gallery /film /guestbook /upload /guest-photos /print /activity /admin/login` | 200 SPA; unknown path serves the 404 shell |
| Edge OG | `curl -sSI "<deploy-url>/gallery?share=<fixture-id>"` | OG rewrite by `gallery-share` (needs the function deployed on the greenfield site — `UNVERIFIED` until wired) |
| PWA (production build only) | fetch `/manifest.webmanifest`, `/sw.js` | 200; manifest `Content-Type: application/manifest+json`; `sw.js` `no-store` (`rebuild/netlify.toml:120-145`) |
| Runtime perf | `node tools/perf/run.mjs --serve-dist rebuild/dist --check` (Lead runs builds; harness is measurement-only) | LCP ≤ 2.0 s, CLS ≤ 0.05 (`QUALITY_BAR`); committed gate evidence in checkpoint l.33/l.64 |
| E2E/axe | `cd rebuild && npm run test:e2e` (Playwright webServer runs a build → **Lead-owned**) | 9/9 shell/a11y (`../checkpoints/2026-11-09-waves-7-8.md:65`) |
| Parity against preview | `node tools/parity/compare.mjs --legacy-url http://127.0.0.1:4174 --rebuild-url <deploy-url> --routes priority --matrix all --themes dark,light --wave 9 --out tools/parity/output/cutover-preview` | exit 0; record summary |

## 5. Production promote + DNS/Netlify switch (owner-authorised sequence)

Only after §1 P1–P9 are green and the owner has signed `CUTOVER.md` §6.

1. **Owner authorisation recorded** (CUTOVER §6). No step below runs without it.
2. **Freeze production writes.** The frozen app has no maintenance flag (`../audit/A3-data.md:463-471`):
   choose a short read-only window (revoke anon INSERT policies + block the upload function) or an
   accepted replication window with guest writes paused. Production data-write action → **owner-only
   (A3/A4)**.
3. **Record the baseline**: legacy deploy commit == freeze tag; production row counts/checksums;
   R2 object listing + ETag manifest (`BACKUP_RESTORE.md` §2; `DATA_CUTOVER.md` §8).
4. **Backup** DB + storage manifests off-repo, encrypted (`BACKUP_RESTORE.md` §2). Restore drill result
   from P7 must already be recorded.
5. **Apply additive migrations only** (`ROLLBACK.md` §3; `DATA_CUTOVER.md` §5): baseline additive set →
   D-01 R17 repair → decided D-02 RLS bundle → backfill/validation. Production migration → **owner-only
   (A2)**.
6. **Promote the prod build** (`npm run build:prod` artifacts; PWA flag set on the production site) and
   attach the custom domain in Netlify, then switch **Cloudflare DNS** → **owner-only (A1)**.
7. **Post-switch verification** (§4 checks against the production URL + `ops/BACKUP_RESTORE.md` §4
   queries), re-enable guest writes, record the switch time, keep legacy + R2 read-only for the
   rollback window.
8. **Do not decommission legacy** or delete Netlify deploys/R2 objects until the rollback window closes
   (CUTOVER OD-10).

DNS/Netlify prerequisites (owner-side; `UNVERIFIED` here):
Cloudflare owns DNS (`docs/archival/DEPLOYMENT_CHECKLIST.md:5-12`); `media.wedding.theporadas.com`
worker route untouched; certificate issued **before** the flip; TTLs lowered ≥30 min before the window
(values dashboard-only); `wedding.theporadas.com → www` 301 preserved (`netlify.toml:13-18`,
`rebuild/netlify.toml:77-82`); verify with `netlify domains:list` / dashboard and `dig +short
www.theporadas.com` before/after.

## 6. Per-step verification matrix (record output as evidence)

| Step | Command | Expected |
|---|---|---|
| Freeze clean | `node tools/check-legacy-freeze.mjs` | exit 0, "Legacy freeze intact" |
| Contracts | `node tools/verify-contracts.mjs` | exit 0 |
| Rebuild gates | CI run for the cutover commit (or local lint/typecheck/ts6/test:coverage) | all green |
| Prod build + SEO drift | `cd rebuild && npm run build:prod && npm run build:seo:check` | exit 0; 12 prerendered files |
| Budgets | `cd rebuild && npm run perf:budgets` | no violations |
| Perf | `node tools/perf/run.mjs --serve-dist rebuild/dist --check` | LCP ≤2.0 s, CLS ≤0.05 |
| Cutover checkers | `node tools/cutover/check-data.mjs --ignore-known`; `check-migrations.mjs` | exit 0 both; `--expect-r17-fixed` only after D-01 |
| Parity matrix | `node tools/parity/matrix.mjs --legacy-url <u> --rebuild-url <u> --wave 9 --out tools/parity/output/matrix` | exit 0 or documented residuals; compare with the recorded `tools/parity/output/w9-matrix-final5/` (35 PASS / 5 ALLOWED / 6 mobile-only FAIL); record the owner's U16 acceptance |
| Deployed headers | `curl -sSI https://www.theporadas.com/` | HSTS/CSP/XFO present |
| Deployed OG | `curl -s https://www.theporadas.com/` + inspect `og:image` | real `/images/og-image.webp` (R21 resolved in rebuild) |
| Sitemap | `curl -s https://www.theporadas.com/sitemap.xml` | 6 indexable entries, no `/people` (`rebuild/scripts/generate-sitemap.mjs`) |
| Admin noindex | `curl -s https://www.theporadas.com/admin/login` + inspect | noindex prerendered shell |
| Rollback ready | `ROLLBACK.md` §6 evidence bundle | deploy IDs + dump checksum recorded |

## 7. Stop / abort conditions

Abort and roll back (`ROLLBACK.md`) on: priority-1 route smoke failure post-switch; unexplained parity
difference at the production URL; DNS/certificate failure; unexpected migration verification counts;
unverifiable backup; two independent post-switch check failures. Escalation in `CUTOVER.md` §7.

## 8. What this page is not

Not authorisation to deploy; it records no real site IDs, tokens, or DNS values beyond the historical
deploy IDs in `docs/archival/RELEASE_RECOVERY_2026-07-05.md:9-16`. Those values are `UNVERIFIED` on
purpose and must come from the owner in the window.
