# Release Recovery Notes — 2026-07-05

## Summary

The recovery pass restored the public release gate, repaired production media delivery, and
deployed the refreshed site to production.

## Verified

- Netlify production deploy: `6a4a988f7e2119823dc5c102`
- Cloudflare media worker version: `60dc14f2-60bd-49e0-8949-367d82c11c81`
- `CI=1 npm run verify:release` passed locally before deployment.
- `npm run verify:deployed` passed against `https://www.theporadas.com`.
- Direct media checks returned `206` with CORS for `video/main.mp4`, VTT captions, and a
  gallery image.

## Remaining Caveat

Public automated checks are green. Signed-in admin moderation still needs a live admin credential
smoke pass before treating private workflows as fully verified.
