# Pre-Launch Checklist

This checklist now reflects the current state of the site:

- Production app is already live at `https://www.theporadas.com`
- `https://wedding.theporadas.com` remains the stable Netlify origin and redirect host
- The remaining work is a phased private-live rehearsal before you actively invite guest traffic

Source of truth:

- launch runbook: `LAUNCH_RUNBOOK.md`
- live operations guide: `DEPLOYMENT_CHECKLIST.md`
- gallery ops: `GALLERY_OPERATIONS.md`

## Phase 1: Production Baseline

Completed on `2026-03-15`.

- [x] `main` merged and deployed to Netlify production
- [x] `guest-face-tagging-admin` Supabase Edge Function deployed
- [x] `node scripts/verify-deployed-site.js` passed on `https://www.theporadas.com`
- [x] Homepage responds on the public domain
- [x] Gallery responds and hydrates on the public domain
- [x] Upload page responds and hydrates on the public domain
- [x] Guestbook responds and hydrates on the public domain
- [x] `/admin/login` responds and hydrates on the public domain
- [x] Gallery people experience shows quick-start person chips and collection-aware summaries
- [x] Guest face-tagging workflow is visible in `/admin/photos` after deploy

## Phase 2: Signed-In Admin QA

Requires an actual admin login on production.

- [ ] Sign in at `/admin/login`
- [ ] Open `/admin/photos`
- [ ] Confirm pending, approved-not-public, and approved-public counts look sane
- [ ] Confirm the `Guest Face Tagging` panel shows:
  - [ ] ready-for-tagging photo count
  - [ ] waiting-on-publication count
  - [ ] last sync status
  - [ ] download button
  - [ ] tagged-batch sync button
- [ ] Open `/admin/review`
- [ ] Confirm the staged wedding review batch loads
- [ ] Confirm photo-first review is usable on real archive data
- [ ] Open `/admin/guestbook`
- [ ] Confirm moderation controls render correctly
- [ ] Open `/admin/featured`
- [ ] Confirm featured-slot editing still loads with live data

## Phase 3: People and Gallery Curation

Use this phase to tighten the face-driven browsing experience before launch traffic arrives.

- [ ] Open `/gallery`
- [ ] Click several `People to start with` chips and confirm filtering feels intentional
- [ ] Confirm person counts roughly match expectations for key people
- [ ] Spot-check at least 10 people-filter results for obvious bad matches
- [ ] Note any high-value people who still need more digiKam tagging coverage
- [ ] Re-run the digiKam import/export flow if names or face coverage need correction
- [ ] Verify guest uploads remain visibly labeled as guest content in mixed views

## Phase 4: Guest Upload Rehearsal

Do one deliberate rehearsal before you publicize the upload workflow.

- [ ] Submit one clearly labeled rehearsal upload from `/upload`
- [ ] Confirm the upload success state completes without errors
- [ ] Sign in to `/admin/photos`
- [ ] Confirm the rehearsal upload appears in the pending moderation queue
- [ ] Approve it into the live gallery
- [ ] Confirm it moves into the correct moderation state
- [ ] If you want face tags on it, use the browser-first guest tagging flow:
  - [ ] download guest tagging zip
  - [ ] tag the exported files in digiKam
  - [ ] upload the tagged batch files back through `/admin/photos`
  - [ ] confirm last sync status updates
- [ ] Confirm the approved rehearsal photo appears in `/gallery`
- [ ] Remove or reject the rehearsal content afterward unless you intentionally want to keep it

## Phase 5: Final Launch Readiness

- [ ] Desktop Chrome or Edge pass
- [ ] Desktop Firefox pass
- [ ] iPhone Safari pass
- [ ] Android Chrome pass
- [ ] Fresh-cache/private-window pass
- [ ] Service worker freshness check after latest deploy
- [ ] Sentry receiving production events
- [ ] Google Analytics receiving production pageviews
- [ ] Final commit SHA recorded
- [ ] Final Netlify deploy ID recorded
- [ ] Manual sign-off recorded in `LAUNCH_RUNBOOK.md`
