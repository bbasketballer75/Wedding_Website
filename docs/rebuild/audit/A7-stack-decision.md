# A7 — Stack Decision (DRAFT — pending A1/A2/A4/A6 inputs)

> **Status:** draft framework. Scores and the recommendation are filled only after the audit
> evidence lands. This file is the Lead's synthesis; it must cite the audit artifacts below and
> make a single, reversible recommendation for the owner's approval gate.
>
> Inputs: [A1-architecture](./A1-architecture.md) · [A2-toolchain](./A2-toolchain.md) ·
> [A3-data](./A3-data.md) · [A4-product](./A4-product.md) · [A5-content](./A5-content.md) ·
> [A6-quality](./A6-quality.md) · [BASELINE](../BASELINE.md)

## 1. Constraints inherited from the product contract

1. Pixel and text parity on every route; the legacy app is the oracle.
2. Public archive, no login for guests; admin behind Supabase Auth + RLS.
3. Media-heavy: 139 MB tracked images, 3.6 GB local media directed at R2/CDN, galleries of
   hundreds of photos, a 45-minute chaptered film.
4. SEO matters only for share previews and discoverability; today it is solved by static
   per-route metadata plus one Netlify edge function that injects OG tags for shared photos.
5. PWA/offline is part of the product today (manifest + Workbox caching + offline page).
6. Deploy target is Netlify with Netlify Functions/Edge Functions, and that is expected to stay.
7. One non-specialist owner must be able to maintain it for years; the rebuild should minimise
   moving parts (`docs/rebuild/QUALITY_BAR.md`).
8. The rebuild is greenfield, so the stack may change — but every change must pay for its parity
   and migration cost.

## 2. Criteria and weights

| # | Criterion | Weight | What counts |
|---|---|---|---|
| C1 | Parity effort | 25 | How cheaply the frozen UI/behavior can be reproduced exactly (routing, animations, lightbox, virtualization, video, admin) |
| C2 | Maintainability & ecosystem | 20 | Stable releases, docs, hiring/agent-friendliness, upgrade path, lock-in |
| C3 | Performance | 15 | Route JS, media handling, LCP/CLS on mid-tier mobile, caching |
| C4 | SEO / OG | 10 | Per-route metadata, share previews, prerender/SSR options |
| C5 | Deploy & cost fit | 10 | Netlify support, functions/edge, build time, hosting cost |
| C6 | Migration risk | 10 | Data/auth/storage compatibility, cutover complexity, rollback |
| C7 | Testability & agent-friendliness | 10 | Deterministic builds, unit/e2e/contract testing, CI speed, how easily agents reason about it |

Scores: 1 (poor) … 5 (excellent), weighted total out of 5.00.

## 3. Candidates

| ID | Candidate | Shape |
|---|---|---|
| S1 | **Vite + React 19 + TypeScript SPA** (current toolchain family), TanStack Router + TanStack Query, Tailwind 4, static Netlify, existing edge/function layer | Client-rendered archive, same deploy model |
| S2 | **Next.js App Router on Netlify** | SSR/ISR + image optimisation; metadata via server components; heavier runtime |
| S3 | **Astro + React islands** | Static-first pages with hydrated interactive islands; content collections; admin as an island/SPA |
| S4 | **React Router 7 framework mode** | SSR + nested routes + data loaders; Netlify adapter |
| S5 | **TanStack Start** | Full-stack React with SSR/server functions; newest ecosystem |

## 4. Scoring (to fill from evidence)

| Criterion | Weight | S1 | S2 | S3 | S4 | S5 |
|---|---|---|---|---|---|---|
| C1 parity effort | 25 | — | — | — | — | — |
| C2 maintainability | 20 | — | — | — | — | — |
| C3 performance | 15 | — | — | — | — | — |
| C4 SEO/OG | 10 | — | — | — | — | — |
| C5 deploy/cost | 10 | — | — | — | — | — |
| C6 migration risk | 10 | — | — | — | — | — |
| C7 testability | 10 | — | — | — | — | — |
| **Weighted total** | 100 | — | — | — | — | — |

## 5. Evidence to attach per candidate

For each candidate, cite what we actually measured/read (not marketing):

- Framework major version, release date, support window, breaking-change history over the last
  24 months.
- Netlify integration status (first-party adapter/runtime, edge/function support, known limits).
- Bundle/route-JS implications vs the frozen baseline (`docs/rebuild/BASELINE.md`).
- How routing, data fetching, auth, and the gallery/lightbox/virtualization pieces map from the
  legacy code (A1/A4).
- What the migration would force on the DB/auth/storage layer (A3) and media pipeline (A5).
- PWA/offline story (service worker, manifest, cache control).
- Determinism for the parity harness and CI (C7).
- Exit cost: how hard it is to move away again.

## 6. Required sections before this doc is final

1. **Recommendation** — one candidate, plain language.
2. **Why not the others** — one paragraph each, with the deciding evidence.
3. **Reversal cost** — what it would take to switch if the owner disagrees after Wave 1.
4. **Effects on the roadmap** — which waves change, which get cheaper, which get riskier.
5. **Open questions for the owner** — only genuinely user-owned choices (e.g. SSR vs static,
   willingness to accept a heavier runtime for future content features).
