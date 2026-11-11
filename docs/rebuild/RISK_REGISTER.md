# Risk Register — 2026 Greenfield Rebuild

Reviewed at every wave checkpoint. Add risks; never silently delete them — close with a reason.

| # | Risk | Likelihood | Impact | Mitigation | Owner | Status |
|---|---|---|---|---|---|---|
| R1 | Parity harness gives false confidence (mocked data hides real regressions) | Medium | High | Text parity + contract tests against local Supabase + e2e interaction flows; parity is necessary, not sufficient | Lead | Open |
| R2 | Prod schema drift vs the 31 migrations (schema.sql is stale: 170 lines / 4 tables) | High | High | WP-4 reconstructs from a clean reset; A3 lists drift; reconcile + backup in the cutover window (maintenance window approved) | backend-eng | Open |
| R3 | 3.6 GB `public/` media slows builds/CI and accidentally lands in artifacts | High | Medium | `VITE_MEDIA_BASE_URL` stub for parity builds; never copy media; gitignore heavy dirs; clean `dist` between runs | Lead | Mitigated by design |
| R4 | Visual flake from fonts, animations, video, network | High | Medium | Determinism rules in `PARITY.md`; same-run/same-OS comparisons; selfcheck must be 0 px twice | parity-eng | Open |
| R5 | Agent collision in the shared checkout (the 2026-09-12 failure) | Medium | High | One branch/checkout, exclusive write scopes, serialized installs/builds, Lead-only git state changes | Lead | Mitigated by rules |
| R6 | Scope creep — "while we're here" features sneak into the rebuild | High | Medium | Product contract + scope freeze; ideas go to `docs/rebuild/BACKLOG.md`, not the branch | Lead | Open |
| R7 | Stack regret after scaffold (audit-first gate exists for this) | Medium | High | A7 weighted decision + reversal-cost statement + owner approval before Wave 1 | Lead | Open |
| R8 | Cutover outage or data loss | Low | Critical | Planned maintenance window, backup + restore rehearsal, deploy rollback, legacy tag retained | Lead | Open |
| R9 | Unmerged work in external worktrees is lost or confusing | Medium | Low | Audited 2026-11-08: 5 worktrees (cline + 4 Hermes), all **unmerged**, `cline/b14b6` dirty (4 files). Left untouched; decide salvage/delete at Wave 9 | Lead | Accepted |
| R10 | Security regression in guest inputs / admin | Low | Critical | `SECURITY.md` review per wave; RLS + rate-limit contract tests; no client secrets; CSP reviewed in Wave 8 | Lead | Open |
| R11 | Secret or PII leak into contracts/artifacts | Low | High | Synthetic fixtures only; `verify:secrets` stays green; review diffs before commit | Lead | Open |
| R12 | Time overrun (greenfield is large; estimate 3–6 weeks of agent work) | High | Medium | Wave checkpoints, each wave independently shippable, legacy stays live until cutover | Lead | Open |
| R13 | Open question blocks Wave 1 (stack) or cutover (media end-state) | Medium | Medium | A7 recommendation ready at checkpoint; owner decides; no scaffold before approval | Lead | Open |
| R14 | Node/npm drift (local Node 26 / npm 11.19 vs CI+Netlify Node 22 / npm 11.11) | Medium | Low | Tools are plain ESM compatible with Node 22+; CI runs the pinned versions; align in Wave 1 | Lead | Open |
| R15 | Local Supabase port collision with another running project (`supabase_db_resell-os` owns 54321) | High | Medium | Sandbox workdir with `project_id=theporadas-workbench` and ports shifted +1000; never stop the other project's containers; document the setup in A3 | backend-eng | Mitigated by design |
| R16 | Repo migration set does not reproduce the schema: `20260624000000_fix_guestbook_rpc_drop_type.sql` was hand-reconstructed with four missing semicolons, so `supabase db reset` failed at 30/31 | Certain | High | Found 2026-11-08; Lead applied a syntax-only repair (4 semicolons) under a documented freeze exception; backend-eng re-runs both resets from repo state. Reconcile prod migration history at cutover | Lead | Fixed, verified |
| R17 | **Guestbook server rate limit is silently bypassed in production**: `submit_guestbook_message_with_rate_limit` still inserts `guestbook_messages.type` (dropped in 20260410), so the RPC errors and the client falls back to a direct insert; only the client-side limiter applies | Certain | High | Wave 0 records it as a known defect (A3-data.md) without changing behavior; Wave 3 rebuilds the RPC without `type`/`p_type`; cutover verifies `pg_get_functiondef` read-only and ships the fix. Never test this by writing to prod | backend-eng / Lead | Documented, fix scheduled |
| R18 | **Claims wizard "identity verification" is client-side theatre**: sandbox mode defaults on, the 6-digit code is generated in the browser and both modes accept `123456`; `photo_claims` rows are then written directly with the anon key (A4 §6 S1) | Certain | Medium | Rebuild must not replicate the pretence. Owner decision: keep as an unverified "claim" queue (honest copy + admin moderation), or implement real verification (Supabase OTP/edge function). Recorded in A4 open question 4 | Lead / owner | Documented, decision needed |
| R19 | **Upload-status lookup exposes any guest's uploads by email**: `fetchGuestUploadStatus(email)` queries `guest_uploads` with the anon key from `/gallery` (A4 §6 S2) | Certain | Medium | Wave 3 decides: keep (RLS-limited), require the guest share token/magic link, or remove the panel. Must not be silently replicated | Lead / owner | Documented, decision needed |
| R20 | **Guestbook reactions are last-write-wins client PATCHes** on the shared row with a localStorage fingerprint; concurrent reactors can clobber each other (A4 §6 S3) | High | Low | Rebuild with an RPC/append-only reaction table; preserve the 4 reaction types | Lead | Documented, Wave 6 |
| R21 | **Broken OG image for non-JS crawlers**: `index.html` points `og:image` at `/images/og-image.webp`, which does not exist (SPA fallback returns HTML); runtime SEOHead masks it for JS clients (A4 §5) | Certain | Medium | Wave 8 shipped a real 1200×630 `/images/og-image.webp` (+ PNG) and the brand icon set under `rebuild/public`; prerendered HTML now carries the correct share image. The strict cutover checker keeps one **known** R21 finding for the frozen baseline by design (`--ignore-known` is green) | Lead | Resolved (Wave 8) |
| R22 | **Media completeness is DB-driven, not code-driven**: `public/images` has 542 files (139 MB), including `shared-gallery-new/` 473 files / 88 MB; `MEDIA_MANIFEST` only covers content-referenced paths (83). Gallery photo URLs live in `photos.url`/`thumbnail` rows, so code inspection cannot prove all media is preserved | High | Critical | Cutover checklist must enumerate every `photos.url`, `photos.thumbnail`, `guest_uploads.photo_urls/video_urls`, guestbook `media_url`, and storage object, and verify each resolves (local public tree or CDN). Keep the whole `public/images` tree in the rebuild | Lead / backend-eng | Open |
| R23 | **Parity coverage is narrower than the product**: rendered-text snapshots exist for the 6 priority-1 routes only; lightbox, claim modal, admin copy, activity/print/404 and error strings are not yet captured (A5 §5) | Medium | Medium | **Final Wave-9 matrix recorded** (`tools/parity/output/w9-matrix-final5/`, 46 rows: 35 pass / 5 reviewed allowed / 6 mobile-only fails routed). Desktop and all non-mobile rows green; residuals are the gallery mobile capture-pagination delta and the admin/admin-login mobile chrome pixels. The 10 **authenticated** admin sections were not captured (`admin.included=false`, `captured=[]`), and interactive states remain outside snapshot parity | parity-eng / Lead | Mitigated — final matrix recorded; mobile residual bundle + authenticated-admin-section capture remain open (`CUTOVER.md` U15/U16/U11) |
| R24 | **ESLint 9 is end-of-life but required**: `eslint-plugin-jsx-a11y@6.10.2` peer-caps at ESLint 9, so the greenfield app cannot move to ESLint 10 without dropping the a11y plugin | Certain | Low | Documented in `rebuild/eslint.config.js`; revisit at Wave 8 when the plugin ships ESLint 10 support. Everything else is on current majors | Lead | Accepted |
| R25 | **The frozen body font is an unloaded-inter fallback**: unlayered critical CSS sets `Inter, sans-serif` while the `--font-body` token is Instrument Sans, so the archive renders body copy in the system sans-serif fallback. The rebuild reproduces it for parity | Certain | Low | Do not "fix" silently: switching to Instrument Sans is a visual change and needs an owner decision at a later wave with parity baselines updated | Lead | Accepted (parity) |
| R26 | **Two mobile 404 parity allowances** for 1px border antialiasing at fractional positions (0.42% of pixels, maxChannelDelta 62; desktop is 0.000%, all computed styles/geometry identical) | Certain | Low | Closed: Wave 2 added the opt-in `--edge-tolerance 0..4` harness option (default 0 = exact) and deleted both allowlist entries; the 404 run passes 4/4 with **0 allowed** (`checkpoints/2026-11-09-waves-2-6.md:11`) | parity-eng | Closed (Wave 2) |
| R27 | **Inherited a11y defect on the 404 in dark theme**: the frozen 404 hard-codes a light page while the dark-theme palette is applied, so axe reports 5 `color-contrast` serious violations — 4 header nav labels plus the "Back to Home" secondary button in main content. Light theme is 0/0/0/0 | Certain | Low | Rebuild reproduces the frozen visual (parity); the Wave 2 axe gate allows only this scoped, documented case (all contrast failures must be inside `public-header` + `#main-content` on `/people` dark) and fails every other critical/serious violation. Fix post-cutover as a deliberate visual change (owner-approved) | Lead / shell-eng | Accepted (parity), fix scheduled |
| R28 | **Inherited print-button contrast**: the frozen Print page's primary button is `bg-gold-500 text-white` (below WCAG AA for normal text). The rebuild keeps the frozen class for pixel parity | Certain | Low | Tracked like R27: fix post-cutover as an owner-approved visual change; do not silently change parity-critical classes | Lead | Accepted (parity), fix scheduled |

## Closed / accepted

- **R9** accepted: external worktrees are outside this effort. Do not remove or prune them; do not
  build on their branches without explicit owner approval.

## Environment facts recorded 2026-11-08

- Freeze tag `legacy-freeze-2026-11-08` → commit `dd0cf48`, pushed to origin.
- Branch `rebuild/greenfield` created from that commit.
- Baseline gate: `tsc` 0 errors, ESLint 0 problems, 42 Vitest files / 346 tests passing (~12 s).
- `public/`: 624 files / 3.6 GB (video 2.96 GB, audio 503 MB, images 139 MB); video/audio dirs are
  gitignored, images are tracked.
- Local tooling: Node 26.8.1, npm 11.19.0, Docker 29.7.2, Supabase CLI 2.117.0, Playwright 1.62,
  `gh` 2.102.0.


**Lead status update (Wave 8):** R21 is resolved — Wave 8 shipped a real 1200×630 `/images/og-image.webp` (+ PNG) and the brand icon set under `rebuild/public`; `tools/cutover/check-data.mjs --ignore-known` is green. R25/R27/R28 remain accepted-inherited-visual defects with a post-cutover fix slot. R17 and the A3 §6 RLS gaps stay cutover-owned per `docs/rebuild/DATA_CUTOVER.md` (D-01/D-02).

## Owner-decision status (Wave 9 refresh, 2026-11-09)

Cross-reference only; the full table with options/evidence is `CUTOVER.md` §4 and the gating detail is
`DATA_CUTOVER.md` §7. Statuses: resolved / Lead-decided (owner ratification pending) / open.

| Decision | Owner? | Status |
|---|---|---|
| R17 repair timing / RLS S1–S7 bundle (DATA_CUTOVER D-01, D-02) | owner signs migrations | **Open — cutover-gating**; additive cutover migrations; `check-migrations --expect-r17-fixed` exits 1 **by design** until shipped |
| R18 claims pseudo-verification (D-08) | owner | Open |
| R19 upload-status lookup by email (D-09) | owner | Open |
| R20 guestbook reactions (D-10) | owner ratifies | Lead-decided (append-only/RPC model) |
| R21 OG image (D-07) | — | **Resolved (Wave 8)**; checker keeps a known frozen-baseline finding by design |
| R22 DB-driven media completeness (D-11) | owner supplies R2 listing + DB URLs | **Open** — Phase-0 data-volume checklist `DATA_CUTOVER.md` §8 |
| R23 parity coverage | owner accepts scope + mobile residual bundle | **Mitigated** — final matrix recorded (`w9-matrix-final5`: 35 pass/5 allowed/6 mobile-only fails); authenticated admin sections not captured; interactive states outside snapshot parity |
| R26 404 mobile allowances | — | **Closed (Wave 2)** — edge-tolerance replaced both entries; run passes with 0 allowed |
| R25/R27/R28 inherited visual/a11y defects | owner approves visual change | Accepted for parity; fix after cutover with new baselines |

**Lead status update (Wave 9 closure):** R23 (parity residual risk) is closed for the contract matrix — final run `w9-matrix-final6` is 46 rows with 0 failures (41 PASS + the 5 documented raster ALLOWED entries), including gallery and admin on mobile after the narrow-viewport pagination and mobile-chrome fixes. Residual Wave-9 verification extras (authenticated admin-section capture, prerender-aware matrix pass) and the owner-gated cutover actions remain tracked in `docs/rebuild/CUTOVER.md` (U11/U15, G4–G10, A1–A8).

**Implementation update (2026-11-10, owner-ratified cutover bundle):** R17 is implemented as an additive forward
migration (`tools/cutover/migrations/20261110000000_fix_guestbook_submit_rpc.sql`) and locally verified (rate
limiting restored; post-cutover contract suite 11/11). The A3 §6 RLS bundle S1–S7 is implemented
(`…_rls_hardening_bundle.sql`) with the 10 dynamic invariants green and an idempotent re-apply; the app wiring
for the new RPCs (guest-share aggregate/identity/token, RPC-only guestbook submit, admin delete/audit RPCs)
ships with it. R18/R19/R20 dispositions are owner-ratified (honest moderated claims queue; token-gated lookup;
RPC reaction semantics). Remaining: staging apply + sign-off, and the window's production backup/restore +
rollback rehearsal.
