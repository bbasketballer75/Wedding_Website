# Wedding Website - Current Operations Checklist

This file now tracks the **live** site, not the pre-launch deployment.

## Live Environment

- Public site: `https://www.theporadas.com`
- Redirect host: `https://wedding.theporadas.com`
- Media host: `https://media.wedding.theporadas.com`
- Frontend: Netlify
- DNS and media delivery: Cloudflare
- Backend: Supabase

---

## Ongoing Verification

- [ ] Run `npm run build`
- [ ] Run `npx tsc --noEmit`
- [ ] Run `npm run verify:deployed`
- [ ] Run `npm run test:e2e:public`
- [ ] Confirm the public site still loads on `www`
- [ ] Confirm `wedding` still redirects to `www`
- [ ] Confirm media assets still load from the Cloudflare media host

---

## Content Operations

- [ ] Approve guest uploads that should appear publicly
- [ ] Tag or caption approved uploads so they land in the right collection
- [ ] Review `Professional` vs `Guest Uploads` separation in the gallery
- [ ] Feature standout moments on the home/gallery surfaces when appropriate
- [ ] Remove obvious synthetic QA content if any appears again

See `GALLERY_OPERATIONS.md` for the detailed workflow.

---

## Monitoring

- [ ] Google Analytics still receiving pageviews
- [ ] Sentry still receiving production events
- [ ] Uptime workflow or external monitor still green

---

## Archive Note

For the historical launch sequence and cutover details, use `LAUNCH_RUNBOOK.md`.
