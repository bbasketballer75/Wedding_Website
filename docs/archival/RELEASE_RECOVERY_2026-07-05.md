# Release Recovery Notes — 2026-07-05

## Summary

The recovery pass restored the public release gate, repaired production media delivery, and
deployed the refreshed site to production.

## Verified

- Netlify production deploy: `6a4a988f7e2119823dc5c102`
- Follow-up hardening deploy: `6a4acabcd8025830013ba755`
- Cloudflare media worker version: `60dc14f2-60bd-49e0-8949-367d82c11c81`
- `CI=1 npm run verify:release` passed locally before deployment.
- `npm run verify:deployed` passed against `https://www.theporadas.com`.
- Direct media checks returned `206` with CORS for `video/main.mp4`, VTT captions, and a
  gallery image.

## Remaining Caveat

Public automated checks are green. Signed-in admin moderation still needs a live admin credential
smoke pass before treating private workflows as fully verified.

## Re-verified — 2026-09-14

Following the 2026-09-14 revival pass (Phases A through E in
`/Users/bbask/Coding_Projects/Wedding_Website_Clean/.hermes/plans/2026-09-14_162706-revive-wedding-website.md`)
the items above remain verified against the current `main` (`a0f928d`):

- Live site: `https://www.theporadas.com` returns HTTP 200.
- Release gate green on `main`:
  - `npm run lint` (eslint 10 + @typescript-eslint 8.70)
  - `npx tsc --noEmit` (TypeScript 7.0.2) and `npx tsc6 --noEmit` (TypeScript 6 alias
    that typescript-eslint resolves through)
  - `npm run test:run` — 182/182 passing across 33 test files
  - `npm run build` — clean build + postbuild
- Branch `main` is protected: `Validate (lint, format, typecheck, test, build)` is
  the required status check; merges that fail the gate are blocked.
- Admin moderation smoke is still a manual step — see
  `docs/archival/ADMIN_LIVE_QA_CHECKLIST.md` for the runbook. None of the
  changes in the revival pass touched admin authentication or RLS, so the
  earlier "Signed-in admin moderation still needs a live admin credential
  smoke pass" caveat above remains the only unverified item.
