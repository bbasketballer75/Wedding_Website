# Deployment Notes

The wedding site is already live.

Use this file as the short pointer to the current operating docs:

- `PRODUCTION_READINESS.md` for the live architecture snapshot
- `LAUNCH_RUNBOOK.md` for the historical launch path and verification commands
- `GALLERY_OPERATIONS.md` for the ongoing photo curation workflow

## Current Live Model

- Public site: `https://www.theporadas.com`
- Legacy host redirect: `https://wedding.theporadas.com` -> `https://www.theporadas.com`
- Frontend hosting: Netlify
- DNS and large media: Cloudflare
- Backend and guest data: Supabase

## Most Useful Commands

```bash
npm run verify:deployed
npm run verify:launch
npm run test:e2e:public
```

## Notes

- The public media origin is controlled by `VITE_MEDIA_BASE_URL`.
- The current intended media host is `https://media.wedding.theporadas.com`.
- Deep-link crawler previews are still accepted as homepage-fallback metadata because the app is a client-rendered SPA.
