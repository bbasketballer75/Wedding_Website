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
