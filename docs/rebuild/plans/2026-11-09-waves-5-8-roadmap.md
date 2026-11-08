# Waves 5–8 — feature roadmap (scoping)

> Each wave gets a task board, a parity gate, and a checkpoint when it starts. This page fixes the
> scope and excludes so the feature agents do not re-litigate them.

## Wave 5 — Gallery (largest)

Routes: `/gallery` (+ `/guest/:token` share album interactions, `/guest-photos` cards).

In scope: 4 collections (`Proposal`, `Bach+ette`, `Wedding Photos`, `Guest Photos`), album↔collection
alias mapping, infinite paging (12/18), masonry/grid/timeline views, search across
caption/location/photographer/source/tags/faces, lightbox (focus trap, ←/→/Esc, pinch/double-tap
zoom, face hotspots, EXIF panel, likes, comments, download, share, print modal), batch download
(≤50 selection, client zip ≤20, server `download-pack` 21–50), `?share=` selection/OG, upload-status
lookup, curated photos fallback when Supabase fails.

Out of scope: dead modules (MapView, SortDropdown, PhotoGrid/MasonryGrid variants, TimelineView
module), People page.

Exit: text parity on `/gallery` (fixtures), pixel parity with documented masks for animated
controls, e2e for lightbox/selection/download/share/upload-lookup, data-layer contract tests for the
RPCs used, perf budget per route.

## Wave 6 — Guestbook + guest uploads

Routes: `/guestbook`, `/upload`, `/guest-photos`.

In scope: guestbook feed with nested comments/reactions/replies, deep link `?message=`, honeypot,
client limiter + server RPC (with the R7 fallback), composer states; upload queue (drag/drop,
compress, presign → R2 PUT, retry, resume, submit retries, success + share token); guest photos
page; guest share tokens.

Security: apply the documented fixes rather than reproducing defects — real server-side rate limit
(R17), no client-only claim "verification" (R18/R19/R20 decisions from the owner are still open; if
undecided by this wave, reproduce the *product intent* with honest copy and an admin-moderated
queue, and record the decision).

## Wave 7 — Admin portal

Routes: `/admin/login`, `/admin` (10 child routes).

In scope: auth + session + role gate, dashboard counts/workflow, upload moderation (approve/reject/
bulk/publish), album organizer (dnd + keyboard + bulk move/delete + undo + dirty-save), people review
(media review batches/clusters/faces), claims moderation, guestbook moderation, featured content
(4 slots + history), audit log, analytics, settings. Every state change writes the audit row.

Exit: parity for admin shell + a11y, e2e for the critical moderation flows, RLS/security review.

## Wave 8 — SEO / PWA / infrastructure / performance

- Per-route metadata for all routes (incl. the stale-metadata defects fixed), real static OG image,
  sitemap generated from contracts (no `/people`), robots, manifest, service worker caching, CSP
  headers, redirects, analytics + Sentry wiring.
- Performance: bundle budgets, image `srcset`/AVIF/WebP, blurhash, lazy media, Lighthouse budget on
  `/`, `/gallery`, `/film`.
- Ops docs: env contract, deploy/rollback runbook, backup/restore.

## Wave 9 — Parity sweep + cutover readiness (no production mutation)

Full-matrix parity, data/media completeness checks against the DB export, migration plan (additive
first), cutover runbook + rollback rehearsal, legacy retirement plan. The actual DNS/Netlify switch
and prod schema changes require the owner's credentials and window.
