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
| R21 | **Broken OG image for non-JS crawlers**: `index.html` points `og:image` at `/images/og-image.webp`, which does not exist (SPA fallback returns HTML); runtime SEOHead masks it for JS clients (A4 §5) | Certain | Medium | Wave 8 SEO work: ship a real og-image or point the static tag at an existing poster; verify with a non-JS fetch | Lead | Documented, Wave 8 |
| R22 | **Media completeness is DB-driven, not code-driven**: `public/images` has 542 files (139 MB), including `shared-gallery-new/` 473 files / 88 MB; `MEDIA_MANIFEST` only covers content-referenced paths (83). Gallery photo URLs live in `photos.url`/`thumbnail` rows, so code inspection cannot prove all media is preserved | High | Critical | Cutover checklist must enumerate every `photos.url`, `photos.thumbnail`, `guest_uploads.photo_urls/video_urls`, guestbook `media_url`, and storage object, and verify each resolves (local public tree or CDN). Keep the whole `public/images` tree in the rebuild | Lead / backend-eng | Open |
| R23 | **Parity coverage is narrower than the product**: rendered-text snapshots exist for the 6 priority-1 routes only; lightbox, claim modal, admin copy, activity/print/404 and error strings are not yet captured (A5 §5) | Medium | Medium | Add priority-2 captured states in Wave 1 (before porting the gallery/admin), or accept text parity only on priority-1 routes until then | parity-eng / Lead | Open |

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
