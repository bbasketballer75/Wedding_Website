# Planning Systems Archive (2025)

This directory holds historical planning artifacts from the two previous planning systems that were used on this project:

- **`.planning/`** — from the GSD (Get-Shit-Done) v2 workflow (~9 milestones, 19 phases, STATE/ROADMAP files)
- **`.gsd/`** — from the GSD v1 workflow (CODEBASE.md, KNOWLEDGE.md, JOURNAL, etc.)

Both systems are now **superseded by `.harness/`** — the multi-agent team structure that was set up via the `/init` workflow in 2026-06-23.

## Why archived instead of deleted?

The artifacts document real architectural decisions, security migrations, and feature work that's still relevant. Keeping them as read-only reference avoids losing institutional knowledge while letting the new `.harness/` reins (frontend-dev, supabase-expert, media-pipeline-expert, admin-moderation-expert, release-qa) own active planning.

## If you need to reference an old decision

- **GSD v1 files** → `.gsd/CODEBASE.md`, `.gsd/PROJECT.md`, `.gsd/REQUIREMENTS.md` — code structure + original spec
- **GSD v2 files** → `.planning/STATE.md`, `.planning/MILESTONES.md`, `.planning/PROJECT.md` — milestone history
- **Migration history** → `supabase/migrations/` (canonical, not duplicated here)

## Active planning lives here

- **`.harness/`** — multi-agent rein definitions (agent.md per rein)
- **`.planning/` and `.gsd/`** at the repo root — **removed** (moved here on 2026-06-23)