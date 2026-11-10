# CUTOVER — Wave 9 readiness package

**Status: ENGINEERING GATES GREEN, PARITY SIGN-OFF PENDING, NOT AUTHORISED.** The rebuild is now
measured, built, and documented; the final full-matrix parity sweep is still being recorded and the
owner decisions/authorisations below are still open. **Do not cut over from this page.**

Documentation only: nothing here was executed against production, DNS, Netlify, Supabase or R2.
Snapshot: branch `rebuild/greenfield` @ `056ae0c` (2026-11-09; Wave 8 committed), Wave 8 evidence is
committed in `docs/rebuild/checkpoints/2026-11-09-waves-7-8.md`. Any number below cites the committed
checkpoint or a named artifact; items that cannot be verified from the repo are `UNVERIFIED` with the
step that closes them.

## 1. Delivered engineering evidence (Wave 7 + Wave 8)

Source: `checkpoints/2026-11-09-waves-7-8.md` §"Gates at this checkpoint" (lines 53-68) unless noted;
the full checkpoint is the committed record.

| Gate | Result | Evidence |
|---|---|---|
| Unit tests | **121 files / 1015 passed, 9 skipped** (the 9 are the opt-in Supabase contract test) | checkpoint l.57 |
| Coverage | thresholds met (80 statements / 75 branches / 80 functions / 80 lines, `rebuild/vitest.config.ts`) | checkpoint l.58 |
| TypeScript | TS 7 **0 errors**, TS 6 **0 errors** | checkpoint l.59; CI `rebuild.yml:122-128` |
| ESLint | 0 errors (11 documented `react-refresh` warnings in the lazy route table) | checkpoint l.60; CI `rebuild.yml:114-116` |
| Prettier | clean | checkpoint l.60; CI `rebuild.yml:118-120` |
| Production build | `build:prod` + `build:seo:check` green; **12 prerendered route files** | checkpoint l.62; `rebuild/package.json:24-26` |
| Bundle budgets | initial **160.0 KiB gz / 180**; public routes **4.4–113.9 / 120**; total **394.4 / 450**; CSS **27.1 / 40** | checkpoint l.63; gate `rebuild/scripts/check-budgets.mjs`, baseline `rebuild/perf/budgets.baseline.json` (initial 163,825 B, CSS 27,795 B) |
| Runtime perf (prod build, slow-4G + CPU×4) | **LCP 0.91–0.97 s ≤ 2.0**; **CLS 0.0000–0.0007 ≤ 0.05** on `/`, `/gallery`, `/film` desktop+mobile | checkpoint l.33, l.64; harness `tools/perf/run.mjs` |
| E2E shell/a11y | **9/9** (axe light 0 violations; dark critical 0 + documented R27 contrast) | checkpoint l.65 |
| SEO/PWA artifacts | `build:seo:check` drift gate green (sitemap/robots/manifest/sw + prerendered HTML) | checkpoint l.26-28; CI `rebuild.yml:134-140` |
| Legacy freeze | intact | checkpoint l.66; re-measured 2026-11-09: `node tools/check-legacy-freeze.mjs` → intact (624 allowlisted branch changes) |
| Contracts | 8 JSON contracts / 8 fixtures / 9 content files / 12 rendered routes / 7 schema artifacts valid | checkpoint l.67; re-measured 2026-11-09: `node tools/verify-contracts.mjs` exit 0 |
| Data/media cutover checkers | `check-data --ignore-known` → **0 mismatches, 0 warnings, 31 migrations** (exit 0); `check-migrations` → **0 mismatches** (exit 0) | re-measured 2026-11-09 from `tools/cutover/check-data.mjs` / `check-migrations.mjs`; detail `DATA_CUTOVER.md` §1 |
| CI | `rebuild.yml` now gates coverage, `build:prod`, `build:seo:check`, budgets and the read-only cutover checkers | checkpoint l.37; `.github/workflows/rebuild.yml:130-150` |

Wave 8 delivery detail (all committed): prerender (`rebuild/scripts/prerender.mjs`, `--check`),
sitemap/robots/manifest/sw (`rebuild/scripts/generate-sitemap.mjs`), Netlify config
(`rebuild/netlify.toml`), PWA runtime injection gated on `VITE_ENABLE_PWA=1`, consent-gated
analytics/Sentry (`rebuild/src/app/seo/telemetry.ts`), bundle gate (`rebuild/scripts/check-budgets.mjs`),
runtime-perf harness (`tools/perf/run.mjs`), media derivative pipeline
(`rebuild/scripts/media-optimize.mjs`, not yet consumed — see §3), and the read-only cutover checkers
(`tools/cutover/check-data.mjs`, `tools/cutover/check-migrations.mjs`).

Known-good parity spot check recorded in the same checkpoint: **`/gallery` desktop/dark — 0 text
diffs, identical page heights, 0.0137% pixel residual** (was 17.4% before data wiring), i.e. the last
public-page wiring gap closed. This is a spot check, **not** the final matrix (§2).

## 2. Final full-matrix parity sweep — PENDING Lead artifact

The final sweep is run by the Lead/parity-eng with the Wave-9 matrix runner and reported as one
artifact. **No parity numbers are recorded in this section until that artifact is supplied** (the
honesty rule: do not invent numbers).

Command shape (from `PARITY.md` §10.1):

```bash
node tools/parity/matrix.mjs \
  --legacy-url http://127.0.0.1:4174 \
  --rebuild-url http://127.0.0.1:4175 \
  --wave 9 --prerender \
  --out tools/parity/output/matrix
```

Expected artifact set (`PARITY.md` §10.1): `matrix-summary.json` (every row + counts + admin
capture/exempt details + prerender results), `MATRIX.md` (the status table), `README.md`,
`summary.json` / `report.html` / `shots/` / `text/`, `summary.partial.json` (resume state). Rows carry
route/path, viewport, theme, `pass|allowed|fail|error|exempt`, changed pixels + ratio, text-diff count,
legacy/rebuild page heights, and the first failure detail (`PARITY.md` §10.1).

Scope the matrix must cover before this package can sign off:

- all 12 contract routes (`contracts/routes.json`), each at its declared viewport/theme matrix
  (so `/print` is light-only, per `PARITY.md` §10.1 defaults);
- the 10 authenticated admin sections at both viewports/themes (`PARITY.md` §10.2), with captured vs
  exempt status recorded — an exempt row is **not** parity evidence;
- `--prerender` verification of served HTML metadata (`PARITY.md` §10.3: pass / pending / fail);
- the guest-share / guest-photos data adapters and lightbox slot wiring (the two guest routes are the
  last routes that were still stub-driven in the Wave 6 checkpoint; adapters were being wired in the
  working tree at this snapshot — confirm they are committed in the final matrix run).

| Placeholder — final matrix table | Fill from `matrix-summary.json` / `MATRIX.md` only |
|---|---|
| Route · viewport · theme | status | changed px / ratio | text diffs | page heights (legacy/rebuild) | artifact / first failure |
| _(all rows in the Lead-supplied matrix artifact)_ | — | — | — | — | — |

Exit-code authority: matrix exit `0` = pass, `1` = parity/prerender failure, `2` = harness/config
error (`PARITY.md` §10.1). A reviewed allowlist entry is the only way a pixel difference can be
accepted; text drift is never allowed (`PARITY.md` §3-4, §4). The current allowlist is
`contracts/parity-allowlist.json` — any surviving entry must have `expiresAtWave` beyond 9 and a
reason naming the wave that removes it.

## 3. Remaining gaps and `UNVERIFIED` items

| # | Gap | Status | Closing action / verification |
|---|---|---|---|
| U1 | **Final parity matrix** (incl. admin capture + prerender checks) | **PENDING** (Lead artifact) | record `matrix-summary.json` + `MATRIX.md`; fill §2; matrix exit 0 |
| U2 | **Guest-share / guest-photos data adapters + lightbox slot wiring** | adapters were being wired in the working tree at snapshot (`rebuild/src/app/routes/guest-*-api.ts` untracked); confirm commit + matrix rows | committed files + green matrix rows for `/guest-photos`, `/guest/:token` |
| U3 | **R17 guestbook rate-limit RPC** (D-01) | known pre-cutover defect; fix ships as an **additive cutover migration**; gate `check-migrations --expect-r17-fixed` exits 1 today **by design** | `DATA_CUTOVER.md` §1.3, §7 D-01; after migration: gate exits 0 |
| U4 | **A3 §6 RLS hardening bundle S1–S7** (D-02) | analysis complete; owner sign-off per behaviour-changing item (S2/S3/S4/S6) | `DATA_CUTOVER.md` §7 D-02; migrations reviewed before Phase 2 |
| U5 | **Media derivative pipeline** | `media-optimize.mjs` can generate AVIF/WebP derivatives but they are **not generated nor consumed**; parity requires byte-identical originals | post-cutover optimisation decision (checkpoint l.34; OD-12); `npm run media:plan` / `--check` |
| U6 | **Production schema/RLS/RPC reconciliation** | `UNVERIFIED` — no production read used; local baseline is the frozen chain, not proof of prod | Phase-0 read-only diff (`DATA_CUTOVER.md` §5 Phase 0; `audit/A3-data.md:171-186`) |
| U7 | **DB-driven media completeness (R22)** | repo checkers cover 610 code/contract references; `photos.url`/guest-upload URLs live only in the DB | owner exports them at Phase 0 and sweeps URLs (`DATA_CUTOVER.md` §9.3) |
| U8 | **Backup + restore drill** | **not done** | `ops/BACKUP_RESTORE.md` §2–§3; record dump SHA + RTO |
| U9 | **Rollback rehearsal** | **not done** | `ops/ROLLBACK.md` §6 (preview/scratch only) with evidence bundle |
| U10 | **Owner decisions / authorisations** | **open** | §5 + §7; record signed authorisation |
| U11 | **Interactive-state parity** (lightbox, claims, admin copy, error strings) | not covered by rendered-text snapshots (R23) | final matrix admin rows + documented parity scope decision (OD-4/OD-6) |
| U12 | **Newer perf artifact commit status** | `tools/perf/output/final-compressed.md` (a later run: all 6 cells PASS, LCP 0.94–1.12 s, CLS 0.0000–0.0010) was **untracked at this snapshot**; the committed gate evidence is the checkpoint | confirm the Lead commits it (or keep the checkpoint as the cited number) |
| U13 | **Hosting topology / Netlify site** | `UNVERIFIED` — no greenfield site exists; `rebuild/netlify.toml` says "not deployed yet" | OD-11; create staging site with base `rebuild`, then re-run §1 smoke |
| U14 | **DNS TTLs / certificate issuance** | `UNVERIFIED` (dashboard-only) | owner lowers TTLs ≥30 min before the window; certificate issued before the flip (`ops/DEPLOY.md` §5) |

## 4. Refresh of owner decisions OD-1…OD-15

Statuses: **Resolved** = evidence landed and no owner choice remains; **Decided-by-Lead / owner
ratification pending** = a Lead recommendation exists and needs the owner's explicit yes;
**Open** = no decision recorded. All are still part of the authorisation package.

| ID | Decision | Current status (2026-11-09) | Evidence / note |
|---|---|---|---|
| OD-1 | Claims verification model (R18) | Open — recommendation: honest admin-moderated queue | `RISK_REGISTER.md:24`; `DATA_CUTOVER.md` D-08 |
| OD-2 | Upload-status lookup by email (R19) | Open — recommendation: gate behind share token or remove | `RISK_REGISTER.md:25`; D-09 |
| OD-3 | Guestbook reaction model (R20) | Decided-by-Lead — rebuild uses RPC/append-only semantics; owner ratification pending | `RISK_REGISTER.md:26`; D-10 (Wave-6 follow-up) |
| OD-4 | Retired features: music / quiz / map / sort / timeline views | Open (product scope) | A4 §9.1-3,7; `PRODUCT_CONTRACT.md:44` |
| OD-5 | `/people` 404 vs restore | Decided-by-Lead (keep 404; sitemap already omits it) — owner ratification pending | `contracts/routes.json:153-162`; generated sitemap has 6 indexable entries |
| OD-6 | Stale metadata on `/activity` + `/admin/*` | Decided-by-Lead — **crawlable-only fix is implemented** (prerendered HTML corrected; hydrated tags frozen for parity honesty); owner should ratify the intentional difference | `checkpoints/2026-11-09-waves-7-8.md:29`; `PARITY.md` §11 "crawlable-only" |
| OD-7 | Print vendor flow | Open (product/workflow) | A4 §9.9 |
| OD-8 | Real OG image (R21) | **Resolved (Wave 8)** — 1200×630 `/images/og-image.webp` + PNG + icon set shipped in `rebuild/public`; cutover strict checker keeps one **known** R21 finding for the frozen baseline by design | `RISK_REGISTER.md:51-52`; `DATA_CUTOVER.md` D-07; `check-data` known finding |
| OD-9 | Analytics/Sentry posture | Decided-by-Lead for mechanics (env-guarded, consent-gated, PII-scrubbed, no replay); owner decides enable/consent UX | `rebuild/src/app/seo/telemetry.ts:1-25`; `ENVIRONMENT.md` §2 |
| OD-10 | Legacy retention + external worktree salvage | Open | `RISK_REGISTER.md:15,21`; wave checklist |
| OD-11 | Hosting topology (new Netlify site vs reuse) | Open — recommendation: separate site, base `rebuild`, promote at switch | `rebuild/netlify.toml:1-7`; U13 |
| OD-12 | Media end-state + backup cadence/retention | Open — recommendation: preserve bytes in place; independent dumps + restore drill | `DATA_CUTOVER.md` D-03, D-11; U5/U8 |
| OD-13 | Legacy URL policy | Open — recommendation: keep every frozen path, redirect aliases | `PRODUCT_CONTRACT.md:61-67` |
| OD-14 | Post-cutover visual/a11y fixes (R25/R27/R28) | Decided-by-Lead (accepted parity defects, fix post-cutover with new baselines) — owner ratification pending | `RISK_REGISTER.md:31-34` |
| OD-15 | Maintenance window + write-freeze method | Open — no maintenance flag exists in the legacy app | `audit/A3-data.md:463-471`; `ops/DEPLOY.md` §5 |

Mapping to `DATA_CUTOVER.md` gating decisions: **D-01** (R17) and **D-02** (RLS S1–S7) are the two
cutover-window blockers; **D-03** (preserve bytes in place) is the media recommendation; D-04…D-11 are
phase/record decisions already detailed there — do not duplicate them here.

## 5. Go / No-Go checklist (decision-grade)

| # | Gate | Status 2026-11-09 | Closing action |
|---|---|---|---|
| G1 | Final parity matrix green (all routes/viewports/themes, admin captured-or-exempt, prerender checks) | **PENDING** (§2, U1) | Lead supplies `matrix-summary.json`; matrix exit 0 |
| G2 | Rebuild gates green on the exact commit | **GREEN for `056ae0c`** (§1) | re-run CI for the final cutover commit; record run id |
| G3 | Wave 8 delivered (SEO/PWA/headers/perf/budgets) | **GREEN** (§1) | none (keep `build:seo:check` + budgets in CI) |
| G4 | Owner decisions OD-1…OD-15 closed/ratified | **OPEN** (§4) | owner sign-off |
| G5 | Production schema/RLS/RPC reconciliation report approved | **OPEN / UNVERIFIED** (U6) | operator read-only diff in Phase 0 |
| G6 | Backup created + restore drill passed with RTO recorded | **OPEN** (U8) | `ops/BACKUP_RESTORE.md` |
| G7 | Media completeness proven (DB-driven URLs enumerated + swept) | **OPEN** (U7) | Phase 0 export + URL sweep |
| G8 | Security fixes decided (R17 shipped as migration; RLS S1–S7 bundled) | **OPEN** (U3/U4) | D-01/D-02 owner sign-off |
| G9 | Rollback rehearsal passed on preview/scratch with evidence | **OPEN** (U9) | `ops/ROLLBACK.md` §6 |
| G10 | Owner authorisation record signed (§6) | **NOT YET** | §6 template |

**Verdict: GO-CONDITIONAL.** Engineering is ready; the cutover is blocked on **G1 (final parity
matrix), G4 (owner decisions), and G5–G10 (cutover-window evidence + authorisation)**. Once G1 lands,
this package can flip to GO on the engineering side; it remains **NO-GO for the window** until the
owner signs.

## 6. Owner MUST authorise (non-delegable, production mutations)

Separate approvals; one does not imply another. No agent or the Lead may perform these.

| # | Authorisation | Scope | Mechanics |
|---|---|---|---|
| **A1** | **DNS switch** | Cloudflare records + Netlify custom domain for `www.theporadas.com` (and apex/`wedding.*`) | `ops/DEPLOY.md` §5 |
| **A2** | **Production migration** | apply the additive/squashed SQL (incl. D-01 R17 fix, D-02 RLS bundle) to the production Supabase project | `ops/ROLLBACK.md` §3; `DATA_CUTOVER.md` §5 |
| **A3** | **Production data writes** | any backfill/UPDATE/DELETE, restore-into-production, `download_url` population, cleanup statements | `DATA_CUTOVER.md` §5; `ops/BACKUP_RESTORE.md` §3 |
| A4 | Maintenance window + write freeze | start/end; how guest writes are frozen (no flag exists) | `audit/A3-data.md:463-471`; OD-15 |
| A5 | Legacy retention/decommission | rollback window length; worktree salvage/delete | OD-10 |
| A6 | Media/CDN changes | R2 lifecycle/keys, Worker versions, cache purge | `ops/ROLLBACK.md` §4 |
| A7 | Secret rotation | Supabase/R2/Sentry/Netlify/Cloudflare | `ops/ENVIRONMENT.md` §4 |
| A8 | Analytics/Sentry enablement | DSN/project reuse, PII posture, consent UX | OD-9 |

Authorisation record (fill in the window; store with the checkpoint, not in git if it contains URLs):
`authorised by: ___ | date/time: ___ | A1 __ A2 __ A3 __ A4 __ A5 __ A6 __ A7 __ A8 __ |
scope/notes: ___ | rollback owner: ___ | window start/end: ___`.

## 7. Escalation and abort

- **Owner** approves §6; **Lead** executes and owns the final diff/gates; parity-eng/backend-eng are
  consulted on matrix/data findings.
- **Abort immediately** (roll back per `ops/ROLLBACK.md`) if: a priority-1 route fails post-switch
  smoke; a migration verification query returns an unexpected count; the backup cannot be verified;
  DNS/certificate issuance fails; two independent post-switch checks fail; or any data-loss signal
  appears.
- Keep the legacy deploy + R2 read-only and available for the whole rollback window. Do not delete
  Netlify deploys, R2 objects, or the frozen tag during the window.
- Monitoring during the window: deployed smoke (`ops/DEPLOY.md` §6), Sentry/analytics if enabled,
  uptime workflow (`.github/workflows/uptime-monitor.yml`), and the parity matrix re-run against the
  production URL. Incident comms channel/status page: **no repo evidence → UNVERIFIED**; the owner
  names it in the authorisation record.

## 8. What this package is not

Not authorisation, not a deploy execution, not a production audit. Runbooks:
[ops/ENVIRONMENT.md](./ops/ENVIRONMENT.md), [ops/DEPLOY.md](./ops/DEPLOY.md),
[ops/ROLLBACK.md](./ops/ROLLBACK.md), [ops/BACKUP_RESTORE.md](./ops/BACKUP_RESTORE.md).
Data/media plan: [DATA_CUTOVER.md](./DATA_CUTOVER.md). Parity rules: [PARITY.md](./PARITY.md).
Risks/decisions: [RISK_REGISTER.md](./RISK_REGISTER.md). Wave evidence:
[checkpoints/2026-11-09-waves-7-8.md](./checkpoints/2026-11-09-waves-7-8.md).
