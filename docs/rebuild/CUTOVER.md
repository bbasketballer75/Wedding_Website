# CUTOVER — Wave 9 readiness package

**Status: NOT READY TO CUT OVER.** This package records the measured state of the rebuild against the
frozen oracle, the remaining work, the risks, and the **owner decisions and authorisations** required.
Documentation only: nothing here was executed against production, DNS, Netlify, Supabase, or R2.

Measured snapshot: **2026-11-09 ~19:05 local** (`rebuild/greenfield` @ `3deee67`, 2026-11-08 14:29).
Numbers are copied from the cited artifacts; every `IN FLIGHT` / `UNVERIFIED` item is defined below
with its verification step. The parity matrix is a status table, not a promise: text drift always
fails (`PARITY.md` §3-4), pixels must be 0 or covered by a reviewed, unexpired allowlist entry.

## 1. Parity matrix status (measured artifacts only)

Priority-1 routes are the hard gate (`contracts/routes.json`: `home`/`film`/`gallery`/`upload`/
`guestbook`/`guest-photos`); priority 2/3 routes are required for the sweep. Evidence paths are
relative to `tools/parity/output/`.

| Route | P | Last measured run (artifact) | Result | Cover | Valid for the Wave-9 gate? | Gap / next action |
|---|---|---|---|---|---|---|
| `/` home | 1 | `w4-home-final2/summary.json` @2026-11-08T19:05Z | **allowed ×4** (0 text diffs; 0.12–0.23% backdrop/raster phase, page height identical) | 4/4 shots | **No** — the 4 allowlist entries have `expiresAtWave: 8` (`contracts/parity-allowlist.json:11-42`), so at wave 9 they are expired | Wave 8 edge/raster pass: retire them or re-enter with fresh measured evidence; re-run at wave 9 |
| `/film` | 1 | `run2/summary.json` @2026-11-08T18:20Z | **pass** (desktop/dark; 0 text diffs) | 1/6 shots | **No** — only desktop/dark measured since Wave 1; the film entry (`expiresAtWave: 2`) is expired by policy | Freeze the video-overlay capture (or accept 0-px evidence), then measure all 6 shots at wave 9 |
| `/gallery` | 1 | `w9-gallery-wire/summary.json` @2026-11-09T23:59Z | **FAIL — text** (`changedPixelRatio` 0.174; text diff file `w9-gallery-wire/text/diff/gallery__desktop__dark.json`) | 1/1 shot (desktop/dark) | **No** | Rebuild renders **25 visible/25 photos vs legacy 30/30**, and the image/caption set is offset (`First look on the lawn…` vs `A closer look at the ring…`). Gallery data wiring is in the working tree, uncommitted (see §3). Finish wiring, then measure all 4 shots |
| `/upload` | 1 | `w6-pages2/summary.json` @2026-11-08T19:11Z | **pass** (desktop/dark) | 1/4 shots | **No** — only 1 shot at Wave 6; other viewports/themes unmeasured | Measure all 4 shots at wave 9 |
| `/guestbook` | 1 | `w6-pages/summary.json` @2026-11-08T19:08Z | **pass** (desktop/dark) | 1/4 shots | **No** — 1 shot only; the checkpoint says "parity run pending" (`../checkpoints/2026-11-09-waves-2-6.md:40`) | Measure all 4 shots at wave 9 |
| `/guest-photos` | 1 | `w6-pages2/summary.json` @2026-11-08T19:11Z | **FAIL — pixel** (0 text diffs) | 1/4 shots | **No** | Known: page is still driven by Wave-6 stub fixtures (`../checkpoints/2026-11-09-waves-2-6.md:43`); wire `shared/data/guestUploads` + `shared/media`, then measure all 4 |
| `/activity` | 3 | `w6-activity/summary.json` @2026-11-08T19:13Z | **pass** (desktop/dark; 0 text diffs) | 1/4 shots | **No** — 1 shot; stale-metadata fix is Wave 8 (see §3) | Finish Wave 8 metadata fix, then measure 4 shots |
| `/guest/:token` | 2 | `w6-pages2/summary.json` @2026-11-08T19:11Z | **FAIL — pixel** (0 text diffs) | 1/4 shots | **No** | Stub fixtures still drive photos/notes (`../checkpoints/2026-11-09-waves-2-6.md:43`); wire `shared/data/claims` + lightbox slot, then measure 4 shots |
| `/print` | 2 | none in `tools/parity/output` (`summary.json` scan: print selected but never captured) | checkpoint-only claim: "parity PASS 0.000%" (`../checkpoints/2026-11-09-waves-2-6.md:27`) | 0/2 shots | **No** | Re-capture with the current build (light theme only, per `contracts/routes.json:141-151`) and attach `summary.json` |
| `/admin/login`, `/admin/*` | 2 | none in `tools/parity/output` (`summary.json` scan shows no admin shots) | 58 admin tests passed in Wave 7 (`../checkpoints/2026-11-09-waves-2-6.md:47`), committed `3deee67`; **no parity artifact** | 0/8 shots | **No** | Capture with `contracts/fixtures/adminSession.json` (mock admin session) or have the owner sign a documented parity exemption; admin is noindex/private |
| 404 (`/people` etc.) | 3 | `w2-404/summary.json` @2026-11-08T18:11Z | **pass 4/4** (0 text diffs, 0 changed px) | 4/4 | **Yes for this run**, but it predates Waves 3–7 | Re-run at wave 9 (cheap) and keep the artifact |

Harness provenance (so the table is interpretable): the Wave-0 self-proof passed 5/5 checks, including
a perturbed-capture detection (410,265 px) and legacy-vs-legacy 0-px runs
(`../checkpoints/2026-11-08-wave-0.md:87-101`; artifacts in `selfcheck-reduced/`). The harness itself is
trusted; the matrix above is not yet green.

## 2. Gate status (checkpoints / measured artifacts)

| Gate | Recorded value | Evidence | Status today |
|---|---|---|---|
| Legacy frozen oracle | tag `legacy-freeze-2026-11-08` → `dd0cf48`; freeze checker intact at Wave 0/1 | `../checkpoints/2026-11-08-wave-0.md:16`; `../RISK_REGISTER.md:42-48` | **RED now (transient)**: `node tools/check-legacy-freeze.mjs` → exit 1, `Legacy freeze VIOLATED: 2 path(s)` — untracked root logs `logs-legacy-serve.txt`, `logs-rebuild-serve.txt`. Move them out of the repo and re-run; not a legacy edit |
| Contracts | `contracts valid: 8 json contracts, 8 fixtures, 9 content files, 12 rendered routes, 7 schema artifacts` | `node tools/verify-contracts.mjs` (measured 2026-11-09, exit 0) | PASS |
| Legacy app gates (oracle baseline) | tsc 0, tsc6 0, ESLint 0, 42 files / 346 tests | `contracts/baseline/metrics.json` `gates`; `../checkpoints/2026-11-08-wave-0.md:134-151` | PASS at freeze (baseline) |
| Rebuild gates, last recorded green | 81 files / 645 tests; coverage 88.5 / 79.6 / 88.6 / 90.2; TS7+TS6 clean; build green | `../checkpoints/2026-11-09-waves-2-6.md:50-54` | **Historic**; repo-wide red was confined to in-flight W7-1 at that checkpoint |
| Rebuild gates at HEAD `3deee67` | — | Wave 7 committed after the checkpoint; no Wave 7 checkpoint exists (`docs/rebuild/checkpoints/` has wave 0, wave 1, waves 2–6 only) | **UNVERIFIED** — verify: CI `Rebuild Workbench` run for `3deee67`, or `cd rebuild && npm run lint && npm run typecheck && npm run typecheck:ts6 && npm run test:coverage` (Lead-owned heavy gate) |
| Wave 1 shell a11y | 9/9 Playwright tests; light 0 violations at 1440+390; dark only documented R27 contrast | `../checkpoints/2026-11-09-waves-2-6.md:12` | Historic pass; re-run in Wave 8/9 |
| Parity harness self-check | 5/5 pass, 0 changed pixels twice, perturbed capture detected | `../checkpoints/2026-11-08-wave-0.md:87-101` | PASS (harness provenance) |

## 3. Wave 8 / Wave 9 completion tracker (IN FLIGHT — observed 2026-11-09)

Wave 8 (SEO/PWA/perf/infra) and Wave 9 (cutover readiness) were interrupted by a provider-credit
outage. The working tree contains **uncommitted** Wave 8/9 artifacts; they are IN FLIGHT, not shipped.
Measured with `git status --short` at ~19:05 local:

| Item | Evidence in working tree | State |
|---|---|---|
| Greenfield Netlify config | `rebuild/netlify.toml` (untracked; 133 lines: build/publish, redirects, edge function, headers) | IN FLIGHT — not deployed, not committed |
| SEO artifact generator | `rebuild/scripts/generate-sitemap.mjs` + `rebuild/public/{sitemap.xml,robots.txt,manifest.webmanifest,sw.js}` (untracked) | IN FLIGHT — build pipeline **not wired**: `rebuild/package.json:12` is still `"build": "vite build"` |
| Prerender | `rebuild/scripts/prerender.mjs`, `rebuild/src/app/seo/routeMeta.json`, `rebuild/index.html` (modified, `seo:start/end` markers) | IN FLIGHT — not wired into build; `--check` modes exist |
| Real OG image | `rebuild/public/images/og-image.webp` + `.png` (untracked) | IN FLIGHT — addresses R21 for the rebuild; frozen `index.html` still points at the missing legacy file until cutover |
| PWA | `rebuild/public/manifest.webmanifest`, `sw.js`, real icons under `rebuild/public/images/icons/` | IN FLIGHT — generated files exist; no `vite-plugin-pwa`/SW registration in `rebuild/vite.config.ts:1-29` yet |
| Perf harness | `tools/perf/bundle.mjs` + `tools/perf/lib/*` (untracked; budgets from `QUALITY_BAR.md:42-48`) | IN FLIGHT — no measured rebuild budget artifact in the repo yet |
| Cutover checkers | `tools/cutover/lib.mjs` (untracked; read-only helpers for migrations/media/manifest checks) | IN FLIGHT — entrypoint checkers not written yet |
| Gallery/guest data wiring | `rebuild/src/app/router.tsx` (modified), `rebuild/src/app/routes/gallery-data.ts`, `rebuild/src/features/gallery/{curated-photos.ts,fixtures.ts,PhotoGrid.tsx}`, `rebuild/src/shared/media/*` (untracked) | IN FLIGHT — the `w9-gallery-wire` run is from this state and still fails text parity |
| Stale-metadata fixes (`/activity`, `/admin/*`) | `rebuild/src/app/seo/routeMeta.json` "wave8-fix" entries (untracked) | IN FLIGHT — intentional difference from the frozen defect; needs owner acceptance (OD-6) |

Consequence: the "Wave 8 done" precondition (SEO/PWA/headers/perf + measured budgets) **cannot be
checked off yet**, and the final parity matrix **cannot be run** until these changes are committed,
wired, and rebuilt by the Lead.

## 4. Remaining risks and gaps (live register subset, with cutover impact)

| Risk | Cutover impact | Current state / evidence |
|---|---|---|
| R2 prod schema drift (local baseline ≠ production) | BLOCKER without read-only reconciliation | `../RISK_REGISTER.md:8`; reconciliation checklist `../audit/A3-data.md:171-186`; **not done** (no prod access) |
| R16 migration repair | Resolved locally (31/31 apply, identical dumps) | `../RISK_REGISTER.md:22`; `contracts/schema/INVENTORY.md:15-30` |
| R17 guestbook rate-limit bypass | The fix must ship **with** the cutover migration; never test by writing to prod | `../RISK_REGISTER.md:23`; fix described in `../audit/A3-data.md` §5 |
| R18 claims pseudo-verification | Product/security decision must close before claims are exposed | `../RISK_REGISTER.md:24`; A4 §9.4 |
| R19 upload-status lookup by email | Privacy decision before guest uploads are advertised | `../RISK_REGISTER.md:25`; A4 §9.5 |
| R20 guestbook reaction races | Rebuild model chosen in the data layer; owner awareness | `../RISK_REGISTER.md:26` |
| R21 broken static OG image | Share previews broken for non-JS crawlers until fixed | `../RISK_REGISTER.md:27`; rebuild fix IN FLIGHT (§3) |
| R22 media completeness is DB-driven | BLOCKER until every DB media URL is enumerated and verified resolvable | `../RISK_REGISTER.md:28`; media CONTRACT §7 |
| R23 parity coverage narrower than product | Interactive states (lightbox, claims, admin) not captured | `../RISK_REGISTER.md:29`; §1 above |
| R13 media end-state undecided | Blocks T-0 media plan/retention | `../RISK_REGISTER.md:19`; OD-12 |
| R8 cutover outage/data loss | Mitigated only by rehearsal + backup | `../RISK_REGISTER.md:14`; `ops/ROLLBACK.md`, `ops/BACKUP_RESTORE.md` |
| R25/R27/R28 inherited visual/a11y defects | Reproduced for parity; fixing is a visual change | `../RISK_REGISTER.md:31-34`; OD-14 |
| R14 Node/npm drift | Local Node 26 vs CI/Netlify Node 22 | `../RISK_REGISTER.md:20`; `ops/ENVIRONMENT.md` §1-§3 |
| In-flight workspace state | Freeze checker currently red from stray logs; concurrent agents touching the tree | §2 above; freeze must be clean before any gate counts |

## 5. Open owner decisions (the decision table this package exists for)

Suggested defaults are technical input, **not decisions**. Linked evidence is authoritative.

| ID | Decision | Options | Why the owner | Suggested default (input only) | Blocks |
|---|---|---|---|---|---|
| OD-1 | Claims verification model | honest admin-moderated queue / real Supabase OTP+RLS / retire claim wizard before cutover | trust + user-facing security promise (`../RISK_REGISTER.md:24`; A4 §9.4) | honest queue now, real verification later | claims exposure, cutover sign-off |
| OD-2 | Guest upload status lookup by email | keep / gate behind magic-link or share token / remove panel | guest privacy (`../RISK_REGISTER.md:25`; A4 §9.5) | gate/remove | upload launch messaging |
| OD-3 | Guestbook reaction persistence | rebuild's append-only/RPC model (Lead-decided) vs frozen last-write-wins | data semantics change (`../RISK_REGISTER.md:26`) | accept rebuild model | guestbook data contract |
| OD-4 | Retired features: music / quiz / gallery map / sort / timeline views | restore / drop + amend contract | product scope; contract text still lists some (`PRODUCT_CONTRACT.md:44`; A4 §9.1-3,7) | drop, amend wording | parity scope sign-off |
| OD-5 | `/people` (sitemap ghost vs 404) | keep 404 + sitemap without it / restore People page | SEO + product (`contracts/routes.json:153-162`; A4 §9.6) | keep 404 (rebuild sitemap already omits it, IN FLIGHT) | final sitemap |
| OD-6 | Stale metadata on `/activity` + `/admin/*` | fix (intentional difference + allowlist) / preserve frozen defect | SEO/privacy vs parity policy (`contracts/routes.json:95,126`; A4 §9.8) | fix; record allowlist exception | Wave 9 parity verdict |
| OD-7 | Print vendor integration | keep clipboard-then-vendor flow / reduce to plain download | owner workflow (A4 §9.9) | keep frozen flow | `/print` scope |
| OD-8 | Real OG image | ship `og-image.webp` and update static tags (IN FLIGHT) | share-preview content (`../RISK_REGISTER.md:27`) | ship it | R21 closure |
| OD-9 | Analytics/Sentry posture | enable both / Sentry only / neither; reuse legacy project or new | privacy + ops (`ops/ENVIRONMENT.md` §2; `../plans/2026-11-08-workbench.md:100-105`) | enable, reuse project, PII redaction | Wave 8 metadata/infra, privacy sign-off |
| OD-10 | Legacy retention after cutover | keep read-only N days / decommission; external worktrees salvage/delete | cost + safety (`../RISK_REGISTER.md:15,21`) | keep ≥1 rollback window, then archive | rollback window, R9 |
| OD-11 | Hosting topology | new greenfield Netlify site with base `rebuild` / convert the existing site | deploy mechanics (`rebuild/netlify.toml:1-7`; `ops/DEPLOY.md` §2) | new staging site → promote at switch | Wave 8 deploy wiring |
| OD-12 | Media end-state + backup cadence | keep R2 as origin / migrate; provider backups only vs independent dumps; retention | longevity/cost (`../RISK_REGISTER.md:19,28`; `ops/BACKUP_RESTORE.md` §5) | keep R2, independent dumps | T-0 media plan |
| OD-13 | Legacy URL policy | redirects acceptable? keep all frozen paths? | canonical URLs are contract-level (`PRODUCT_CONTRACT.md:61-67`) | keep every frozen path, redirect aliases | sitemap/redirects |
| OD-14 | Post-cutover visual/a11y fixes | fix font fallback, R27/R28 contrast now or after cutover | visual identity changes need approval (`../RISK_REGISTER.md:31-34`) | after cutover, new baselines | parity scope |
| OD-15 | Maintenance window | date, length, write-freeze method (no maintenance flag exists, `../audit/A3-data.md:463-471`) | owner availability + risk tolerance | short read-only window, pre-announced | T-0 execution |

## 6. Go / No-Go checklist

| # | Gate | Status today | Closing action |
|---|---|---|---|
| G1 | Parity matrix green on every route (0 unexplained text/pixel diffs; no expired allowlist entries) | **NO** (§1) | finish data wiring + Wave 8 raster fixes; run `compare.mjs --routes all --matrix all --themes dark,light --wave 9` |
| G2 | Rebuild gates green on the exact cutover commit | **UNVERIFIED** (§2) | CI run / Lead gate run recorded |
| G3 | Wave 8 complete: SEO/prerender/PWA/headers/perf measured and drift-checked | **IN FLIGHT** (§3) | commit + wire `build:seo`, run `--check` modes, record `tools/perf/bundle.mjs` output |
| G4 | Owner decisions OD-1…OD-15 closed and recorded | **NO** (§5) | owner sign-off in the approval record |
| G5 | Production schema/RPC/policy reconciliation report approved | **NO / UNVERIFIED** | operator read-only diff vs `contracts/schema/*` in the window (`../audit/A3-data.md:171-186`) |
| G6 | Backup created, checksummed, and restore drill passed with RTO recorded | **NO / UNVERIFIED** | `ops/BACKUP_RESTORE.md` §2-§3 |
| G7 | Media completeness proven (every DB media URL resolves; originals byte-identical) | **NO / UNVERIFIED** | media CONTRACT §7 sweep; R22 |
| G8 | Security fixes/decisions closed (R17 shipped, R18/R19 decided, RLS fixes applied additively) | **NO / UNVERIFIED** | migration content review + owner sign-off |
| G9 | Rollback rehearsal passed on preview/staging with evidence | **NO** | `ops/ROLLBACK.md` §6 |
| G10 | Owner authorisation record signed (§7) | **NO** | §7 template |

**Verdict: NO-GO.** Earliest credible path: close G1–G10 in order; G1/G3 are the long poles.

## 7. Owner MUST authorise (non-delegable)

These are production mutations; neither the Lead nor any agent may perform them without a recorded
owner authorisation. Each is a separate approval — one does not imply the others.

| # | Authorisation | Scope | Where the mechanics live |
|---|---|---|---|
| **A1** | **DNS switch** | change Cloudflare DNS / attach `www.theporadas.com` (and apex/`wedding.*` behaviour) to the greenfield Netlify site | `ops/DEPLOY.md` §5 |
| **A2** | **Production migration** | apply additive/squashed SQL to the production Supabase project (`zaczcyzvavetgfuucljf`) | `ops/ROLLBACK.md` §3; `../audit/A3-data.md` §9.3 |
| **A3** | **Production data writes** | any backfill/UPDATE/DELETE, RLS policy change, restore-into-production, `download_url` population | `ops/BACKUP_RESTORE.md` §3, §6; `ops/ROLLBACK.md` §3 |
| A4 | Maintenance window + write freeze | start/end time; how guest writes are frozen (no flag exists) | `../audit/A3-data.md:463-471` |
| A5 | Legacy retention/decommission | how long the frozen deploy/R2 stay read-only; worktree salvage/delete | OD-10; `../RISK_REGISTER.md:15` |
| A6 | Media/CDN config changes | R2 lifecycle/keys, Worker versions, cache purge | `ops/ROLLBACK.md` §4 |
| A7 | Secret rotation | Supabase/R2/Sentry/Netlify/Cloudflare keys | `ops/ENVIRONMENT.md` §4 |
| A8 | Analytics/Sentry enablement | DSN/project reuse, PII posture, retention | OD-9 |

Authorisation record (fill at the window; store with the checkpoint, not in git if it contains URLs):
`authorised by: ___ | date/time: ___ | A1 __ A2 __ A3 __ A4 __ A5 __ A6 __ A7 __ A8 __ |
scope/notes: ___ | rollback owner: ___ | window start/end: ___`.

## 8. Escalation and abort

- **Owner** is the only approver for §7. **Lead** executes and owns the final diff/gates.
- **Abort immediately** (and roll back per `ops/ROLLBACK.md`) if: any priority-1 route fails post-switch
  smoke; a migration verification query returns an unexpected count; the backup cannot be verified;
  DNS/certificate issuance fails; two independent post-switch checks fail; or any data-loss signal appears.
- Keep the legacy deploy + R2 **read-only and available** for the whole rollback window. Do not delete
  Netlify deploys, R2 objects, or the frozen tag during the window.
- Monitoring during the window: public smoke via `curl`/`scripts/verify-deployed-site.js`, Sentry (if
  enabled), the uptime workflow (`.github/workflows/uptime-monitor.yml`, 5-minute cron on `main`), and
  the parity harness after the switch.
- Incident comms channel/status page: **no repo evidence → UNVERIFIED**; owner names the channel in
  the authorisation record.

## 9. What this package is not

It is not a deploy plan execution, not a production audit (no production read was performed), and not
a substitute for the owner's authorisation. Runbooks: [ops/ENVIRONMENT.md](./ops/ENVIRONMENT.md),
[ops/DEPLOY.md](./ops/DEPLOY.md), [ops/ROLLBACK.md](./ops/ROLLBACK.md),
[ops/BACKUP_RESTORE.md](./ops/BACKUP_RESTORE.md). Contracts: [`contracts/`](../../contracts/README.md).
Parity rules: [PARITY.md](./PARITY.md). Risks: [RISK_REGISTER.md](./RISK_REGISTER.md).

---

## Lead status update — 2026-11-09 (Wave 8 landed)

Wave 8 is now **delivered** (the IN-FLIGHT tracker above is historical): prerender + sitemap/robots/
PWA artifacts + Netlify config + telemetry + media/budget tooling are committed and wired into CI;
the production build (`npm run build:prod`) passes `build:seo:check`, bundle budgets, e2e and runtime
perf (LCP 0.91–0.97 s, CLS 0.0000–0.0007 on `/`, `/gallery`, `/film` desktop+mobile). Gallery data
wiring closed the last public-page parity gap. See
`docs/rebuild/checkpoints/2026-11-09-waves-7-8.md` for the evidence table.

The NO-GO verdict above stays **provisional** until the final full-matrix parity sweep is recorded;
the owner decisions (OD-1…OD-15) and the non-delegable authorisation list are unchanged and still
require the owner. No production action has been taken.
