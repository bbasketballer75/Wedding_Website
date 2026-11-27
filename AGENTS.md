# AGENTS.md

Post-wedding digital archive for Austin & Jordyn (theporadas.com). React 19 + TypeScript SPA on Supabase (Postgres + Auth + Storage + Edge Functions), deployed to Netlify. Hosts the engagement story, chaptered wedding film, photo gallery with face recognition, guest uploads, digital guestbook, and an admin moderation portal.

## Setup commands

- Install deps: `npm install` (Node `>=22.0.0`, packageManager pinned to `npm@11.11.0`)
- Start dev: `npm run dev` (custom `node scripts/dev.js` wrapper, default port 5173)
- Build: `npm run build` (runs `postbuild` to prune local media, copy public images, generate sitemap)
- Test: `npm run test:run` (Vitest) / `npm run test:e2e:public` (Playwright public-flow suite)
- Lint: `npm run lint` (ESLint 9 flat config)
- Format: `npm run format` (Prettier) / `npm run format:check`
- Typecheck: `npx tsc --noEmit`
- Release gate: `npm run verify:release` (env + secrets + supabase + lint + tsc + test:run + build + test:e2e:public)

## Project layout

- `src/` — React app (App.tsx, main.tsx, pages/, components/, stores/, services/, lib/supabase.ts, workers/, tokens/, types/)
  - `src/components/` — feature folders: `gallery/`, `admin/`, `family-tree/`, `photo-viewer/`, `sections/`, `layout/`, `ui/`, `accessibility/`, `seo/`, `share/`, `video/`, `notifications/`, `timeline/`, `search/`, `error/`, `activity/`, `theme/`
    - Note: the face-recognition **frontend** was removed in #156; face data now lives in `media_review_*` tables, the `guest-face-tagging-admin` edge function, and the `scripts/media:batch:faces*` pipelines
  - `src/pages/` — route components: `Home`, `Film`, `Gallery`, `Upload`, `Guestbook`, `GuestPhotos`, `GuestShare`, `Print`, `Admin`, `AdminLogin`, `NotFound`, `Activity` (co-located `*.test.tsx` files live alongside)
  - Routes are defined in `src/App.tsx`: `/`, `/film`, `/gallery`, `/upload`, `/guestbook`, `/guest-photos`, `/activity`, `/guest/:token`, `/print`, `/admin/login`, `/admin/*`, `*` (NotFound). There is no `/people` route
  - `src/stores/` — Zustand stores (auth, gallery, ui, activityFeed, claim, download, mediaReview, moderation)
  - `src/lib/supabase.ts` — single Supabase client + typed RPC wrappers
  - `src/workers/` — image processing, search, sync workers
- `scripts/` — Node `.js`/`.mjs` media batch pipelines (catalog/analyze/face-enrich/organize/optimize/publish/evaluate), supabase & release verification, dev/build helpers
- `supabase/` — migrations, `functions/` (Deno edge functions), `config.toml`, `schema.sql`, `seed.sql`
- `tests/` — Playwright e2e (`e2e/` public, `e2e-live/` against deployed site)
- `docs/archival/` — 22 operational docs, notably `REPOSITORY_MANIFEST.md`, `PROJECT_OVERVIEW.md`, `DEPLOYMENT_CHECKLIST.md`, `GALLERY_OPERATIONS.md`, `SECURITY.md`, `PRE_LAUNCH_CHECKLIST.md`, `LAUNCH_RUNBOOK.md`, `MEDIA_BATCH_WORKFLOW.md`
- `public/` — static assets served as-is
- `netlify/`, `netlify.toml` — deployment config
- `.github/workflows/` — 7 workflows: `ci.yml`, `codeql.yml`, `lighthouse-ci.yml`, `auto-merge-patch.yml`, `visual-prod.yml`, `pr-review-claude.yml`, `uptime-monitor.yml`

## Code style

- TypeScript: pinned to `npm:@typescript/typescript6@6.0.2`. `npx tsc --noEmit` is the current compiler; `npm run typecheck:legacy` (`tsc6`) checks against the legacy alias
- `tsconfig.json`: `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `target/lib` ES2020
- Prettier: single quotes, no semicolons, 100-char width, 2-space indent, JSX single quotes, `arrowParens: "avoid"`, LF line endings (`.prettierrc`)
- ESLint 9 flat config (`eslint.config.js`): `js`, `@typescript-eslint`, `react`, `react-hooks`, `react-refresh`, `jsx-a11y`, `eslint-config-prettier`; custom rules `prefer-const`, `no-var`, `object-shorthand`, `prefer-arrow-callback`, `prefer-template`. `no-unused-vars` uses `varsIgnorePattern: '^[A-Z_]'`. `.claude/`, `supabase/`, `netlify/`, `.worktrees/` are all ignored by lint
- Run `npm run fix` (lint:fix + format) before committing; husky + lint-staged wired via `lint-staged` config in `package.json`
- Path alias: `@/*` → `src/*` (tsconfig + Vite)
- Tailwind CSS v4 via `@tailwindcss/vite` plugin in `vite.config.js` (no `tailwind.config`); design tokens live in `src/tokens/designTokens.ts` and are surfaced through CSS `@layer` directives
- Bundler: Vite 8 with React Compiler (`target: '19'`)

## Testing instructions

- Unit tests: `npm run test:run` (Vitest, jsdom, Testing Library). Coverage: `npm run test:coverage`
- E2E tests: `npm run test:e2e:public` for the gated public subset (home, film, gallery, upload, guestbook, a11y, shell, smoke, seo). Full suite: `npm run test:e2e`. UI mode: `npm run test:e2e:ui`
- Visual regression: `npm run test:visual` (Playwright with `playwright.config.visual.ts`); update snapshots with `npm run test:visual:update`
- Add tests alongside the change — co-locate unit tests as `*.test.ts(x)` next to source; e2e specs under `tests/e2e/`
- All tests must pass before opening a PR. The full release gate is `npm run verify:release`

## PR & commit conventions

- Branch from `main`; never push to it directly
- Commit messages use Conventional Commits with an optional scope prefix (e.g. `feat(gallery): …`, `fix(admin): …`, `chore(deps): …`, `test(e2e): …`). Recent history is dominated by `chore(deps)` Dependabot bumps and scoped `fix`/`refactor` commits
- Open PR via `gh pr create` once CI is green
- Husky pre-commit runs `eslint --fix` + `prettier --write` on staged files (`.{js,jsx,ts,tsx}`, `.{json,css,md}`)

## Security

- **Doppler is the source of truth for secrets.** Never store API keys, tokens, or credentials in Windows environment variables, `package.json`, or any tracked file. Pull them at runtime instead:
  ```bash
  doppler run --project theporadas-website --config dev -- npm run dev
  ```
  Configs: `dev`, `dev_personal`, `stg`, `prd` (all `locked: true`)
- Local development falls back to a gitignored `.env` (currently holds `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SITE_URL`). `.gitignore` covers `.env`, `.env.local`, `.env.*.local`, `.env.*` with `!.env.example`
- Only `VITE_`-prefixed vars reach the browser bundle; they are inlined by Vite at build time and are public by design. The Supabase **anon** key is RLS-scoped — never introduce a `service_role` key into any `VITE_` var
- `npm run verify:secrets` (`scripts/verify-repo-secrets.js`) is part of the release gate and must stay green
- Supabase uses RLS on all tables; the sole edge function is `supabase/functions/guest-face-tagging-admin`
- Guest uploads + guestbook are public input surfaces — every change to moderation, rate limiting, or storage policies must be reviewed against `docs/archival/SECURITY.md`
- Production sanity check: `npm run verify:supabase` and `npm run verify:deployed`
