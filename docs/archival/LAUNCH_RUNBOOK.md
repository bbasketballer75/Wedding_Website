# Launch Runbook

## Purpose

This runbook is the operating guide for taking the wedding site from "production is live, but still privately rehearsed" to "safe to actively share with guests."

Current live setup:

- public site: `https://www.theporadas.com`
- redirect host: `https://wedding.theporadas.com`
- media host: `https://media.wedding.theporadas.com`
- frontend: Netlify
- backend: Supabase

## Current Baseline

Verified on `2026-03-15`:

- production deploy is live from `main`
- `guest-face-tagging-admin` Edge Function is deployed
- `node scripts/verify-deployed-site.js` passes
- `/`, `/gallery`, `/upload`, `/guestbook`, and `/admin/login` all respond and hydrate on production
- gallery people browsing is live with quick-start chips and richer face summaries
- `/admin/photos` includes the browser-first guest digiKam sync workflow

This means the remaining launch work is mostly manual sign-off and one deliberate rehearsal with real content.

## Phased Plan

### Phase 1: Production Baseline

Already complete.

Reference:

- `PRE_LAUNCH_CHECKLIST.md`
- `DEPLOYMENT_CHECKLIST.md`

### Phase 2: Signed-In Admin QA

Run this as an authenticated admin on production:

1. Sign in at `/admin/login`.
2. Open `/admin/photos`.
3. Verify the moderation counts and guest tagging panel.
4. Open `/admin/review`.
5. Verify the people-review workflow still handles the staged wedding batch.
6. Open `/admin/guestbook`.
7. Open `/admin/featured`.

Acceptance:

- no layout breaks
- no auth loops
- moderation data loads quickly enough to use
- guest tagging panel shows counts and actions correctly

### Phase 3: People Curation

Use the now-live face metadata to make sure the public people experience feels intentional:

1. Open `/gallery`.
2. Click the `People to start with` chips.
3. Search by person name.
4. Spot-check mixed professional and guest results.
5. Note any missing or mis-grouped people.
6. If needed, correct tags in digiKam and rerun:

```powershell
npm run media:batch:faces:digikam -- "C:\Users\bbask\Pictures\Wedding Master - Enriched Working"
npm run media:batch:export -- "C:\Users\bbask\Pictures\Wedding Master - Enriched Working"
npm run media:batch:publish -- "C:\Users\bbask\Pictures\Wedding Master - Enriched Working"
```

Acceptance:

- key people are easy to find
- face-based browsing feels helpful, not noisy
- guest uploads remain visibly marked as guest content

### Phase 4: Guest Upload Rehearsal

Run one intentional rehearsal before the site is actively shared:

1. Submit one clearly labeled test upload through `/upload`.
2. Confirm the success state on the public page.
3. Sign in to `/admin/photos`.
4. Approve the upload into the live gallery.
5. Confirm the upload changes state as expected.
6. If face tags are wanted, use the guest digiKam flow:
   - click `Download guest tagging zip`
   - tag locally in digiKam
   - upload the tagged batch files back through `/admin/photos`
7. Confirm the last-sync status updates and the photo appears correctly in `/gallery`.
8. Remove or reject the rehearsal content afterward unless it is real content you want to keep.

Acceptance:

- public upload succeeds
- admin moderation succeeds
- guest tagging batch export/sync succeeds
- published rehearsal content appears correctly in the gallery

### Phase 5: Final Readiness

Before you actively share the site:

1. Run one fresh-cache pass on desktop.
2. Run one fresh-cache pass on mobile.
3. Confirm Sentry and GA are receiving production traffic.
4. Record the release details below.
5. Only then distribute the site widely.

## Verification Commands

Use these before any major launch-day announcement:

```powershell
npm run verify:env
npx tsc --noEmit
npm run build
node scripts/verify-deployed-site.js
```

## Guest Tagging Workflow

The guest-upload face-tagging loop is now browser-first:

1. Approve guest uploads into the live gallery from `/admin/photos`.
2. In `Guest Face Tagging`, click `Download guest tagging zip`.
3. Extract the zip locally and tag the images in digiKam.
4. In digiKam, run `Write Metadata to Files`.
5. Back in `/admin/photos`, choose the tagged batch files and run the sync.
6. Verify the latest sync status updates in the panel.

Fallback terminal commands remain documented in:

- `MEDIA_BATCH_WORKFLOW.md`
- `GALLERY_OPERATIONS.md`

## Manual Sign-Off Record

Record these values when you decide the site is ready for active guest traffic:

- final Git commit SHA:
- final Netlify deploy ID:
- final Netlify deploy URL:
- latest Supabase function deploy confirmation:
- people curation sign-off:
- guest upload rehearsal sign-off:
- final manual reviewer:
- go-live date and time:
