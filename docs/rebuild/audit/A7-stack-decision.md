# A7 — Stack Decision (FINAL — recommendation S1; owner approval pending)

> **Status:** final analysis. Recommendation: **S1 (Vite + React 19 SPA)**. Owner approval is the
> Wave 0 gate; nothing is scaffolded before it.
>
> Inputs: [A1-architecture](./A1-architecture.md) · [A2-toolchain](./A2-toolchain.md) ·
> [A3-data](./A3-data.md) · [A4-product](./A4-product.md) · [A5-content](./A5-content.md) ·
> [A6-quality](./A6-quality.md) · [BASELINE](../BASELINE.md)

## 1. Constraints inherited from the product contract

1. Pixel and text parity on every route; the legacy app is the oracle.
2. Public archive, no login for guests; admin behind Supabase Auth + RLS.
3. Media-heavy: 139 MB tracked images, 3.6 GB local media directed at R2/CDN, galleries of
   hundreds of photos, a 45:53 chaptered film.
4. SEO matters for share previews and discoverability; today it is solved by static per-route
   metadata plus one Netlify edge function that injects OG tags for shared photos.
5. PWA/offline is part of the product today (manifest + Workbox caching + offline page).
6. Deploy target is Netlify with Functions/Edge Functions and is expected to stay.
7. One non-specialist owner must maintain it for years; fewer moving parts is a feature.
8. The rebuild is greenfield, but every change must pay for its parity and migration cost.

## 2. Criteria and weights

| # | Criterion | Weight | What counts |
|---|---|---|---|
| C1 | Parity effort | 25 | How cheaply the frozen UI/behavior is reproduced exactly (routing, animations, lightbox, virtualization, video, admin) |
| C2 | Maintainability & ecosystem | 20 | Stable releases, docs, hiring/agent-friendliness, upgrade path, lock-in |
| C3 | Performance | 15 | Route JS, media handling, LCP/CLS on mid-tier mobile, caching |
| C4 | SEO / OG | 10 | Per-route metadata, share previews, prerender/SSR options |
| C5 | Deploy & cost fit | 10 | Netlify support, functions/edge, build time, hosting cost |
| C6 | Migration risk | 10 | Data/auth/storage compatibility, cutover complexity, rollback |
| C7 | Testability & agent-friendliness | 10 | Deterministic builds, unit/e2e/contract testing, CI speed, how easily agents reason about it |

Scores: 1 (poor) … 5 (excellent); weighted total out of 5.00.

## 3. Candidates

| ID | Candidate | Shape |
|---|---|---|
| S1 | **Vite + React 19 + TypeScript SPA** (current toolchain family), TanStack Router + TanStack Query, Tailwind 4, static Netlify, existing edge/function layer | Client-rendered archive, same deploy model |
| S2 | **Next.js App Router on Netlify** | SSR/ISR + image optimisation; metadata via server components; heavier runtime |
| S3 | **Astro + React islands** | Static-first pages with hydrated islands; content collections; admin as an island/SPA |
| S4 | **React Router 7 framework mode** | SSR + nested routes + loaders; Netlify adapter |
| S5 | **TanStack Start** | Full-stack React with SSR/server functions; newest ecosystem |

Deployment facts verified in official docs during this audit:

- Netlify supports Next.js (including App Router) with zero config via its OpenNext adapter —
  [docs.netlify.com/nextjs](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/).
- Astro static sites need no adapter; on-demand routes/islands use `@astrojs/netlify` —
  [Astro Netlify adapter](https://www.astrojs.cn/zh-cn/guides/integrations-guide/netlify/).
- TanStack Start reached 1.0 and deploys on Netlify through `@netlify/vite-plugin-tanstack-start`
  ([Netlify changelog, 2026-10-13](https://www.netlify.com/changelog/2026-10-13-tanstack-start-1-0/)).
- React Router 7 framework mode has a first-party Netlify guide —
  [docs.netlify.com/react-router](https://docs.netlify.com/build/frameworks/framework-setup-guides/react-router/).

All five are viable on the current host; deploy support is not the differentiator.

## 4. Analysis per candidate

### S1 — Vite + React 19 SPA (+ TanStack Router/Query, Tailwind 4)

The frozen app is already a React SPA: 12 lazy routes, client-side auth, client-side SEOHead,
Workbox PWA, and a Netlify edge function for social previews. Porting components into the same
rendering model is the cheapest possible parity path: no hydration/streaming differences, the
existing Playwright deterministic-mock layer applies unchanged, and the parity harness compares
two client-rendered DOMs.

Costs: no SSR, so per-route metadata stays client-injected unless a prerender step is added
(static prerender at build time is enough for 12 mostly-static routes; the gallery's dynamic share
previews stay on the edge function). Client JS must be budgeted hard to beat the current
Lighthouse baseline (0.56 mobile, LCP 6.6 s, TBT 677 ms, 14.5 MB on `/`).

Verdict: lowest risk, lowest parity cost, same deploy model; performance and discoverability must
be earned with explicit budgets rather than inherited from a framework.

### S2 — Next.js App Router on Netlify

Strongest out-of-the-box SEO (server metadata, dynamic OG, route-level streaming), RSC can cut
client JS, and `next/image` helps with the media archive. Parity is achievable but no longer free:
server/client component boundaries change where stores, effects, and animation providers live;
gallery/lightbox/virtualization stay client components; the auth + realtime layer becomes a
boundary problem; the parity harness must handle streamed HTML and hydration timing.

Costs: a new server runtime on Netlify, larger dependency surface, framework churn, and a much
bigger migration of data flow. Also duplicates the existing edge-OG function.

Verdict: best if server-rendered SEO or future server-side content features are a priority;
otherwise pays a large parity/migration bill for value this archive does not clearly need.

### S3 — Astro + React islands

Best static performance and content ergonomics (content collections map well to the story, film,
timeline, and curated photo data). But the archive is app-shaped: gallery filtering/virtualization,
lightbox, upload flow, guestbook, and the whole admin are long-lived interactive surfaces, and the
current UX relies on SPA route transitions and animation. Reproducing it means large islands and
an admin SPA anyway, i.e. a hybrid architecture with two mental models.

Costs: highest rewrite distance from the current component tree, animation/transition parity is
hardest, and the admin still needs a client app. Verdict: best fit for a content site, not for
this app-shaped archive.

### S4 — React Router 7 framework mode

The best SSR middle ground for a React team: nested routes and loaders fit the route table, Netlify
has a first-party guide, and the component model stays React. But it changes data flow (loaders
vs hooks), adds SSR/hydration concerns to parity, and is a smaller ecosystem bet than S1/S2.

Verdict: credible alternative to S2 if the owner wants SSR without leaving React Router; higher
parity cost than S1 for SEO gains that the archive only partially needs.

### S5 — TanStack Start

Newest 1.0 (Oct 2026), native Vite, good Netlify story, and shares TanStack Router/Query with the
S1 proposal — so it is the natural upgrade path *if* SSR becomes a requirement later. At 1.0 its
ecosystem, documentation depth, and long-term support record are still short compared with S1/S2,
which is a poor trade for a decade-lived archive maintained by one person.

Verdict: keep as the documented escape hatch, not the first bet.

## 5. Provisional scoring

| Criterion | Weight | S1 Vite SPA | S2 Next.js | S3 Astro | S4 RR7 | S5 TanStack Start |
|---|---|---|---|---|---|---|
| C1 parity effort | 25 | **5** | 3 | 3 | 3.5 | 3.5 |
| C2 maintainability | 20 | **4** | 4 | 4 | 4 | 3 |
| C3 performance | 15 | 3 | 4 | **5** | 3.5 | 4 |
| C4 SEO/OG | 10 | 2 | **5** | 5 | 4.5 | 4.5 |
| C5 deploy/cost | 10 | **5** | 4 | 5 | 4 | 4 |
| C6 migration risk | 10 | **5** | 3 | 2 | 3 | 2.5 |
| C7 testability | 10 | **5** | 3 | 3 | 3.5 | 3.5 |
| **Weighted total** | 100 | **4.20** | 3.65 | 3.80 | 3.70 | 3.53 |

## 6. Recommendation

**S1 — Vite + React 19 SPA with TanStack Router + TanStack Query, Tailwind 4, strict tooling, and a
build-time prerender step for the static routes.** Reasons:

1. Parity is the one thing that cannot be compromised, and S1 makes it cheapest and most
   mechanically testable (the Wave 0 harness compares two client-rendered DOMs). A1 confirms the
   oracle's behaviour — lightbox, virtualization, chaptered player, dnd admin, page transitions —
   is all client state + DOM; any SSR candidate must reproduce the same post-hydration DOM and
   imperative head writes, or re-baseline every visual regression.
2. The archive's SEO need is share previews + discoverability, already solved by static metadata
   plus the edge OG function (A4 §5). A2/A1 conclude SSR is an optimisation, not a parity
   requirement.
3. The rebuild's first win is deletion: A1 measures ~110 dead modules / 14.5k dead lines (27% of the
   source tree) and A2 finds ~17 unused packages. That win is framework-independent; S1 banks it
   without also paying for a render-model migration.
4. Deploy, auth, storage, realtime, and PWA stay exactly as they are, shrinking cutover risk (C6).
5. `docs/rebuild/QUALITY_BAR.md` forces the things SSR would have given us for free (lazy media,
   budgets, prerendered metadata), so the main S1 weakness is addressed explicitly.

Reversal path: S1 and S5 share TanStack Router/Query, so if SSR becomes a requirement after
Wave 1, moving to TanStack Start is a contained change rather than a rewrite.

**Decision branch for the owner:** if share-preview/SEO quality or future server-rendered content
is a higher priority than parity cost and simplicity, the answer changes to **S2 (Next.js)**; if
the priority is pure static performance and content authoring, **S3 (Astro)**. The audit evidence
that would flip this is in A4 (SEO is a share-preview requirement, not organic search) and A6
(performance loss is media, not markup).

## 7. Evidence attached so far

- **A4 (product/flows):** the archive's SEO today is per-route DOM mutation plus one edge OG
  function; the static `og:image` is broken (`/images/og-image.webp` does not exist), the live
  sitemap advertises a 404 (`/people`), and `/activity` + `/admin/*` inherit stale metadata. SEO is
  therefore a *share-preview* requirement (which S1 keeps via the edge function plus a prerender
  step), not an organic-search engine. The app is interaction-heavy: gallery virtualization,
  lightbox, upload queue, dnd admin, realtime activity. That is S1's home turf.
- **A6 (quality/perf, in progress):** the frozen gallery's Lighthouse mobile trace took ~138 s to
  reach LCP because it loads a 1000-row photo page from the production CDN. The dominant performance
  cost is media loading/pagination, not framework render — so no framework choice fixes it; the
  rebuild's media pipeline and page-size budgets do. That weakens the SSR argument for S2/S3.
- **A1/A2 (toolchain/architecture, pending):** expected to decide whether RSC/SSR would materially
  cut route JS. Current bundle is dominated by app-supabase (236 KB raw), vendor-react (210 KB),
  index (205 KB), Gallery (183 KB), vendor-motion (141 KB), so most JS is library/runtime, not
  markup — an SSR framework would not remove it.
- **A3/A5:** data and content layers are framework-neutral; nothing biases the choice.

## 8. Reversal cost

- S1 → S5: keep TanStack Router/Query; move route tree into Start, add SSR entry; ~1 wave.
- S1 → S2/S4: re-platform, redo data loading and metadata; ~3–4 waves.
- S1 → S3: rewrite pages as Astro + islands; highest cost, least justified.
