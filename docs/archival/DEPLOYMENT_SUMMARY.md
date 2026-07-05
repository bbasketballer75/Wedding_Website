# Wedding Website - Live Deployment Summary

**Project:** Austin & Jordyn Wedding Website  
**Status:** Live  
**Canonical URL:** `https://www.theporadas.com`

---

## Current Live Architecture

| Layer            | Current provider                                 | Notes                                                               |
| ---------------- | ------------------------------------------------ | ------------------------------------------------------------------- |
| Frontend hosting | Netlify                                          | Serves the React/Vite app                                           |
| DNS              | Cloudflare                                       | Canonical `www` plus redirect handling                              |
| Large media      | Cloudflare R2                                    | Film and other offloaded media served through `VITE_MEDIA_BASE_URL` |
| Backend data     | Supabase                                         | Guestbook, uploads, moderation, and gallery feed                    |
| Monitoring       | Sentry, Google Analytics, GitHub uptime workflow | Active in the live setup                                            |

---

## Current Public URLs

- Public site: `https://www.theporadas.com`
- Redirect host: `https://wedding.theporadas.com`
- Staging reference: `https://austin-jordyn-wedding.netlify.app`

---

## Current Verification Snapshot

- `npm run build`
- `npx tsc --noEmit`
- `npm run verify:deployed`
- `npm run test:e2e:public`

The public regression suite currently covers `43` tests across home, film, gallery, guestbook, upload, accessibility, shell, smoke, and SEO flows.

---

## What This Repo Is Best Used For Now

1. Ongoing content curation
2. Gallery and guest-upload operations
3. Small public-site improvements
4. Post-launch maintenance and verification

For the original launch process and verification steps, use:

- `LAUNCH_RUNBOOK.md`
- `PRODUCTION_READINESS.md`
- `PRE_LAUNCH_CHECKLIST.md`

For day-to-day gallery/content operations, use:

- `GALLERY_OPERATIONS.md`

---

## Current Notes

- The custom media host is `https://media.wedding.theporadas.com`.
- The site still accepts SPA-style deep-link social preview fallback to homepage metadata.
- `wedding.theporadas.com` should remain a redirect-only host, not a second browsed version of the site.
