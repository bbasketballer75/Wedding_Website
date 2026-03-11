# Deployment Notes

This file is now a quick pointer.

For the actual end-to-end launch process, use:

- `LAUNCH_RUNBOOK.md`
- `PRE_LAUNCH_CHECKLIST.md`
- `PRODUCTION_READINESS.md`

## Current Deployment Model

- Private staging/testing: `https://austin-jordyn-wedding.netlify.app`
- Final public launch: `https://wedding.theporadas.com`
- Do not attach the custom domain until the site is fully approved.

## Most Important Commands

```bash
npm run verify:release
npm run verify:launch
npm run verify:deployed
```

## Notes

- The shipping app is Netlify-first for this launch.
- The custom domain cutover is a one-time final launch action, not a testing step.
- Deep-link crawler previews are intentionally accepted as homepage-fallback metadata for this launch because the site is an SPA.
