# Production Readiness

> Last Updated: March 10, 2026
> Project: Austin & Jordyn Wedding Website

## Current Shipping App

Source of truth:
- `src/main.jsx`
- `src/App.tsx`
- Routes: `/`, `/film`, `/gallery`, `/upload`, `/guestbook`, `/admin/*`

## Verified Status

| Area | Status | Notes |
|------|--------|-------|
| Runtime baseline | ✅ | `Node >=20.19.0`, `npm@11.11.0`, `.nvmrc` added |
| Dependency freshness | ✅ | `npm outdated` returns no remaining outdated packages |
| Vite / React | ✅ | `vite 7.3.1`, `react 19.2.4`, `react-dom 19.2.4` |
| Lint | ✅ | Passes with warnings only |
| TypeScript | ✅ | `npx tsc --noEmit` passes |
| Unit tests | ✅ | `npm run test:run` passes |
| E2E tests | ✅ | `npm run test:e2e` passes |
| Production build | ✅ | `npm run build` passes |
| PWA assets | ✅ | Manifest unified in Vite config; favicon/app icons generated |
| Supabase integration | ✅ | Gallery, uploads, guestbook, and admin moderation are wired to Supabase |

## Completed Stabilization Work

- Removed unused Apollo, React Query, repository, plugin, monitoring, and alternate-router code paths from the shipping bundle.
- Fixed live-route TypeScript, accessibility, and React lint issues across Home, Film, Gallery, Upload, Guestbook, Admin, and shared UI.
- Replaced the flaky gallery Playwright assertion with real page-content checks and moved Playwright preview to a dedicated port.
- Added `VITE_MEDIA_BASE_URL` support for heavy media and a postbuild prune step so remote-hosted video/audio/timeline assets can be excluded from `dist`.
- Corrected sitemap routes to match the actual public app.

## Remaining Operational Work

- Configure production env vars:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - optional `VITE_MEDIA_BASE_URL`
  - optional `VITE_SITE_URL`
- If media is offloaded, upload large `/video`, `/background_audio`, and `/media` assets to Supabase Storage or another CDN before enabling `VITE_MEDIA_BASE_URL`.
- Decide whether to spend a follow-up pass reducing the remaining lint warnings in utility and worker files.

## Known Caveat

- `npm audit` still reports four high-severity findings through `vite-plugin-pwa` and `workbox-build`. The dependency tree is otherwise current, and the reported remediation path in npm advisories is inconsistent with the currently published `vite-plugin-pwa` line, so this needs a separate upstream/package-audit review rather than an automatic fix.
