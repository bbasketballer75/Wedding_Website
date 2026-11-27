# CLAUDE.md

> **This file is intentionally a pointer.** All repository guidance lives in [`AGENTS.md`](./AGENTS.md), which is the single source of truth and is read by every agent working in this repo (Claude Code, Cline, Codex, Copilot, …).

Read [`AGENTS.md`](./AGENTS.md) before making changes. It covers:

- Setup, build, lint, test, and release-gate commands
- Project layout (`src/`, `scripts/`, `supabase/`, `tests/`, `docs/archival/`)
- Code style (TypeScript 6, Prettier, ESLint 9, Tailwind v4, design tokens)
- Testing conventions (Vitest unit, Playwright e2e, visual regression)
- PR and commit conventions
- Security rules — including **Doppler as the source of truth for secrets**

## Additional deep-dive docs

`AGENTS.md` is the operational summary. These are long-form and worth reading when relevant:

- [`docs/archival/REPOSITORY_MANIFEST.md`](./docs/archival/REPOSITORY_MANIFEST.md) — full file-by-file map
- [`docs/archival/PROJECT_OVERVIEW.md`](./docs/archival/PROJECT_OVERVIEW.md) — architecture narrative
- [`docs/archival/SECURITY.md`](./docs/archival/SECURITY.md) — **required reading** before touching moderation, rate limiting, or storage policies
- [`docs/archival/GALLERY_OPERATIONS.md`](./docs/archival/GALLERY_OPERATIONS.md) — media pipeline runbook
- [`docs/archival/MEDIA_BATCH_WORKFLOW.md`](./docs/archival/MEDIA_BATCH_WORKFLOW.md) — photo batch processing
- [`docs/archival/DEPLOYMENT_CHECKLIST.md`](./docs/archival/DEPLOYMENT_CHECKLIST.md) — Netlify deploy steps

**Do not duplicate guidance here.** If you find something missing, add it to `AGENTS.md` so every agent benefits — keeping two parallel copies is what previously let them drift out of date.
