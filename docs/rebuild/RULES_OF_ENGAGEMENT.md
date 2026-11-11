# Rules of Engagement — 2026 Greenfield Rebuild

These rules exist because the last parallel refactor attempt destroyed a teammate's uncommitted
work: two agents wrote to one checkout on different branches, and a `git stash -u` in one erased
the other's untracked files (`docs/plans/2026-09-12-master.md`, lesson 1). This document is the
contract that prevents it from happening again.

## 1. One checkout, one branch, one working tree

- The whole team shares **this** working directory. There is exactly **one** checked-out branch:
  `rebuild/greenfield`.
- **No additional git worktrees** for the rebuild. No `git switch`, no `git checkout <branch>`,
  no `git stash`, no `git reset` while another member may be working — the Lead owns all git
  state changes except ordinary commits by the owning author.
- If isolation is ever needed, ask the Lead. Do not improvise it.

## 2. Write scopes are exclusive

| Owner | May write |
|---|---|
| Lead | `package.json`, `package-lock.json`, `eslint.config.js`, `.prettierignore`, `.gitignore`, `AGENTS.md`, `tools/lib/*` (except `schemas.mjs`), `tools/verify-contracts.mjs`, `tools/check-legacy-freeze.mjs`, `tools/report.mjs`, `docs/rebuild/README.md`, `PRODUCT_CONTRACT.md`, `RULES_OF_ENGAGEMENT.md`, `RISK_REGISTER.md`, `audit/A7-*`, `STACK_DECISION.md`, `checkpoints/**`, `.github/workflows/rebuild.yml` |
| `contracts-eng` | `contracts/routes.json`, `contracts/features.json`, `contracts/ui.json`, `contracts/seo-pwa.json`, `contracts/content/**`, `contracts/fixtures/**`, `tools/extract-content/**`, `tools/lib/schemas.mjs`, `docs/rebuild/audit/A5-content.md` |
| `backend-eng` | `contracts/schema/**`, `contracts/media/**`, `docs/rebuild/audit/A3-data.md` |
| `parity-eng` | `tools/parity/**`, `contracts/parity-allowlist.json`, `docs/rebuild/PARITY.md` |
| `metrics-eng` | `tools/inventory/**`, `tools/baseline/**`, `contracts/baseline/metrics.json`, `docs/rebuild/BASELINE.md`, `docs/rebuild/audit/A6-quality.md` |
| `audit-arch` | `docs/rebuild/audit/A1-architecture.md`, `docs/rebuild/audit/A2-toolchain.md` |
| `audit-product` | `docs/rebuild/audit/A4-product.md`, `docs/rebuild/audit/A5-content.md` |

Never edit a file outside your scope, even to "fix a typo". Ask the owner or the Lead.

## 3. Legacy code is frozen

Allowed changes to legacy paths: only `package.json`, `package-lock.json`, `eslint.config.js`,
`.prettierignore`, `.gitignore`, `AGENTS.md`. Everything under `src/`, `scripts/`, `tests/`,
`supabase/`, `public/`, `netlify/`, `netlify.toml`, `vite.config.js`, `vitest.config.js`,
`tsconfig.json`, `playwright.config*.ts`, `index.html` is **read-only**.

Verify with `node tools/check-legacy-freeze.mjs`. It must print **Legacy freeze intact**.

## 4. Serialize heavy commands

Only the Lead runs:

- `npm install` / `npm ci`
- `npm run build`
- `npm run test:e2e*` (Playwright)
- `docker` / `npx supabase start|stop|db reset` while other members are active

Everyone may run, freely: `npm run lint`, `npx tsc --noEmit`, `npm run test:run`, `node tools/*`,
`npx prettier --check`. But do not run two heavy commands at once; if you need one, ask the Lead
and wait for a slot.

Never run `npm run dev` or `vite preview` on fixed ports (5173/4173/4174) without asking — the
legacy dev script kills whatever owns port 5173.

## 5. Production is untouchable

- No writes to Supabase (prod), Netlify, Cloudflare R2, DNS, or the deployed site.
- Read-only checks against the public site or a read-only credential are fine.
- Never put credentials, tokens, or `.env` contents in a file, log, report, or commit. Fixtures
  are synthetic.

## 6. Media is huge — do not copy it

`public/` is 3.6 GB (video 2.96 GB, audio 503 MB, images 139 MB; video/audio are gitignored).
Never copy, re-encode, move, or screenshot-embed media. Parity uses a fixed stub image and mocks
the CDN; contracts reference paths, not bytes.

## 7. Evidence or it did not happen

Every task completion message includes:

1. The files created/modified (paths).
2. The exact command(s) run and a short excerpt of the result.
3. What is **not** done / known gaps.
4. Any assumption you had to make.

Claims without command output are rejected at the checkpoint.

## 8. Commits

- Conventional Commits with a scope: `chore(workbench): …`, `docs(rebuild): …`,
  `test(parity): …`, `feat(contracts): …`.
- Commit your own files only; never `git add -A`, never commit another member's work.
- The Lead reviews the final diff and runs the gates.

## 9. Task board

1. Pick a ready task from the shared board.
2. Claim it with the current revision.
3. Do the work inside your write scope.
4. Run your own verification.
5. Complete the task with evidence in the description.
6. If blocked, report the concrete blocker — do not guess or expand scope.

## 10. Stop conditions

Report to the Lead immediately if:

- You need to touch a file outside your scope.
- A verification command fails twice for the same reason.
- You discover a production-safety issue (secret exposure, data loss risk, schema drift that
  would break the archive).
- The task turns out to be much larger than scoped (stop, propose a split).

## 11. Definition of done (per task)

- Files exist at the agreed paths and conform to `tools/lib/schemas.mjs` where applicable.
- `npm run workbench:verify` passes (or `--allow-missing` while artifacts are still landing).
- `node tools/check-legacy-freeze.mjs` passes.
- No secrets, no production data, no media copies.
- Evidence posted on the shared task.
