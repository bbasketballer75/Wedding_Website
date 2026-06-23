# AGENTS.md

Post-wedding digital archive for Austin & Jordyn (theporadas.com). React 19 + TypeScript SPA on Supabase (Postgres + Auth + Storage + Edge Functions), deployed to Netlify. Hosts the engagement story, chaptered wedding film, photo gallery with face recognition, guest uploads, digital guestbook, and an admin moderation portal.

## Setup commands

- Install deps: `npm install` (Node `>=20.19.0`, packageManager pinned to `npm@11.11.0`)
- Start dev:    `npm run dev` (custom `node scripts/dev.js` wrapper, default port 5173)
- Build:        `npm run build` (runs `postbuild` to prune local media, copy public images, generate sitemap)
- Test:         `npm run test:run` (Vitest) / `npm run test:e2e:public` (Playwright public-flow suite)
- Lint:         `npm run lint` (ESLint 9 flat config)
- Format:       `npm run format` (Prettier) / `npm run format:check`
- Typecheck:    `npx tsc --noEmit`
- Release gate: `npm run verify:release` (env + secrets + supabase + lint + tsc + test:run + build + test:e2e:public)

## Project layout

- `src/` — React app (App.tsx, main.tsx, pages/, components/, stores/, services/, lib/supabase.ts, workers/, tokens/, types/)
  - `src/components/` — feature folders: `gallery/`, `admin/`, `face-recognition/`, `family-tree/`, `photo-viewer/`, `sections/`, `layout/`, `ui/`, `accessibility/`, `seo/`, `share/`, `video/`, `notifications/`, `timeline/`, `search/`, `error/`, `activity/`
  - `src/pages/` — route components: `Home`, `Film`, `Gallery`, `Upload`, `Guestbook`, `People`, `GuestShare`, `Print`, `Admin`, `AdminLogin`, `NotFound`, `Activity`
  - `src/stores/` — Zustand stores (auth, gallery, ui)
  - `src/lib/supabase.ts` — single Supabase client + typed RPC wrappers
  - `src/workers/` — image processing, search, sync workers
- `scripts/` — Node `.js`/`.mjs` media batch pipelines (catalog/analyze/face-enrich/organize/optimize/publish/evaluate), supabase & release verification, dev/build helpers
- `supabase/` — migrations, `functions/` (Deno edge functions), `config.toml`, `schema.sql`, `seed.sql`
- `tests/` — Playwright e2e (`e2e/` public, `e2e-live/` against deployed site)
- `docs/archival/` — operational docs: `REPOSITORY_MANIFEST.md`, `PROJECT_OVERVIEW.md`, `DEPLOYMENT_CHECKLIST.md`, `GALLERY_OPERATIONS.md`, `SECURITY.md`, `PRE_LAUNCH_CHECKLIST.md`
- `public/` — static assets served as-is
- `netlify/`, `netlify.toml` — deployment config
- `.github/workflows/uptime-monitor.yml` — single CI workflow (uptime alerts)

## Code style

- TypeScript strict mode (`tsconfig.json: strict: true`), `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- Prettier: single quotes, no semicolons, 100-char width, 2-space indent, JSX single quotes, LF line endings (`.prettierrc`)
- ESLint 9 flat config (`eslint.config.js`): `@typescript-eslint`, `react-hooks`, `react-refresh`, `jsx-a11y`, `prettier`; custom rules `prefer-const`, `prefer-arrow-callback`, `prefer-template`, `no-var`
- Run `npm run fix` (lint:fix + format) before committing; husky + lint-staged wired via `lint-staged` config in `package.json`
- Path alias: `@/*` → `src/*` (tsconfig + Vite)
- Tailwind CSS v4 via `@tailwindcss/vite` plugin (no `tailwind.config`); design tokens live in `src/tokens/designTokens.ts` and are surfaced through CSS `@layer` directives

## Testing instructions

- Unit tests: `npm run test:run` (Vitest, jsdom, Testing Library). Coverage: `npm run test:coverage`
- E2E tests: `npm run test:e2e:public` for the gated public subset (home, film, gallery, upload, guestbook, a11y, shell, smoke, seo). Full suite: `npm run test:e2e`. UI mode: `npm run test:e2e:ui`
- Visual regression: `npm run test:visual` (Playwright with `playwright.config.visual.ts`); update snapshots with `npm run test:visual:update`
- Add tests alongside the change — co-locate unit tests as `*.test.ts(x)` next to source; e2e specs under `tests/e2e/`
- All tests must pass before opening a PR. The full release gate is `npm run verify:release`

## PR & commit conventions

- Branch from `main`; never push to it directly
- Commit messages use Conventional Commits with an optional scope prefix (e.g. `feat(gallery): …`, `fix(admin): …`, `chore(deps): …`, `test(e2e): …`). Recent history is dominated by `conductor(plan)` / `conductor(checkpoint)` markers plus `feat`, `fix`, `chore`, `test` scope commits
- Open PR via `gh pr create` once CI is green
- Husky pre-commit runs `eslint --fix` + `prettier --write` on staged files (`.{js,jsx,ts,tsx}`, `.{json,css,md}`)

## Security

- Never commit secrets — `.env` is in `.gitignore`; the project ships `.env.example` and a `verify:secrets` check (`scripts/verify-repo-secrets.js`)
- Supabase uses RLS on all tables; edge functions live under `supabase/functions/`
- Guest uploads + guestbook are public input surfaces — every change to moderation, rate limiting, or storage policies must be reviewed against `docs/archival/SECURITY.md`
- Production sanity check: `npm run verify:supabase` and `npm run verify:deployed`
