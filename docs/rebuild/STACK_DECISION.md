# Stack Decision — recommendation for owner approval

**Status: APPROVED by the owner on 2026-11-08 — S1 (Vite + React 19 SPA).** Wave 1 (scaffold +
shell) is in progress on `rebuild/greenfield` under [`plans/2026-11-08-wave-1-scaffold.md`](./plans/2026-11-08-wave-1-scaffold.md).
The analysis, scoring, and evidence live in [audit/A7-stack-decision.md](./audit/A7-stack-decision.md).

## Recommendation

**Rebuild the archive as a Vite + React 19 + TypeScript single-page app** — TanStack Router and
TanStack Query for routing/server-state, Tailwind 4 with the existing design tokens, strict
TypeScript/ESLint, Vitest + Playwright + the Wave 0 parity harness — deployed to Netlify exactly as
today, with a build-time prerender step for the static routes and the existing edge function kept
for shared-photo OG previews.

This is the same rendering model the archive already uses, so it is the only option where pixel and
text parity are mechanically cheap: two client-rendered DOMs, one deterministic Playwright harness,
no hydration/streaming differences. Everything the archive actually needs — auth, RLS, storage,
realtime, media CDN, PWA, Netlify functions — stays exactly where it is.

## Why not the alternatives

- **Next.js (App Router):** strongest SEO/SSR story, but it relocates data flow (RSC boundaries),
  adds a server runtime and dependency surface, and duplicates the edge-OG mechanism we already
  have. It pays a large parity/migration bill for value this archive does not clearly need.
- **Astro + islands:** best static performance, but the archive is app-shaped (gallery, uploads,
  admin) — it would become an islands hybrid with two mental models and the hardest animation
  parity.
- **React Router 7 framework mode:** credible SSR middle ground, cheaper than Next.js but still
  adds hydration/loader complexity to parity without a decisive SEO win.
- **TanStack Start:** promising 1.0 (Oct 2026) and the natural escape hatch from our recommendation
  (shared TanStack Router/Query), but too young to bet a decade-lived archive on today.

## Performance caveat (and how S1 answers it)

The frozen baseline is poor on mobile: `/` scores **0.56 performance**, LCP **6.6 s**, TBT **677 ms**,
**14.5 MB** transferred (Lighthouse 13.5.0, mobile, contended machine). An SPA does not fix that by
itself. The rebuild's quality bar therefore hard-codes the budget: initial JS ≤180 KB gz, route JS
≤120 KB gz, LCP ≤2.0 s, CLS ≤0.05, responsive AVIF/WebP with blurhash placeholders, and Lighthouse
CI budgets. If those budgets cannot be met with S1 alone, the documented escape hatch is TanStack
Start (same router/query), not a full re-platform.

## What would change this recommendation

Move to **Next.js** if the audit shows organic search/share previews are genuinely load-bearing for
the archive's purpose, or if you want server-rendered content sections in the future. Move to
**Astro** only if the product shifts toward content/editorial and away from interactive galleries
and admin.

## Reversal cost

- S1 → TanStack Start: contained (same router/query, add an SSR entry) — roughly one wave.
- S1 → Next.js / React Router 7: a genuine re-platform, roughly 3–4 waves.
- S1 → Astro: the most expensive move; least justified.

## Decision requested

Approve **S1 (Vite + React 19 SPA)** for Wave 1, or state which product priority should override it
(SEO/SSR, static performance, or content authoring) and we will re-score against that priority.

Supporting evidence: [A1 architecture](./audit/A1-architecture.md) ·
[A2 toolchain](./audit/A2-toolchain.md) · [A3 data](./audit/A3-data.md) ·
[A4 product](./audit/A4-product.md) · [A5 content](./audit/A5-content.md) ·
[A6 quality](./audit/A6-quality.md) · [BASELINE](./BASELINE.md).
