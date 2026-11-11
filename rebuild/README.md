# theporadas rebuild (greenfield)

The new app, built beside the frozen legacy app and held to
[`docs/rebuild/QUALITY_BAR.md`](../../docs/rebuild/QUALITY_BAR.md). Wave 1 = scaffold + shell; no
feature is ported yet.

## Setup

```bash
cd rebuild
npm install
cp .env.example .env   # fill in the public Supabase values (or leave the placeholders)
npm run dev            # http://127.0.0.1:5174
```

The legacy app keeps its own root-level commands and ports (5173); the two never share a build.

## Scripts

| Command                           | What it does                              |
| --------------------------------- | ----------------------------------------- |
| `npm run dev`                     | Vite dev server on 5174                   |
| `npm run build` / `preview`       | production build / preview on 5175        |
| `npm run lint` / `lint:fix`       | ESLint 9, type-aware                      |
| `npm run format` / `format:check` | Prettier                                  |
| `npm run typecheck`               | TypeScript 7 (`tsc`)                      |
| `npm run typecheck:ts6`           | TypeScript 6 compatibility check (`tsc6`) |
| `npm run test:run`                | Vitest + Testing Library                  |
| `npm run test:coverage`           | coverage with thresholds                  |
| `npm run test:e2e`                | Playwright smoke (production build)       |

## TypeScript: why two compilers

`typescript-eslint@8` supports TypeScript `<6.1.0`, while the compiler is already at 7. Following the
frozen repo's proven setup, the `typescript` package is the TS 6 build (so lint/type-aware analysis
works) and `@typescript/native` is TS 7 (the real `tsc`). CI runs both checks; a drift between them
is a bug.

## Structure

```
src/
  app/        entry, router, shell (header/footer/skip link/theme/errors), styles, env, seo
  features/   one folder per product feature (placeholders in Wave 1)
  shared/     ui primitives, lib helpers, future typed data layer
tests/        setup + unit tests that are not colocated
```

## Parity

The frozen app remains the oracle. The workbench harness compares production builds:

```bash
# from the repo root, with the legacy preview on :4174 and this app built + served on :5175
node tools/parity/compare.mjs --legacy-url http://127.0.0.1:4174 \
  --rebuild-url http://127.0.0.1:5175 --routes priority --matrix all
```

Rules live in [`docs/rebuild/PARITY.md`](../../docs/rebuild/PARITY.md).

## Environment

See `.env.example`. Values are public (`VITE_*`); no service-role keys ever live in the client.
