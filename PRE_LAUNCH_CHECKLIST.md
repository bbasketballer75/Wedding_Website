# Pre-Launch Checklist

## Source of Truth

- Launch runbook: `LAUNCH_RUNBOOK.md`
- Staging URL: `https://austin-jordyn-wedding.netlify.app`
- Public launch URL: `https://wedding.theporadas.com`

## Release Control

- [ ] Working tree reviewed and reconciled into an intentional launch commit
- [ ] Final launch commit pushed to `origin/main`
- [ ] Netlify production confirmed to build from `main`
- [ ] Final deploy ID and commit SHA recorded

## Environment

- [ ] `VITE_SUPABASE_URL` configured in Netlify
- [ ] `VITE_SUPABASE_ANON_KEY` configured in Netlify
- [ ] `VITE_SITE_URL` set to staging URL before cutover
- [ ] `VITE_SENTRY_DSN` configured
- [ ] `VITE_GA_ID` configured
- [ ] `VITE_APP_VERSION` configured for launch

## Automated Verification

- [ ] `npm run verify:release`
- [ ] `npm run verify:launch`
- [ ] `npm run verify:deployed` against staging URL

## Staging Manual Verification

- [ ] Guestbook submit works
- [ ] Guestbook reply works
- [ ] Guestbook reaction works
- [ ] Photo upload works
- [ ] Video upload works
- [ ] Admin login works
- [ ] Admin approval flow works
- [ ] Approved content appears where expected
- [ ] No fake launch-check/test content remains visible

## Browser and Device Coverage

- [ ] Desktop Chrome or Edge
- [ ] Desktop Firefox
- [ ] iPhone Safari
- [ ] Android Chrome
- [ ] Fresh-cache/private-window pass completed
- [ ] Service worker freshness checked after a new deploy

## Content Review

- [ ] Names are correct
- [ ] Date is correct
- [ ] Venue copy is final
- [ ] Event times are final
- [ ] Contact/registry/directions copy is final if present
- [ ] Hero and film poster assets are final
- [ ] No placeholder or inaccurate copy remains

## Monitoring

- [ ] Sentry event received from staging
- [ ] Sentry release/version is correct
- [ ] GA pageviews verified on public routes
- [ ] Uptime monitor configured for staging

## SEO and Sharing

- [ ] Root canonical uses staging URL
- [ ] Root `og:url` uses staging URL
- [ ] Root `twitter:url` uses staging URL
- [ ] `robots.txt` points to staging sitemap
- [ ] `sitemap.xml` uses staging URLs
- [ ] Homepage preview verified on at least one share surface
- [ ] SPA deep-link preview limitation documented and accepted

## Launch Day Domain Cutover

- [ ] Custom domain added in Netlify
- [ ] DNS records added for `wedding.theporadas.com`
- [ ] TLS certificate active
- [ ] `VITE_SITE_URL` changed to `https://wedding.theporadas.com`
- [ ] Final deploy published after domain/env update
- [ ] `npm run verify:deployed` passes on custom domain

## Public Launch Validation

- [ ] Homepage works on custom domain
- [ ] Film page works on custom domain
- [ ] Gallery page works on custom domain
- [ ] Guestbook page works on custom domain
- [ ] Upload page works on custom domain
- [ ] Admin login still works on custom domain
- [ ] No mixed content warnings
- [ ] Share metadata points to custom domain
- [ ] Uptime monitor updated to custom domain

## Rollback Preparedness

- [ ] Known-good pre-cutover deploy ID recorded
- [ ] Known-good Git commit recorded
- [ ] Rollback owner identified
- [ ] Domain will not be publicized until post-cutover checks pass
