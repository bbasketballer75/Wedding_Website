# Media incident — 2026-11-10 (post-cutover www.theporadas.com)

Status: **primary incident FIXED + DEPLOYED by Lead** (commit `1e7e15c`, deploy
`6af3f12d8e512337f16663fa`); **one latent secondary media bug fixed in the working tree,
pending integration** (5 files under `rebuild/src/**`, no deploy/commit from W9-7b owner).

## 1. Primary root cause (fixed by Lead)

Production deploy `6af3ed9d1c516a64aba25527` shipped **no `/images/**` archive assets**. The
rebuilt app serves the 542-file archive same-origin (`shared/data/media.ts` contract: only
`/video/`, `/background_audio/`, `/media/` are offloaded to the media CDN), and the legacy app's
`postbuild` `copy-public-images` step (root `scripts/copy-public-images.js`) has no rebuild
equivalent — `rebuild/dist/images` contained only 14 files (og-image + icons) vs 542 tracked in
root `public/images`.

Evidence captured against the old production deploy with headless Chromium (files in
`tmp/incident/browser-production.json`):

- `/gallery`: 13 × `404 https://www.theporadas.com/images/engagement/PoradaProposal-*.webp`;
  every rendered `<img>` had `complete=true, naturalWidth=0` (12/12 broken).
- `/film`: 66 × 404 — `/images/film/main-film-poster.png`, `/images/couple/*.png`,
  `/images/parents/*.webp`, `/images/parent-film-cards/*.webp`,
  `/images/wedding-party/**` — i.e. the "wrong theme/blank media" perception.
- Videos were **not** broken: CDN probe `curl -H 'Origin: …' -H 'Range: bytes=0-1023'
  https://media.wedding.theporadas.com/video/main.mp4` → `206`, `video/mp4`,
  `Access-Control-Allow-Origin: https://www.theporadas.com`, `Accept-Ranges: bytes`; in Chrome
  the film `<video>` reached `readyState=4`, `error=null` and `play()` advanced `currentTime`.
  The captured `net::ERR_ABORTED` entries are benign preload cancellations (no console errors).
- `www /images/...` 404, `dist/images` = 14 files, root `public/images` = 542 files.

Lead fix (`1e7e15c`) ships the 65 actually-referenced originals under
`rebuild/public/images/**`, so plain `vite build` includes them. Post-fix production verification
(headless Chromium, `tmp/incident/prod-after-fix.json`): `/gallery` 12/12 images `200` with
`naturalWidth>0` (all same-origin `/images/**`), `/film` 20/20 posters loaded, **0 bad responses,
0 console errors**, video `readyState=4`.

## 2. Secondary latent bug (fix in working tree, pending integration)

Every row of the dedicated cutover database stores **relative** media paths **without a leading
slash**, e.g. `media/Bach+ette/Photos/000001.jpg` (Management API, read-only,
project `faurvrckvatfcswsyobc`):

```sql
select count(*) total, count(*) filter (where url like '/images/%') leading_images,
       count(*) filter (where url like 'http%') absolute from public.photos;
-- total=1320, leading_images=0, absolute=0
-- 10 prefix buckets all start with `media/...`
```

The frozen legacy mapper normalised that value through `getMediaPath`
(`src/components/gallery/data.ts:26-35`, `normalizeGalleryMediaPath`). Five rebuild adapters
mapped the raw DB value instead, so a relative `media/...` renders with `<img src="media/...">`,
which the browser resolves against the current route (`/gallery/media/...`) or same-origin
(`/media/...`); production `/media/...` returns **404** (verified: `curl
https://www.theporadas.com/media/Engagement/Photos/PoradaProposal-29.webp` → 404). It did not
surface in the Lead's post-fix capture only because the initial gallery view renders the curated
same-origin grid; it would break live DB photos, the home guest-highlight reel, guest-share albums,
downloads/zip and the admin album organizer.

### Files changed (5; no build/config changes)

1. `rebuild/src/app/routes/gallery-data.ts` — `mapSupabasePhoto`: `url`, `thumbnail`,
   `downloadUrl` now `mediaPaths.getMediaPath(...)` (frozen mapper parity).
2. `rebuild/src/app/routes/guest-share-api.ts` — `mapSharedPhoto`: `url`/`thumbnail` normalised.
3. `rebuild/src/features/home/useHomeContent.ts` — `guestPhotos` `url`/`thumbnail` normalised
   (fallback `photo.url` when thumbnail is null).
4. `rebuild/src/features/gallery/data.ts` — `toQueueEntry` (downloads/zip/share queue) normalised
   `url`/`thumbnail`/`downloadUrl`.
5. `rebuild/src/features/admin/album-organizer/album-organizer-data.ts` — organizer photo
   `url`/`thumbnail` normalised.

`mediaPaths.getMediaPath` semantics (unchanged contract): absolute URLs pass through untouched;
leading-slash paths unchanged; `media/...` gains `/` and, when `VITE_MEDIA_BASE_URL` is set, is
offloaded to the CDN — exactly the frozen behaviour. No double-encoding; `Bach+ette`/spaces keep
their literal characters.

## 3. Verification

| Check | Result |
|---|---|
| `npm run typecheck` (rebuild) | exit 0 |
| `npx eslint` on the 5 touched files | exit 0 |
| Prettier check on the 5 touched files | clean |
| Targeted vitest (`guest-share-api`, `useHomeContent`, `features/gallery`, `admin/album-organizer`) | **13 files / 119 tests passed** |
| Full `npx vitest run` (rebuild) | exit 0 |
| Production post-fix browser (Lead deploy) | gallery 12/12 imgs 200, film 20/20 posters, 0 bad responses, video `readyState=4` |
| CDN media probe | `/video/main.mp4` 206 + CORS + Range OK |

A local `build:prod` during diagnosis also succeeded (`dist/images` = 556 files / ~146 MB after a
candidate copy step); that scaffolding was **reverted** because the Lead's tracked-image fix makes
it redundant. Working tree now contains only the 5 source edits above (no `package.json`, no
`scripts/`, no build config, no docs/migrations).

## 4. Remaining risks

- The 5-file fix is **not yet deployed**; production still serves raw relative DB URLs on any live
  data surface until integrated.
- Live DB rendering was not visible in the post-fix production DOM capture (curated grid only) —
  after integrating, verify `/gallery` collection tabs (especially Guest Photos), `/` guest
  highlight reel, `/print`, a `/guest/<token>` share page, and the admin album organizer.
- `getMediaPath` is idempotent for absolute URLs and unchanged for leading-slash paths, so the
  already-shipped `/images/**` fix and all existing tests keep the same behaviour; no env change is
  required.
