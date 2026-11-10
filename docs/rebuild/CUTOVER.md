# CUTOVER — Wave 9 readiness package

**Status: ENGINEERING GATES GREEN WITH 6 ROUTED MOBILE PARITY RESIDUALS — NOT AUTHORISED.** The final
full-matrix parity sweep is recorded (§2); desktop and every non-mobile row are green, six mobile-only
rows are documented, routed follow-ups (not claimed green). The owner decisions and the non-delegable
authorisations in §4/§6 are still open. **Do not cut over from this page.**

Documentation only: nothing here was executed against production, DNS, Netlify, Supabase or R2.
Snapshot: branch `rebuild/greenfield` @ `53cda7b` (2026-11-09; Wave 8 + Wave 9 evidence committed).
Numbers cite the committed checkpoint `checkpoints/2026-11-09-waves-7-8.md` (Wave 9 section at the end)
or a named committed artifact; anything the repo cannot prove is `UNVERIFIED` with the closing step.

## 1. Delivered engineering evidence (Wave 7 + Wave 8 + Wave 9 integration)

| Gate | Result | Evidence |
|---|---|---|
| Unit tests | **127 files / 1077 passed, 9 skipped** (the 9 are the opt-in local-Supabase contract suite) | checkpoint Wave 9 gate snapshot l.128 |
| Coverage | thresholds met (statements/branches/functions/lines per `rebuild/vitest.config.ts`) | checkpoint l.128 |
| TypeScript | TS 7 **0 errors**, TS 6 **0 errors** | checkpoint l.128; CI `rebuild.yml:122-128` |
| ESLint | 0 errors (11 documented `react-refresh` warnings in the lazy route table) | checkpoint l.128; CI `rebuild.yml:114-116` |
| Prettier | clean | checkpoint l.128; CI `rebuild.yml:118-120` |
| Production build | `build:prod` + `build:seo:check` green; **12 prerendered route files, 8 boot shells**; `tmp/dist-prod` sha256 `B6561807…` | checkpoint l.85-86, l.128; `rebuild/package.json:24-26` |
| Bundle budgets | initial **160.14 KiB gz / 180**; public routes **≤118.94 / 120**; admin **116.41** after lazy split; total **411.83 KiB gz (informational 450)**; `bundle.mjs --check` exit 0 | checkpoint l.105; `tools/perf/output/before-after-wave8.md` |
| Runtime perf (prod build, slow-4G + CPU×4, median of 3) | **LCP 920–1092 ms ≤ 2000**; **CLS 0.0000–0.0010 ≤ 0.05**; TTFB 153–160 ms; all six cells PASS | checkpoint l.106-108; `tools/perf/output/before-after-wave8.md` (FINAL) |
| E2E shell/a11y | **9/9** (axe light 0 violations; dark critical 0 + documented R27 contrast) | checkpoint l.128 |
| SEO/PWA artifacts | `build:seo:check` drift gate green (sitemap/robots/manifest/sw + prerendered HTML) | checkpoint l.128; CI `rebuild.yml:134-140` |
| Local contract evidence | **9/9** data-layer contract tests pass against the local Supabase sandbox; R17 `42703` reproduced; `is_admin()` false for anon | `CONTRACT_EVIDENCE.md`; checkpoint l.115 |
| Legacy freeze | intact | checkpoint l.128; re-measured: `node tools/check-legacy-freeze.mjs` exit 0 |
| Contracts | 8 JSON contracts / 8 fixtures / 9 content files / 12 rendered routes / 7 schema artifacts valid | checkpoint l.67; re-measured: `node tools/verify-contracts.mjs` exit 0 |
| Data/media cutover checkers | `check-data --ignore-known` → **0 mismatches, 0 warnings, 31 migrations** (exit 0); `check-migrations` → **0 mismatches** (exit 0; R17 gate exits 1 by design) | `tools/cutover/check-data.mjs`, `check-migrations.mjs`; `DATA_CUTOVER.md` §1/§9.4 |
| **Final parity matrix** | **46 rows: 35 PASS, 5 ALLOWED, 6 FAIL (all mobile)**; `--edge-tolerance 1`; selfcheck PASSED (402 s) immediately before | §2; checkpoint l.88-101 |
| CI | `rebuild.yml` gates coverage, `build:prod`, `build:seo:check`, budgets and the read-only cutover checkers | checkpoint l.37; `.github/workflows/rebuild.yml:130-150` |

Wave 8 delivery detail (committed): prerender (`rebuild/scripts/prerender.mjs`, `--check`),
sitemap/robots/manifest/sw (`rebuild/scripts/generate-sitemap.mjs`), Netlify config
(`rebuild/netlify.toml`), PWA runtime injection gated on `VITE_ENABLE_PWA=1`, consent-gated
analytics/Sentry (`rebuild/src/app/seo/telemetry.ts`), bundle gate (`rebuild/scripts/check-budgets.mjs`),
runtime-perf harness (`tools/perf/run.mjs`), media derivative pipeline
(`rebuild/scripts/media-optimize.mjs`; adoption decision `MEDIA_OPTIMIZATION.md`, not consumed
pre-cutover), and the read-only cutover checkers (`tools/cutover/*`).

## 2. Final full-matrix parity sweep (recorded, immutable artifact)

Artifact: `tools/parity/output/w9-matrix-final5/` — `matrix-summary.json` (generated
2026-11-10T02:23:04.563Z, 839,946 ms run), `MATRIX.md`, `README.md`, `summary.json`, `report.html`,
`shots/`, `text/`, `summary.partial.json`. This artifact is immutable for the cutover record; the table
below is a faithful grouping of its 46 rows (all values from the artifact).

Provenance (checkpoint l.83-91): parity build = plain `vite build` with the fixture Supabase project;
`rebuild/dist/index.html` sha256 `603170EAE0A7408420A7194CC2CAF832D1FD282E8C7850F190A889498EBBA687`,
rebuilt deterministically and verified before/after; command
`node tools/parity/matrix.mjs --legacy-url http://127.0.0.1:4174 --rebuild-url http://127.0.0.1:4175 --wave 9`;
tolerances `maxDiffRatio=0.001`, `pixelThreshold=0.12`, `edgeTolerance=1`; selfcheck passed
(legacy-vs-legacy 0 changed px) immediately before the run.

Totals from `matrix-summary.json`: **rows 46 · pass 35 · allowed 5 · fail 6 · error 0 · exempt 0 ·
text-diff rows 2**; changed pixels 577,941 of 299,029,440.

### 2.1 Per-route status (grouped from the 46 rows)

| Route | desktop/dark | desktop/light | mobile/dark | mobile/light | Evidence note |
|---|---|---|---|---|---|
| `home` `/` | ALLOWED | ALLOWED | ALLOWED | ALLOWED | raster-phase entries; 130–139 px each (0.0013–0.0049%); heights identical (10166/10166, 9414/9414); 0 text diffs |
| `film` `/film` | ALLOWED | PASS | PASS | PASS | 64–2144 px (≤0.0207%); heights identical (5291/5291, 7964/7964); 0 text diffs |
| `gallery` `/gallery` | PASS | PASS | **FAIL** | **FAIL** | desktop 1421 px (0.0137%) heights 2151/2151; mobile = **text (images) 2 diffs**, heights 11156 / 9528 — §2.3 |
| `upload` `/upload` | PASS | PASS | PASS | PASS | 0 px, 0 text, heights identical |
| `guestbook` `/guestbook` | PASS | PASS | PASS | PASS | 0 px, 0 text, heights identical |
| `guest-photos` `/guest-photos` | PASS | PASS | PASS | PASS | 0 px, 0 text, heights identical (guest data adapters wired) |
| `activity` `/activity` | PASS | PASS | PASS | PASS | 0 px, 0 text, heights identical (stale-metadata crawlable fix holds parity) |
| `admin-login` `/admin/login` | PASS | PASS | **FAIL** | **FAIL** | desktop 0 px heights 1928/1928; mobile pixel-only 8.0716% / 2.7240%, heights 3446 / 3415 — §2.3 |
| `admin` `/admin` | PASS | PASS | **FAIL** | **FAIL** | desktop 0 px heights 1928/1928; mobile pixel-only 8.0715% / 2.7238%, heights 3446 / 3415 — §2.3 |
| `guest-token` `/guest/valid-showcase-token` | PASS | PASS | PASS | PASS | 665 px (0.0064% desktop, 0.0253% mobile); heights identical (1593/1593, 3523/3523) |
| `print` `/print` | — (light only) | PASS | — | PASS | desktop 84 px (0.0008%) heights 1628/1628; mobile 0 px heights 1965/1965 |
| `not-found` `/people` | PASS | PASS | PASS | PASS | 0 px, 0 text, heights identical (1475/1475, 2042/2042); `/people` 404 confirmed |

### 2.2 ALLOWED rows (5) — reviewed, expiring allowlist entries

| Route · viewport · theme | Changed px / ratio | Heights (L/R) | Text diffs | Allowlist |
|---|---|---|---|---|
| home · desktop · dark | 134 / 0.0013% | 10166/10166 | 0 | `contracts/parity-allowlist.json` (home raster-phase, `maxDiffPixelRatio` 0.003) |
| home · desktop · light | 139 / 0.0013% | 10166/10166 | 0 | same home entry (desktop/light) |
| home · mobile · dark | 130 / 0.0049% | 9414/9414 | 0 | same home entry (mobile/dark, 0.002) |
| home · mobile · light | 130 / 0.0049% | 9414/9414 | 0 | same home entry (mobile/light, 0.002) |
| film · desktop · dark | 870 / 0.0084% | 5291/5291 | 0 | film dark-gradient chrome entry (`maxDiffPixelRatio` 0.0002) |

All five entries carry `expiresAtWave: 9`; because wave 9 == expiry they still suppress, but they must
be re-reviewed before **any** post-cutover parity re-run (no further wave is planned pre-cutover —
record the review with the sign-off; §3 U17).

### 2.3 FAIL rows (6) — mobile only, routed (not hidden)

| Route · viewport · theme | Kind | Changed px / ratio | Text diffs | Heights (L/R) | First failure artifact |
|---|---|---|---|---|---|
| gallery · mobile · dark | text (images) | 0 / 0.0000% | **2** | **11156 / 9528** | `text/diff/gallery__mobile__dark.json` |
| gallery · mobile · light | text (images) | 0 / 0.0000% | **2** | **11156 / 9528** | `text/diff/gallery__mobile__light.json` |
| admin-login · mobile · dark | pixel | 212,549 / **8.0716%** | 0 | 3446 / 3415 | `shots/diff/admin-login__mobile__dark--s000.png` |
| admin-login · mobile · light | pixel | 71,731 / **2.7240%** | 0 | 3446 / 3415 | `shots/diff/admin-login__mobile__light--s000.png` |
| admin · mobile · dark | pixel | 212,544 / **8.0715%** | 0 | 3446 / 3415 | `shots/diff/admin__mobile__dark--s000.png` |
| admin · mobile · light | pixel | 71,726 / **2.7238%** | 0 | 3446 / 3415 | `shots/diff/admin__mobile__light--s000.png` |

Routed analysis (checkpoint l.99-101, reproduced from the artifact):

1. **Gallery mobile = capture pagination delta, not copy/layout drift.** The frozen oracle ends with
   30 images / 11156 px; the rebuild ends with 24 / 9528 px + `LOAD MORE`. Every other mobile gallery
   aspect (text, ordering, tile layout, ratios) matches and desktop passes both themes at 0.0137%.
   Cause: the fixed-height capture windows do not trigger the rebuild's extra `loadMore()` exactly like
   the frozen scroll handler. **Wave-9 follow-up** (harness/scroll-trigger alignment), not a product
   content/URL regression.
2. **Admin mobile = pixel-only chrome tokens.** No DOM/text difference; heights 3446 vs 3415. The
   mobile admin shell/card theme treatment differs below `xl`; desktop both themes match at 0.0000%.
   **Wave-9 mobile-chrome follow-up** (post-cutover visual pass; cf. R25/R27/R28 family).

### 2.4 Scope caveats for this matrix (do not over-claim)

- **Mobile is not green.** Desktop and every non-mobile row pass; the six failures above are the
  documented mobile residual bundle (§3 U16).
- **Prerender-aware check is `pending`, not passed.** The artifact records
  `prerender.status = "pending"`, `expectedRoutes = 9`, `rebuildPrerendered = 0` — the matrix captured
  the plain parity build (no W8-1 prerender layer). Production prerender is independently gated by
  `build:seo:check` on `build:prod` (checkpoint l.62/l.128). A `matrix.mjs --prerender` run against the
  production build is a Wave-9 follow-up (§3 U15).
- **Authenticated admin sections were not captured.** `matrix-summary.json.admin` reports
  `included: false`, `captured: []`, `exempt: []`: the four `admin*` rows are the unauthenticated
  `/admin` redirect/login shell, **not** the 10 moderation sections listed in `PARITY.md` §10.2.
  Admin-portal parity beyond the shell remains uncovered (§3 U11).
- **Interactive states are still outside snapshot parity** (lightbox open/zoom, claim modal, error
  strings; R23). The final matrix is route-level evidence, not exhaustive behavioral proof.

## 3. Remaining gaps and `UNVERIFIED` items

| # | Gap | Status (2026-11-09 final) | Closing action / verification |
|---|---|---|---|
| U1 | Final parity matrix | **RESOLVED** — 46 rows recorded, immutable artifact; 35 pass / 5 allowed / 6 mobile fails routed (§2) | matrix artifact retained; residual bundle tracked U15/U16 |
| U2 | Guest-share / guest-photos data adapters + lightbox wiring | **RESOLVED** — `/guest-photos` and `/guest/:token` PASS all 4 rows (0 px, 0 text, identical heights); adapters committed | none |
| U3 | **R17 guestbook rate-limit RPC** (D-01) | **OPEN — cutover-gating**: fix ships as an additive migration; `check-migrations --expect-r17-fixed` exits 1 today **by design** | `DATA_CUTOVER.md` §1.3/§7 D-01; gate flips to 0 after the migration |
| U4 | **A3 §6 RLS hardening bundle S1–S7** (D-02) | **OPEN** — owner sign-off per behaviour-changing item (S2/S3/S4/S6); local contract evidence landed (`CONTRACT_EVIDENCE.md`, 9/9) | `DATA_CUTOVER.md` §7 D-02; migrations reviewed before Phase 2 |
| U5 | Media derivative adoption | **OPEN** — `MEDIA_OPTIMIZATION.md` recommends **Option B (manifest `<picture>`, staged)**, explicitly **not** pre-cutover (parity needs originals); owner sign-off required | `MEDIA_OPTIMIZATION.md` §1/§9; post-cutover phase 1 |
| U6 | Production schema/RLS/RPC reconciliation | **UNVERIFIED** — no production read used; local baseline is the frozen chain, not prod | Phase-0 read-only diff (`DATA_CUTOVER.md` §5; `audit/A3-data.md:171-186`) |
| U7 | DB-driven media completeness (R22) | **OPEN** — repo checkers cover code/contract references; `photos.url`/guest URLs live only in the DB | Phase-0 export + URL sweep (`DATA_CUTOVER.md` §9.3) |
| U8 | Backup + restore drill | **NOT DONE** | `ops/BACKUP_RESTORE.md` §2–§3; record dump SHA + RTO |
| U9 | Rollback rehearsal | **NOT DONE** | `ops/ROLLBACK.md` §6 (preview/scratch only) with evidence bundle |
| U10 | Owner decisions / authorisations | **OPEN** (§4/§6) | owner sign-off + signed authorisation record |
| U11 | Interactive-state + authenticated admin-section parity | **OPEN** — matrix admin rows are shell/login only (`admin.captured=[]`); lightbox/claims/error states outside snapshot parity (R23) | decide scope at sign-off; optional post-cutover behavioural parity run |
| U12 | Perf artifact commitment | **RESOLVED** — `tools/perf/output/before-after-wave8.md` is tracked as the FINAL report; checkpoint carries the same release-gate numbers | none |
| U13 | Hosting topology / Netlify site | **UNVERIFIED** — no greenfield site exists; `rebuild/netlify.toml` says "not deployed yet" | OD-11; create staging site with base `rebuild`, then re-run §1 smoke |
| U14 | DNS TTLs / certificate issuance | **UNVERIFIED** (dashboard-only) | owner lowers TTLs ≥30 min before the window; certificate issued before the flip (`ops/DEPLOY.md` §5) |
| U15 | Prerender-aware matrix validation | **PENDING** — matrix artifact `prerender.status=pending` (0/9; parity build has no prerender layer) | run `matrix.mjs … --prerender` against the production build (`build:prod`) and record the result |
| U16 | Mobile parity residual bundle | **DOCUMENTED, NOT GREEN** — gallery mobile capture-pagination delta (text, 2 rows) + admin/admin-login mobile chrome pixels (4 rows); desktop/non-mobile green | accept as a documented residual with follow-up owner, or fix before the switch; record the decision with the sign-off |
| U17 | Allowlist expiry | All 5 entries have `expiresAtWave: 9` (== current wave); they suppress today but are **at expiry** | re-review the 5 entries when the sign-off is recorded; any post-cutover parity re-run must re-enter/remove them explicitly |

## 4. Refresh of owner decisions OD-1…OD-15 (final matrix evidence folded in)

Statuses: **Resolved** = evidence landed, no owner choice remains; **Decided-by-Lead / ratification
pending** = Lead recommendation exists, needs the owner's explicit yes; **Open** = no decision recorded.

| ID | Decision | Current status | Evidence / note |
|---|---|---|---|
| OD-1 | Claims verification model (R18) | **Open** — recommendation: honest admin-moderated queue | `RISK_REGISTER.md:24`; `DATA_CUTOVER.md` D-08 |
| OD-2 | Upload-status lookup by email (R19) | **Open** — recommendation: gate behind share token or remove | `RISK_REGISTER.md:25`; D-09 |
| OD-3 | Guestbook reaction model (R20) | Decided-by-Lead (RPC/append-only semantics) — owner ratification pending | `RISK_REGISTER.md:26`; D-10 |
| OD-4 | Retired features: music / quiz / map / sort / timeline views | **Open** (product scope) | A4 §9.1-3,7; `PRODUCT_CONTRACT.md:44` |
| OD-5 | `/people` 404 vs restore | Decided-by-Lead (keep 404) — **ratification pending**; matrix confirms 404 parity 4/4 and the generated sitemap has 6 indexable entries (no `/people`) | §2.1 `not-found` row; `contracts/routes.json:153-162` |
| OD-6 | Stale metadata on `/activity` + `/admin/*` | Decided-by-Lead (crawlable-only fix) — **ratification pending**; matrix shows `/activity` parity 4/4 and admin shell desktop 0 px, so the intentional hydrated-vs-crawlable split holds | §2.1; checkpoint l.29; `PARITY.md` §11 |
| OD-7 | Print vendor flow | **Open** (product/workflow); matrix gives `/print` parity PASS (light, both viewports) | §2.1 `print` row; A4 §9.9 |
| OD-8 | Real OG image (R21) | **Resolved (Wave 8)** — real 1200×630 `/images/og-image.webp` + PNG + icon set; strict checker keeps one known frozen-baseline finding by design | `RISK_REGISTER.md:51-52`; `DATA_CUTOVER.md` D-07 |
| OD-9 | Analytics/Sentry posture | Decided-by-Lead for mechanics (env-guarded, consent-gated, PII-scrubbed, no replay); owner decides enable/consent UX | `rebuild/src/app/seo/telemetry.ts:1-25`; `ops/ENVIRONMENT.md` §2 |
| OD-10 | Legacy retention + external worktree salvage | **Open** | `RISK_REGISTER.md:15,21` |
| OD-11 | Hosting topology (new Netlify site vs reuse) | **Open** — recommendation: separate site, base `rebuild`, promote at switch | `rebuild/netlify.toml:1-7`; U13 |
| OD-12 | Media end-state + backup cadence/retention | **Open** — `MEDIA_OPTIMIZATION.md` recommends Option B staged post-cutover; preserve bytes in place at cutover; independent dumps + restore drill | `MEDIA_OPTIMIZATION.md` §1/§9; `DATA_CUTOVER.md` D-03/D-11; U5/U8 |
| OD-13 | Legacy URL policy | **Open** — recommendation: keep every frozen path, redirect aliases | `PRODUCT_CONTRACT.md:61-67` |
| OD-14 | Post-cutover visual/a11y fixes (R25/R27/R28) | Decided-by-Lead (accepted parity defects, fix post-cutover with new baselines) — ratification pending; the admin mobile chrome residual (§2.3) is the natural first item for this pass | `RISK_REGISTER.md:31-34`; U16 |
| OD-15 | Maintenance window + write-freeze method | **Open** — no maintenance flag exists in the legacy app | `audit/A3-data.md:463-471`; `ops/DEPLOY.md` §5 |

Mapping to `DATA_CUTOVER.md`: **D-01** (R17) and **D-02** (RLS S1–S7) are the cutover-window gating
decisions; **D-03** (preserve bytes in place) is the media recommendation; D-04…D-11 are phase/record
decisions detailed there — do not duplicate them here.

## 5. Go / No-Go checklist (decision-grade)

| # | Gate | Status 2026-11-09 (final evidence) | Closing action |
|---|---|---|---|
| G1 | Final parity matrix acceptable for cutover | **CONDITIONAL PASS** — 35 PASS + 5 reviewed ALLOWED; desktop and every non-mobile row green; **6 mobile-only rows routed as documented follow-ups** (gallery mobile pagination capture delta; admin/admin-login mobile chrome pixels). **NOT mobile green.** | owner accepts/records the mobile residual bundle (U16) with a follow-up owner, or orders a pre-switch fix; record the sign-off against `w9-matrix-final5/` |
| G2 | Rebuild gates green on the exact commit | **GREEN at the final integration snapshot** (`53cda7b`): 127 files / 1077 passed + 9 skipped, coverage thresholds met, TS7/TS6 0, ESLint 0+11 documented warnings, prettier clean, `build:prod`+`build:seo:check`, budgets, runtime gates, e2e 9/9 | re-run CI for the exact cutover commit and attach the run id |
| G3 | Wave 8 delivered (SEO/PWA/headers/perf/budgets) | **GREEN** (§1) | none (keep `build:seo:check` + budgets in CI) |
| G4 | Owner decisions OD-1…OD-15 closed/ratified | **OPEN** (§4) | owner sign-off |
| G5 | Production schema/RLS/RPC reconciliation approved | **OPEN / UNVERIFIED** (U6) | operator read-only diff in Phase 0 |
| G6 | Backup created + restore drill passed with RTO | **OPEN** (U8) | `ops/BACKUP_RESTORE.md` |
| G7 | Media completeness proven (DB-driven URLs swept) | **OPEN** (U7) | Phase-0 export + §9.3 sweep |
| G8 | Security fixes decided (R17 migration; RLS S1–S7) | **OPEN** (U3/U4) — local contract evidence landed | D-01/D-02 owner sign-off |
| G9 | Rollback rehearsal passed on preview/scratch | **OPEN** (U9) | `ops/ROLLBACK.md` §6 |
| G10 | Owner authorisation record signed (§6) | **NOT YET** | §6 template |

**Verdict: NO-GO until the owner signs.** Engineering is green with a **documented mobile residual
bundle** (§2.3/U16) and two parity-scope caveats (prerender-aware matrix pending U15; authenticated
admin sections not captured U11). The window stays blocked on **G4 (owner decisions), G5–G10
(cutover-window evidence + authorisation), and the explicit acceptance of U16**. Once those close,
this package flips to GO on the existing evidence.

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
U16 mobile-residual acceptance: ___ | scope/notes: ___ | rollback owner: ___ | window start/end: ___`.

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
  uptime workflow (`.github/workflows/uptime-monitor.yml`), and a parity matrix re-run against the
  production URL. Incident comms channel/status page: **no repo evidence → UNVERIFIED**; the owner
  names it in the authorisation record.

## 8. What this package is not

Not authorisation, not a deploy execution, not a production audit. Runbooks:
[ops/ENVIRONMENT.md](./ops/ENVIRONMENT.md), [ops/DEPLOY.md](./ops/DEPLOY.md),
[ops/ROLLBACK.md](./ops/ROLLBACK.md), [ops/BACKUP_RESTORE.md](./ops/BACKUP_RESTORE.md).
Data/media cutover: [DATA_CUTOVER.md](./DATA_CUTOVER.md); media adoption decision:
[MEDIA_OPTIMIZATION.md](./MEDIA_OPTIMIZATION.md); local contract evidence:
[CONTRACT_EVIDENCE.md](./CONTRACT_EVIDENCE.md); parity rules: [PARITY.md](./PARITY.md); risks/decisions:
[RISK_REGISTER.md](./RISK_REGISTER.md); Wave evidence:
[checkpoints/2026-11-09-waves-7-8.md](./checkpoints/2026-11-09-waves-7-8.md).

---

## Lead addendum — final all-green parity matrix (2026-11-09, post mobile fixes)

The 6 mobile failures recorded above are fixed and the full contract matrix is now green:
**46 rows = 41 PASS / 5 ALLOWED / 0 FAIL / 0 error** (`tools/parity/output/w9-matrix-final6/`,
dist sha256 `AE867B0E5F6F0023101968FE7D42B00D887A3031022836DCCA70883CA4966A5B`, hash verified unchanged).
Fixes: gallery narrow-viewport pagination parity; admin mobile nav line box + admin wordmark link to `/`;
admin runtime metadata kept frozen/stale (crawlable metadata comes from the Wave-8 prerender);
guest-share album-owner identity precedence. ALLOWED rows are the documented home ×4 / film raster entries only.

**Updated go/no-go position:** G1 parity is now **GREEN for the contract matrix** (no mobile residual bundle to
accept). The remaining open items are unchanged and all owner-side or Wave-9 extras: authenticated
admin-section capture + prerender-aware matrix pass (U11/U15), R17/RLS cutover migrations (D-01/D-02),
production schema reconciliation, backup/restore drill, rollback rehearsal, media Option B sign-off,
Netlify site/DNS values, and the A1–A8 authorisations. **Still NO production action and NO-GO until the owner signs.**
