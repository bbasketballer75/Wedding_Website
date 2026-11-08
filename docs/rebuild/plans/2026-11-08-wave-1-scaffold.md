# Wave 1 Plan — Scaffold, tooling, and shell

> Status: **in progress** (approved stack: S1). Owner: Lead. Branch: `rebuild/greenfield`.
> Predecessor: [Wave 0 checkpoint](../checkpoints/2026-11-08-wave-0.md). New app: `rebuild/`.

## Goal

Stand up the greenfield app with the quality bar enforced from the first commit, port the app shell
(header, footer, skip link, theme, page transition, error boundaries, 404) to **pixel parity**, and
prove the root legacy app is untouched. No feature is ported in this wave.

## Exit criteria

1. `rebuild/` app builds, typechecks (TS 7), lints (ESLint 9, type-aware), and unit-tests green.
2. Quality bar wired: strict TS flags, type-aware ESLint, coverage thresholds, env schema,
   Prettier, Vitest + Testing Library, Playwright config, conventional scripts.
3. Shell parity: the 404 route (`/people`, which is a real 404 in the legacy app) matches the
   frozen oracle at desktop + mobile, dark + light, within the documented tolerance; text/DOM
   parity is 0 diffs.
4. Root gates stay green (`lint`, `format:check`, `tsc`, `test:run`, `workbench:verify`, freeze),
   and `rebuild.yml` runs the new app's gates in CI.
5. No legacy source edits; no production/data/media changes.

## Decisions locked for the new app

| Topic | Decision | Why |
|---|---|---|
| Layout | `rebuild/` is an isolated npm project (no workspaces) | keeps the legacy Netlify build and root tooling untouched |
| Runtime | Node 22 baseline, npm 11.11 pin | matches CI/Netlify; local Node 26 also works |
| TypeScript | TS 7 for `tsc`, TS 6 (`npm:@typescript/typescript6`) for typescript-eslint | typescript-eslint peer range is `<6.1.0`; proven dual setup |
| Lint | ESLint 9 + typescript-eslint 8 (type-aware), react-hooks 7, react-refresh, jsx-a11y | jsx-a11y caps at ESLint 9 (A2 finding); revisit at Wave 8 |
| Routing | TanStack Router, code-based route tree | type-safe, deterministic, no file-gen step |
| Server state | TanStack Query provider mounted (unused until Wave 3) | one place for the data layer |
| Styling | Tailwind 4 via `@tailwindcss/vite` + legacy CSS variables kept verbatim | parity requires the same token names |
| State | React context for shell state this wave; Zustand only if a real need appears | YAGNI |
| Tests | Vitest + jsdom + Testing Library; Playwright only for shell smoke | fast feedback |

## File structure

```
rebuild/
  package.json  tsconfig.json  vite.config.ts  eslint.config.js  prettier config
  index.html  playwright.config.ts  README.md
  src/
    main.tsx
    app/            App.tsx, router.tsx, providers/, shell/, styles/, env.ts
    features/       home/, not-found/ (placeholders), one folder per future feature
    shared/         ui/, lib/, data/ (stubs)
  tests/            setup.ts, unit/, e2e/
```

## Work packages

| ID | Owner | Deliverable | Acceptance |
|---|---|---|---|
| W1-1 | Lead | Scaffold: package/configs/env/router/app entry/providers/CI wiring | install + build + lint + typecheck + test green |
| W1-2 | design-eng | Tokens, fonts (`@fontsource`), global CSS, theme variables — legacy names kept verbatim | theme classes toggle, axe-clean 404, tokens documented |
| W1-3 | shell-eng | Header, Footer, SkipLink, PageTransition, RouteErrorBoundary, ThemeController, announcement region, 404 page | keyboard path + focus restore; visual parity on 404 |
| W1-4 | Lead | Unit/component tests + Playwright shell smoke | tests green, coverage threshold met |
| W1-5 | Lead + parity-eng | Parity run against `rebuild/dist` for the 404 route, both viewports/themes | 0 unexplained pixel/text diffs |
| W1-6 | Lead | Checkpoint report + safety gate before Wave 2 | evidence, risks, stop for owner |

## Risk controls

- The legacy app stays the oracle: no shell component is ported from memory; each is diffed against
  the frozen build.
- Parity harness already exists; Wave 1 only supplies a second URL.
- Tailwind 4 utility classes are not used for parity-critical pixels until the tokens/CSS are
  proven; the shell keeps the legacy CSS-variable contract.
- Anything that cannot be made pixel-identical is added to the parity allowlist with a reason and
  an expiry wave, never silently accepted.
