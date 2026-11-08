# Quality Bar — greenfield app (Wave 1+ acceptance)

The rebuild must not just match the archive; it must be measurably better to maintain. These are
the floors every new-app PR is held to. They are intentionally stricter than the legacy app's
config (which is frozen and cannot be changed).

## TypeScript

- `strict: true`, plus `noUncheckedIndexedAccess`, `verbatimModuleSyntax`,
  `noUnusedLocals`, `noUnusedParameters`, `noImplicitOverride`, `exactOptionalPropertyTypes`
  (adopt `exactOptionalPropertyTypes` in Wave 3 when the data layer is written; note the decision
  in the app README if it is deferred).
- `@typescript-eslint` type-aware rules enabled (`recommended-type-checked` + `stylistic-type-checked`).
- `@typescript-eslint/no-explicit-any: error`; `no-non-null-assertion: error`.
- No `.js`/`.jsx` source files in the new app; no `allowJs`.
- Generated Supabase types are imported as `Database` and passed to `createClient<Database>` —
  hand-written row interfaces are forbidden when a generated type exists.

## Lint / format

- ESLint flat config, type-aware, `react-hooks` v7 full rules, `jsx-a11y` strict, `import-x` with
  `no-cycle` and import ordering, `@tanstack/query` plugin if TanStack Query is adopted.
- Prettier owns formatting; no formatting rules in ESLint.
- `lint-staged` + husky on staged files; CI fails on warnings.

## Testing

- Unit/component: Vitest + Testing Library, one test file next to each module with logic.
- Coverage thresholds enforced in `vitest.config.ts`: lines 80, functions 80, statements 80,
  branches 75 (domain/data modules), raised per wave; no threshold regressions.
- Contract tests hit a **local** Supabase sandbox (never prod) for RLS, RPCs, rate limits,
  moderation transitions.
- E2E: Playwright on production builds, critical flows only (guestbook submit, upload, gallery
  lightbox/download/share, admin login + moderation), deterministic mocks, no sleeps.
- Visual/parity: the Wave 0 harness is the gate for every route until cutover.
- Accessibility: axe on every route, zero critical/serious; keyboard-only path test per flow.
- No flaky tests: retries only for documented third-party jitter; a test that fails twice is fixed
  or deleted, never quarantined silently.

## Performance budgets

- Initial JS for `/` ≤ 180 KB gzip; any route ≤ 120 KB gzip incremental; total JS ≤ 450 KB gzip.
- LCP ≤ 2.0 s on a mid-tier mobile profile; CLS ≤ 0.05; INP ≤ 200 ms.
- Images: responsive `srcset` + AVIF/WebP, explicit dimensions or aspect ratio (no CLS), blurhash
  placeholder, lazy below the fold, `fetchpriority` for LCP.
- Video/audio: poster-first, preload none/metadata, never autoplay with sound.
- Lighthouse CI budgets wired in CI (performance ≥ 90 mobile on `/`, `/gallery`, `/film`).
- Bundle analysis on every release build; a chunk-size regression fails the budget check.

## Accessibility

WCAG 2.2 AA: focus visible and never trapped, semantic landmarks, labels for every control,
`prefers-reduced-motion` respected, captions/subtitles for the film, screen-reader announcements
for route changes, 200% zoom usable, color contrast ≥ 4.5:1 for body text / ≥ 3:1 for large text.

## Security

- RLS on every table; no service-role key in the client; secrets only in server runtimes.
- Guest inputs: schema validation at the boundary, sanitization on render, rate limits enforced
  server-side, no PII in logs.
- CSP without `unsafe-eval`; `unsafe-inline` only if the measured build requires it, documented.
- Dependency policy: no new runtime dep without a decision note (what it replaces, size, license,
  maintenance status); `npm audit` clean at high/critical or an owner-approved exception.
- Sentry: source maps uploaded per release, PII scrubbing on, `beforeSend` redaction.

## Operations / longevity

- One command local setup (`npm ci && npm run dev`), documented in the app README.
- Env contract documented and validated at boot (fail fast with a readable error).
- Runbooks: deploy, rollback, backup/restore, rotate keys, publish media, moderate content.
- Data export path documented (guestbook, uploads, photo metadata) in an open format.
- No vendor capability without a documented fallback.

## Definition of done for every wave

`lint` 0, `typecheck` 0, unit tests green with thresholds, contract tests green, e2e critical
flows green, parity within tolerance on all priority routes, axe clean, budgets met, docs updated,
no secrets, legacy freeze intact, checkpoint report written.
