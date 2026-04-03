# Production Readiness

> Last Updated: March 11, 2026
> Project: Austin & Jordyn Wedding Website

## Shipping Surface

Live routes in the shipping app:

- `/`
- `/film`
- `/gallery`
- `/upload`
- `/guestbook`
- `/admin/login`
- `/admin/*`

There is no RSVP feature in the current shipping app. Older launch docs that reference RSVP are stale and should not drive launch work.

## Current Confirmed State

| Area | Status | Notes |
|------|--------|-------|
| Runtime baseline | ✅ | Node 20+, current Vite/React stack |
| TypeScript | ✅ | `npx tsc --noEmit` passes |
| Unit tests | ✅ | `npm run test:run` passes |
| Public E2E | ✅ | `npm run test:e2e:public` passes |
| Production build | ✅ | `npm run build` passes |
| Admin login | ✅ | `/admin/login` exists and uses Supabase auth |
| Supabase integration | ✅ | guestbook, uploads, moderation, and guestbook RPC verified |
| Staging metadata | ✅ | fallback metadata, `robots.txt`, and `sitemap.xml` use the Netlify staging URL |
| Security headers | ✅ | CSP, HSTS, frame/content/referrer policies are active |
| Release verification | ✅ | release checks exist and pass in current staging config |

## Launch Model

- Private staging/testing URL: `https://austin-jordyn-wedding.netlify.app`
- Final public launch URL: `https://www.theporadas.com`
- Custom domain is intentionally delayed until the site is fully approved.
- Deep-link crawler previews are accepted to fall back to homepage metadata for this launch because the app is an SPA without prerendering or SSR.

## Remaining Work to Reach Public Launch

- Reconcile the current working tree into a clean Git-backed release on `main`.
- Configure required launch monitoring envs:
  - `VITE_SENTRY_DSN`
  - `VITE_GA_ID`
  - recommended `VITE_APP_VERSION`
- Run `npm run verify:launch`.
- Run `npm run verify:deployed` against the staging URL.
- Complete final staging manual QA and content sign-off.
- Configure the custom domain in Netlify and DNS only on launch day.
- Update `VITE_SITE_URL` to the custom domain at cutover and verify the deployed site again.

## Accepted Launch Risks

- Remaining lint warnings in utility and worker files are non-blocking unless they begin affecting shipping routes.
- `npm audit` findings in the `vite-plugin-pwa` / `workbox-build` chain are currently treated as documented launch risk unless a safe upstream fix becomes available before launch.
