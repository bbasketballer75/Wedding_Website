# Wave 0 Plan — Refactor Workbench (approved 2026-11-08)

> Status: **in progress**. Owner: Lead. Branch: `rebuild/greenfield`. Freeze tag:
> `legacy-freeze-2026-11-08`. This is the committed form of the approved plan; the full
> per-task detail lives on the shared task board (WP-1 … WP-9) and in the checkpoint report.

## Goal

A safe, measurable workbench plus a greenfield track where the archive can be completely rebuilt,
with proof at every step that nothing user-facing was lost. No scaffolding of the new app happens
until the audit recommends a stack and the owner approves it.

## Decisions (owner, 2026-11-08)

| Decision | Choice |
|---|---|
| Rebuild strategy | Parallel greenfield rebuild (legacy frozen as parity oracle) |
| Stack | Audit first, then decide (A7 recommendation; hard gate) |
| Visual scope | Pixel parity; design refresh is a separate later project |
| Production rules | Maintenance window allowed at cutover; schema may be squashed; legacy URLs may break |
| Review cadence | Wave checkpoints; team autonomous inside a wave |

Derived rules: one checkout / one branch / no worktrees; legacy source frozen (allowlisted config
files only); serialized installs and builds; no production writes; evidence before claims.

## Success criteria (Wave 0)

1. Freeze tag + branch; zero legacy source edits (freeze checker green).
2. Legacy gates unchanged: `tsc` 0 errors, ESLint 0 problems, 42 test files / 346 tests.
3. `contracts/` complete and validated by `npm run workbench:verify`.
4. Schema baseline generated from two clean local Supabase resets (identical SHA-256).
5. Parity harness proves legacy-vs-legacy = 0 changed pixels, twice.
6. Rendered-text baseline for every priority route; content extraction deterministic.
7. Baseline metrics recorded with reproducible commands.
8. Audit A1–A7 with a stack recommendation, weighted tradeoffs, rejected options, reversal cost.
9. `rebuild.yml` green; legacy `ci.yml` untouched.
10. Worktree audit + risk register + checkpoint report; stop for owner review.

Out of scope for Wave 0: scaffolding, dependency upgrades, legacy file moves, DB/media/DNS/Netlify
changes, new features. Scope freeze until cutover.

## Work packages

| WP | Owner | Deliverable | Acceptance |
|---|---|---|---|
| 1 | Lead | Freeze tag, branch, worktree audit, ignore rules | tag on frozen commit; worktree report; clean tree |
| 2 | Lead | `tools/lib`, `verify-contracts`, `check-legacy-freeze`, scripts, lint/format config | legacy gates unchanged; freeze check can fail/pass |
| 3 | contracts-eng | routes/features/ui/seo-pwa, content extraction, fixtures, rendered copy | `verify-contracts --allow-missing` 0 problems; deterministic re-run |
| 4 | backend-eng | schema dump/types/inventory/fixtures + media contract | two identical resets; drift report; no PII |
| 5 | parity-eng | deterministic legacy-vs-rebuild screenshot + text harness | self-check 0 px twice; perturbation detected |
| 6 | metrics-eng | code inventory + baseline metrics + Lighthouse + coverage | reproducible numbers; metrics.json valid |
| 7 | audit-arch / audit-product | A1–A6 audit docs | every claim evidenced; no TBDs |
| 8 | Lead | `rebuild.yml` CI + quality bar | workflow green; legacy CI untouched |
| 9 | Lead | A7 stock decision + checkpoint | owner review gate |

## Interfaces

- Contracts are validated by zod schemas in `tools/lib/schemas.mjs`; formats are defined there.
- Parity CLI: `node tools/parity/compare.mjs --legacy-url <u> --rebuild-url <u> [--routes …] [--matrix …] [--out …] [--max-diff-ratio 0.001] [--pixel-threshold 0.12] [--json]`; exit 0 pass / 1 diff / 2 harness error.
- Root scripts: `workbench:verify`, `workbench:freeze`, `inventory:capture`, `content:extract`,
  `content:copy`, `baseline:capture`, `parity:serve`, `parity:compare`, `parity:selfcheck`,
  `parity:report`.
- Legacy-freeze allowlist: `package.json`, `package-lock.json`, `eslint.config.js`,
  `.prettierignore`, `.gitignore`, `AGENTS.md`; new `contracts/**`, `docs/rebuild/**`, `tools/**`,
  `rebuild/**`, `.github/workflows/rebuild.yml`.

## Parity rules (summary)

Same-run/same-OS comparisons only; production builds served statically; all network mocked from
`contracts/fixtures`; one media stub; service worker blocked; `__E2E__` set; reduced motion; fixed
Date (timers live); fonts ready; stable scrollbar; lazy-image scroll sweep; page-height slicing
above 12 000 px; 0.1% max diff ratio; text parity exact after normalization; allowlist entries need
reason + expiry wave. Full detail: [PARITY.md](./PARITY.md).

## Roadmap after the gate

1. Scaffold + shell + tooling. 2. Design tokens + UI primitives. 3. Data layer + auth + typed
client. 4. Home/Film/Print/404. 5. Gallery. 6. Guestbook + uploads. 7. Admin. 8. SEO/PWA/infra.
9. Parity sweep + schema migration + cutover + legacy retirement. Each wave gets its own plan,
exits on a parity gate, and stops at a checkpoint.

## Verification (Wave 0)

```
npm run lint && npm run format:check && npx tsc --noEmit && npm run test:run
npm run workbench:verify
node tools/check-legacy-freeze.mjs
npm run parity:selfcheck
npm run content:extract && git diff --exit-code contracts/content
npm run baseline:capture
```

## Rollback

Wave 0 has no production risk: delete the branch/tag and revert the allowlisted config additions.
Legacy app, media, database and deployments are untouched.

## Assumptions / open questions

- Frozen commit is what production serves (verify in A6/A7; re-tag if it differs).
- Local reset reproduces prod schema closely enough; drift is measured in A3 and reconciled in the
  cutover window.
- Fixtures are synthetic; no production data or PII enters the repo.
- Open: stack choice (A7), legacy URL policy, media end-state, legacy retention after cutover,
  analytics/Sentry privacy posture, whether SEO justifies SSR.
