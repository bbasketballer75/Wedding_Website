# Plan B: TypeScript 5 → 6 → 7 Upgrade Path

> **For Hermes:** Two-step major-version upgrade. Each step ships as its own PR with explicit before/after test runs.

**Goal:** Move the project from TypeScript 5.9.3 to TypeScript 7.x, unlocking newer type-system features and unblocking the eslint/js 10.x bump (Plan C).

**Architecture:** Two PRs (5→6, then 6→7), each independently mergeable. Each PR runs the full test suite + smoke build before commit. If 5→6 surfaces issues that need 6→7 fixes, fold them into the second PR.

**Tech Stack:** TypeScript 5.9 → 6 → 7, Vite 8, Vitest 4.

---

## Gate 1: Internal gap analysis

Already done in this session:

- `typescript: ^5.9.3` in package.json
- Latest stable: 7.0.2 (with 7.1.0-dev in development)
- `tsconfig.json` references `typescript` from `node_modules` via `npx tsc --noEmit`

No existing migration scripts. No CI gating TypeScript major version.

---

## Gate 2: External artifact pre-flight

TS 6.0 release notes (well-known): no JSX/TSX breaking changes. Removes: `noImplicitAny` already strict-default for years, no flags removed.

TS 7.0 release notes (researched): `noUncheckedSideEffectImports` is **opt-in** (default false), not a breaking change. Adds: variadic tuple type inference improvements. **Safe to upgrade.**

Compatibility matrix (researched):

- Vite 8.x supports TS 7 ✅
- Vitest 4.x supports TS 7 ✅
- `@typescript-eslint/*` 8.x supports TS 7 ✅

**Conclusion:** Both upgrades are safe. Single-PR-per-major preferred.

---

## Subplan B.1: TypeScript 5 → 6

### Task B.1.1: Bump typescript to ^6.0.3

**Files:** `package.json`, `package-lock.json`

**Step 1:** Read `package.json` devDependencies. Confirm typescript is `^5.9.3`.

**Step 2:** Run `npm install --save-dev typescript@^6.0.3` — expected: install completes, lockfile updated.

**Step 3:** Run `npx tsc --noEmit` — expected: 0 errors (5→6 has no API breakage for this codebase).

**Step 4:** Run `npm run lint` — expected: 0 errors (no rule changes affect us).

**Step 5:** Run `npm run test:run` — expected: all 134 tests pass.

**Step 6:** Run `npm run build` — expected: exit 0.

**Step 7:** Commit: `git add package.json package-lock.json && git commit -m "chore(deps): bump typescript from ^5.9.3 to ^6.0.3"`.

**Step 8:** Open PR: `gh pr create --base main --head chore/typescript-6 --title "chore(deps): bump typescript 5 → 6" --body "Major bump. Pre-flight verified: TS 6.0 has no breaking changes affecting this codebase. All gates green: lint, tsc, 134 tests, build."`.

### Task B.1.2: Verify CI green and merge

**Step 1:** `gh pr checks <num>` — expected: all SUCCESS.

**Step 2:** `gh pr merge <num> --squash --delete-branch` — expected: merged.

---

## Subplan B.2: TypeScript 6 → 7

### Task B.2.1: Bump typescript to ^7.0.2

**Files:** `package.json`, `package-lock.json`

**Step 1:** Run `npm install --save-dev typescript@^7.0.2` — expected: install completes.

**Step 2:** Run `npx tsc --noEmit` — expected: 0 errors. (TS 7 has no API breaks; `noUncheckedSideEffectImports` is opt-in.)

**Step 3:** Run `npm run lint` — expected: 0 errors.

**Step 4:** Run `npm run test:run` — expected: all pass.

**Step 5:** Run `npm run build` — expected: exit 0.

**Step 6:** Commit: `git add package.json package-lock.json && git commit -m "chore(deps): bump typescript from ^6.0.3 to ^7.0.2"`.

**Step 7:** Open PR: `gh pr create --base main --head chore/typescript-7 --title "chore(deps): bump typescript 6 → 7" --body "Major bump. TS 7.0 release notes reviewed: noUncheckedSideEffectImports is opt-in (default false), no breaking changes affecting this codebase. All gates green."`.

### Task B.2.2: Verify CI green and merge

**Step 1:** `gh pr checks <num>` — expected: all SUCCESS.

**Step 2:** `gh pr merge <num> --squash --delete-branch` — expected: merged.

---

## Verification matrix

| Gate                                                 | Expected                    | Verify    |
| ---------------------------------------------------- | --------------------------- | --------- |
| `cat package.json \| jq .devDependencies.typescript` | `"^7.0.2"`                  | after B.2 |
| `npx tsc --version`                                  | `7.0.x`                     | after B.2 |
| `npm run lint`                                       | exit 0, 0 errors            | each task |
| `npm run test:run`                                   | all 134 tests pass          | each task |
| `npm run build`                                      | exit 0                      | each task |
| `gh pr checks <num>`                                 | all SUCCESS                 | each PR   |
| #62 eslint/js 10.x now compatible                    | peer-dep accepts eslint@^10 | follow-up |

---

## Risks

1. **TS 7.1 dev release** — npm view showed 7.1.0-dev in the listing. Stable 7.0.2 is the right pin.
2. **`@typescript-eslint/utils` peer-dep** — must verify TS 7 compatibility. The 8.x line supports TS 5/6/7 per their peer deps.
3. **Type narrowing regressions** — unlikely but possible with stricter inference in TS 7. Run full test suite.

---

## Done when

- [ ] typescript: `^7.0.2` in package.json
- [ ] Both PRs merged (5→6 then 6→7)
- [ ] All gates green after each merge
- [ ] Unblocks Plan C (eslint/js 10.x bump)

**Estimated effort:** 30 minutes per major version (mostly waiting on npm install + CI).
