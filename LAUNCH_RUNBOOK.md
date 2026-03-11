# Launch Runbook

## Purpose

This is the source of truth for taking the wedding site from private staging on Netlify to a public custom-domain launch on `wedding.theporadas.com`.

## Current Strategy

- Staging and QA URL: `https://austin-jordyn-wedding.netlify.app`
- Public launch URL: `https://wedding.theporadas.com`
- Do not attach the custom domain until the site is fully approved.
- Deep-link crawler previews may fall back to the homepage metadata for this launch because the site is a client-rendered SPA.

## Launch Preconditions

Before cutover, all of the following must be true:

- GitHub `main` matches the intended production build.
- Netlify production is successfully deploying from `main`.
- `npm run verify:release` passes from a clean shell.
- `npm run verify:launch` passes from a clean shell once launch envs are present.
- Manual staging QA is complete for:
  - guestbook submit, reply, reaction
  - photo upload and video upload
  - admin login and moderation approval
  - desktop Chrome/Edge
  - desktop Firefox
  - iPhone Safari
  - Android Chrome
  - fresh-cache or private-window pass
- Monitoring is configured and verified:
  - Sentry DSN
  - Google Analytics ID
  - uptime monitor

## Required Environment Variables

### Required before staging sign-off

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SITE_URL=https://austin-jordyn-wedding.netlify.app`
- `VITE_SENTRY_DSN`
- `VITE_GA_ID`

### Recommended before launch

- `VITE_APP_VERSION`

### Optional

- `VITE_MEDIA_BASE_URL`

## Verification Commands

Run these from a clean shell before any final deploy:

```powershell
npm run verify:env
npm run verify:secrets
npm run verify:supabase
npm run lint
npx tsc --noEmit
npm run test:run
npm run build
npm run test:e2e:public
npm run verify:release
```

Launch-specific checks:

```powershell
npm run verify:launch
npm run verify:deployed
```

`verify:launch` validates launch-only env requirements and built fallback metadata.

`verify:deployed` validates the live URL in `VITE_SITE_URL` by fetching the deployed HTML, `robots.txt`, `sitemap.xml`, and `/admin/login`.

## Staging Validation

Use only the Netlify staging URL until launch day.

- Confirm public flows:
  - guestbook text submission
  - reply and reaction behavior
  - photo upload
  - video upload
- Confirm admin flows:
  - sign in at `/admin/login`
  - moderate one upload
  - verify approved content appears where expected
- Clean up any test-only content that should not remain visible.
- Confirm homepage share preview on the staging URL if internal reviewers need it.

## Launch Day Cutover

Execute in this order:

1. Freeze content and code changes.
2. Re-run `npm run verify:release`.
3. Confirm the final launch commit is pushed to `main`.
4. Confirm Netlify production has deployed that commit.
5. Add `wedding.theporadas.com` as the custom domain in Netlify.
6. Add the required DNS records at the domain host.
7. Wait for Netlify to verify the domain and provision TLS.
8. Confirm `https://wedding.theporadas.com` loads successfully.
9. Update Netlify env:
   - `VITE_SITE_URL=https://wedding.theporadas.com`
   - set `VITE_APP_VERSION` to the launch release label if needed
10. Commit the static fallback metadata/domain updates if not already parameterized by env.
11. Trigger the final post-cutover production deploy from `main`.
12. Run `npm run verify:deployed` against the custom domain.
13. Manually verify the homepage preview on the custom domain.
14. Only then share the custom domain publicly.

## Post-Cutover Validation

Check these live on `https://wedding.theporadas.com`:

- homepage
- film
- gallery
- guestbook
- upload
- admin login
- SSL padlock
- no mixed content
- correct canonical/share metadata
- Sentry event delivery
- GA pageview delivery
- uptime monitor green

Perform one real guest action after cutover:

- either one guestbook entry
- or one real upload flow

## Rollback

- If DNS or TLS is not healthy, do not publicize the domain and keep using the Netlify URL privately.
- If the custom-domain deploy breaks metadata or runtime behavior:
  - revert to the last known-good Git commit
  - redeploy on Netlify
  - re-verify before retrying the cutover
- If GA or Sentry fails, launch proceeds only if the failure is explicitly accepted and documented.

## Release Record

Record these values at final launch:

- final Git commit SHA
- Netlify deploy ID
- Netlify deploy URL
- custom domain go-live time
- `VITE_SITE_URL` value
- `VITE_APP_VERSION` value
- who completed the manual sign-off
