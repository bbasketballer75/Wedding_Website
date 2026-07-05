# Local & GitHub Cleanup Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Clean up scratch files, dead worktree directory, push 9 local commits to GitHub, and merge the open Dependabot security PR.

**Architecture:** Four independent shell/git tasks. No code changes. No tests required. Each task is a single command or two.

**Tech Stack:** Git, GitHub CLI (`gh`), Windows shell

---

### Task 1: Delete scratch files

Leftover files from the DB import session. None are committed or needed.

**Files to remove:**

- `gallery-*.png` (6 screenshots in project root)
- `scripts/batch*.sql` (22 batch SQL files)
- `scripts/photo-manifest.json`
- `scripts/seed-all-photos.sql`
- `scripts/seed-photos.sql`
- `scripts/upload-photos-to-r2.js`
- `supabase/migrations/20260413_seed_photos_batch*.sql` (7 files)

**Step 1: Preview what will be deleted**

```bash
cd "C:/Users/bbask/Coding_Projects/Wedding_Website_Clean"
git clean -n --exclude=".claude/" -- "gallery-*.png" "scripts/batch*.sql" "scripts/photo-manifest.json" "scripts/seed-all-photos.sql" "scripts/seed-photos.sql" "scripts/upload-photos-to-r2.js" "supabase/migrations/20260413_seed_photos_batch*.sql"
```

Expected: lists ~37 files, no tracked files mentioned.

**Step 2: Delete them**

```bash
git clean -f --exclude=".claude/" -- "gallery-*.png" "scripts/batch*.sql" "scripts/photo-manifest.json" "scripts/seed-all-photos.sql" "scripts/seed-photos.sql" "scripts/upload-photos-to-r2.js" "supabase/migrations/20260413_seed_photos_batch*.sql"
```

Expected: `Removing gallery-after-edit.png` … for each file.

**Step 3: Verify**

```bash
git status --short
```

Expected: Only `M .claude/settings.local.json` and `?? .claude/worktrees/` remain untracked.

---

### Task 2: Delete the stale worktree directory

The `.claude/worktrees/brave-chaum/` folder is already deregistered from git — it only contains `.claude/` and `.playwright-mcp/` leftover from the session.

**Step 1: Confirm it's not registered**

```bash
cd "C:/Users/bbask/Coding_Projects/Wedding_Website_Clean"
git worktree list
```

Expected: Only one line — the main working tree at `C:/Users/bbask/Coding_Projects/Wedding_Website_Clean`.

**Step 2: Remove the directory**

```bash
rm -rf ".claude/worktrees/brave-chaum"
```

**Step 3: Verify**

```bash
ls .claude/worktrees/ 2>/dev/null || echo "worktrees dir empty or gone"
```

Expected: empty or directory doesn't exist.

---

### Task 3: Push 9 commits to GitHub

All work from this session lives only locally. Push to sync with origin and trigger a Netlify deploy.

**Step 1: Confirm what will be pushed**

```bash
cd "C:/Users/bbask/Coding_Projects/Wedding_Website_Clean"
git log origin/main..HEAD --oneline
```

Expected: 9 commits listed (from `71a51f9e` through `d00cddfe`).

**Step 2: Push**

```bash
git push
```

Expected: `main -> main` pushed successfully, Netlify deploy triggered.

---

### Task 4: Merge Dependabot PR #17

PR #17 bumps Vite from 7.3.1 → 7.3.2. This is a **security patch** — it fixes a path traversal vulnerability in the optimize deps sourcemap handler and a `server.fs` check bypass. All Netlify checks pass.

**Step 1: Confirm checks still green**

```bash
cd "C:/Users/bbask/Coding_Projects/Wedding_Website_Clean"
gh pr checks 17
```

Expected: all checks `pass`.

**Step 2: Merge**

```bash
gh pr merge 17 --merge --subject "chore(deps-dev): bump vite 7.3.1 → 7.3.2 (security patch)"
```

Expected: PR merged, branch deleted on GitHub.

**Step 3: Pull the merge commit locally**

```bash
git pull
```

Expected: fast-forward to include the Dependabot merge commit.
