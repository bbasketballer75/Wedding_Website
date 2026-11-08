# A5 — Content & media audit (frozen legacy)

Status: audit complete for WP-7b, with one explicit gap (§7 cross-check is against the
contracts-eng artifacts as they existed at audit time; re-run the cross-check after their next
commit). Oracle: tag `legacy-freeze-2026-11-08` (commit `dd0cf48`). Method: `read`/`grep`/`glob`,
read-only file counting, one static-path resolution pass over every media path referenced from
`src/`, three read-only GETs against the public site. No media was copied, re-encoded or screenshotted.

Definition used here: **content** = anything a visitor reads or sees. Everything below must either
move into `contracts/content/` (owned by contracts-eng), be re-captured as rendered text, or be
regenerated from the DB. A4 covers behaviour; A5 covers what is on the page.

## 1. Source-of-truth map (hardcoded content)

| File | Lines | Holds | Consumers (rendered?) |
|---|---|---|---|
| `src/data/curated-photos.ts` | ~695 | 35 `GalleryPhoto` rows for the Proposal/engagement album; captions, likes, aspect ratios, dates, `faces` (name + x/y), tags, seeded comments, `photographer: 'Emma Photography'`, `collection: 'Proposal'` for all 35; trailing `.map` assigns `albumSortOrder: index+1` | `/gallery` before/alongside Supabase rows (`src/pages/Gallery.tsx:45,46-50`); **rendered** |
| `src/data/film.ts` | 292 | `MAIN_FILM_RUNTIME_LABEL='45:53'`; 10 fallback chapters; 4 `familyFilms` (labels, descriptions, durations, thumbnails, video/caption paths, preview timestamps); 4 `filmQuotes`; 5 `filmWatchPaths`; 10 `filmMomentGalleryTargets`; VTT parser + slugify + loader | chapters + family films + moment targets **rendered** (`src/pages/Film.tsx`); `filmQuotes`/`filmWatchPaths` only reachable from dead `Search.tsx` — **not rendered** |
| `src/data/weddingParty.ts` | 195 | 20 people: 2 couple, 4 parents, 7 groomsmen, 7 bridesmaids — name/fullName/role/side/image/mirrorImage/description/funFact | `FamilyTree` on `/film` (`src/components/family-tree/FamilyTree.tsx:7,143-177`) → **rendered**; also derives face-name aliases (`src/components/gallery/constants.ts:101-118`); `WeddingPartySection.tsx` is dead |
| `src/data/engagement.ts` | 92 | 35 engagement photo refs (`/images/engagement/PoradaProposal-*.webp`, captions empty) + `storyContent` (CHAPTER II, "The Proposal", 3 paragraphs, "And she said yes!", "Forever & Always") | consumers `EngagementSection`/`StoryTimeline` are **dead** → not rendered; text survives only in this module |
| `src/data/memoryTrails.ts` | 63 | 5 memory trails (id/label/description/href/cue) + lookup helpers | trail labels on `/film` (`src/pages/Film.tsx:453-461`), admin featured (`src/pages/admin/utils.ts:434-443`); hrefs are gallery/film deep links — **rendered as labels**, hrefs partly dead (§3) |
| `src/data/music.ts` | 73 | 10-track `mainPlaylist` (title/artist/src), `halloweenTrack` (Toccata & Fugue), `sfx` = both `null` | `BackgroundMusic` (dead) and `HalloweenAudio` (dead) — **nothing plays** |
| `src/data/timeline.ts` | 53 | `earlyMilestones` (5) + `lateMilestones` (3) with alternate wording | **no importer** → not rendered (the rendered timeline is `LoveTimeline.tsx`'s own 9 events) |
| `src/data/gallery.ts` | 3 | `CURATED_GALLERY_PHOTO_COUNT = 35` | no importer → dead constant |
| `src/config/weddingConfig.ts` | 8 | `WEDDING_DATE = new Date('2025-05-10T17:00:00-05:00')`, `COUPLE` names/initials, `SITE_TITLE` | `AnniversaryCountdown` (rendered), `COUPLE` used there too |
| `src/config/constants.ts` | 123 | animation/timing/breakpoints/map/gallery/video constants; `VALIDATION.guestBook` (name 2–50, message 10–500) + email regex; `API.tables` naming **stale** tables; `THEME` palette; `FEATURES` flags | validation rules are copied into copy strings but **not enforced** by the frozen composer; `API`/`THEME` unused by shipping code |

Copy that is not in a data file, by volume (quoted-string count ≥20 chars per file): `LoveTimeline.tsx`
144, `AlbumOrganizer.tsx` 87, `GuestShare.tsx` 86, `PhotoLightbox.tsx` 85, `MapView.tsx` 82 (dead),
`FeaturedContentManager.tsx` 77, `VideoPlayer.tsx` 71, `FamilyTree.tsx` 71, `Film.tsx` 70, `Print.tsx`
67, `ClaimsModeration.tsx` 64, `ClaimModal.tsx` 60, `Home.tsx` 47, `GuestPhotos.tsx` 45,
`AdminLayout.tsx` 45, `UploadQueuePanel.tsx` 44, `UploadSuccessPanel.tsx` 43, `AdminLogin.tsx` 42,
`SEOHead.tsx` 36, `Settings.tsx` 33. These are the embedded-copy hotspots a rebuild must re-capture as
rendered text (`contracts/content/rendered/<route>.json`) rather than paraphrase.

Static assets: `src/assets/gallery-1.png` (596 KB), `gallery-2.png` (810 KB), `hero-bg.png` (597 KB),
`react.svg` — **no references anywhere in `src/`** (not even CSS). ~2 MB tracked, zero render.

## 2. Media inventory (bytes, paths, ownership)

Measured 2026-11-08 (local checkout):

| Location | Files | Size | Git | Notes |
|---|---|---|---|---|
| `public/images/` | 542 | 139.3 MB | tracked | subdirs below; no files at root |
| ├ `shared-gallery-new/` | 473 | 88.2 MB | tracked | basenames match guest-upload stills (`20250511_180812-*.webp`); only referenced in code through a string match in `src/components/gallery/data.ts:81`; purpose unclear → see Q4 |
| ├ `engagement/` | 35 | 6.6 MB | tracked | exactly the 35 files referenced by **both** `curated-photos.ts` and `engagement.ts` |
| ├ `couple/` | 6 | 40.7 MB | tracked | 4 referenced (`austin.png`, `austin.webp`, `jordyn.png`, `jordyn.webp`); 2 hash-named webp unreferenced |
| ├ `wedding-party/` | 14 | 1.0 MB | tracked | 14 of 14 referenced by `weddingParty.ts` |
| ├ `parents/` | 4 | 0.3 MB | tracked | referenced |
| ├ `rings/` | 4 | 0.1 MB | tracked | **unreferenced by any code/data** |
| ├ `parent-film-cards/` | 4 | 0.1 MB | tracked | referenced by `src/data/film.ts:66,77,88,99` |
| ├ `film/` | 1 | 2.0 MB | tracked | `main-film-poster.png` (also `og` fallback for film) |
| └ `home/` | 1 | 0.2 MB | tracked | `intro-video-poster.png` (hero + default OG image) |
| `public/video/` | 14 | 2961 MB | **gitignored** | `main.mp4` 1212.9, `mom.mp4` 489.6, `christine.mp4` 470.4, `jerame.mp4` 393.3, `melony.mp4` 308.4, `edited_background_cut.mp4` 81.2, `home-hero.mp4` 2.6 + `.webm` 2.4 (both unused), 6 `.vtt` (main, main-film-chapters, mom, melony, christine, jerame) |
| `public/background_audio/` | 22 | 503.2 MB | **gitignored** | 11 `.mp3` (playlist + `SPOOKY ENGAGEMENT SECTION/…Toccata…mp3`) and the same 11 `.flac` masters; **only the 11 mp3s are referenced**, flac never is |
| `public/media/` | 22 | 14.8 MB | **gitignored** | only `timeline/{cats(8),engagement(8),bachelor+ette(6)}`; every other `/media/**` path resolves to the CDN, not the repo |
| `public/icons/` | 12 | 0.2 MB | tracked | PWA icons 70–512 px (manifest uses 8; 4 unused: 70, 150, 310×2 — referenced by `browserconfig.xml`) |
| `public/captions/` | 1 | 53 B | tracked | `empty.vtt` fallback for `<track>` (`src/components/video/VideoPlayer.tsx:169`) |
| `public/` root | 11 | — | tracked | favicons, `apple-touch-icon.png`, `browserconfig.xml`, `offline.html`, `noise.png`, `vite.svg`, `_headers`; `vite.svg`/`noise.png`/`favicon.svg` are unreferenced (`index.html` uses `favicon-custom.svg`) |

Total `public/`: **~624 files / 3.6 GB** (matches `RISK_REGISTER.md:32`). `public/video/`,
`public/background_audio/`, `public/media/` are gitignored (`.gitignore:96-99`), so a clean clone has
**no** video/audio bytes; production media lives on R2 behind `media.wedding.theporadas.com`.
`.gitignore` also covers `contracts/baseline/*` (except `metrics.json`) and parity output.

Path conventions and offload rule (`src/utils/media.ts:1-54`): only `/video/`, `/background_audio/`,
`/media/` are rewritten to `VITE_MEDIA_BASE_URL` (`:1`), with the leading slash and segment list
preserved so `Bach+ette` and `Guest Uploads` keep their `+`/spaces (`:8-12,29-35`). `/images/**` is
**never** offloaded. Dev/preview proxy `/__media_proxy` (`vite.config.js:363-393`). At build,
`postbuild` prunes `dist/{video,background_audio,media}` only when `VITE_MEDIA_BASE_URL` is set
(`scripts/prune-local-media.js:5-29`) and always re-copies `public/images` into `dist/images`
(`scripts/copy-public-images.js:7-19`). `getMediaPath` is applied at render time in
`normalizeGalleryPhoto` (`src/components/gallery/data.ts:31-36`), `Film`/`PhotoLightbox`/`Print`/
`GuestPhotos`/`GuestShare` and `LoveTimeline`, so DB rows may store either CDN URLs or local paths.

The production media host is not plain object storage: it is a **Cloudflare Worker**
(`src/workers/media-rewrite/index.ts`) that (a) allows 8 origins with CORS (`:5-14`), (b) supports
Range/If-None-Match (`:38-57`) — required for video seeking and VTT, (c) serves immutable cache
headers, (d) rewrites 10 legacy path shapes (`_thumbs/Album/Photos/...`, `media/Professional/...`,
`media/Bach+ette/...`, `media/Guest Uploads/...`, `media/timeline/...`, `/video/`, `/background_audio/`)
to R2 keys (`:81-232`), and (e) carries a ~600-entry legacy→curated filename map
(`DSC09497.webp → intro-video-poster.png`, `DSC09419.webp → austin.png`, …, `:180-668`). Any rebuild
that points at R2 directly must reproduce the rewrite map or the stored paths break.

## 3. Duplication, typos and inconsistencies

Naming of the pre-wedding album appears in **four** spellings, all load-bearing:
`Bach+ette` (gallery tab + `PHOTO_ALBUMS` + admin collections), `Bachelor+ette` (chapter label
`src/data/film.ts:48`), `Bachelor & Bachelorette` (timeline title `LoveTimeline.tsx:121`),
`Bach+ette album` (collection eyebrow `src/components/gallery/constants.ts:70`). The DB album name is
`Bach+ette`; gallery tab is `Bach+ette`; **do not normalise** without a redirect/migration plan.

DB album vocabulary vs gallery tab vocabulary (both public contracts):
DB `PhotoAlbum` = `Engagement | Bach+ette | Wedding Day | Guest Uploads`
(`src/lib/supabase/types.ts` `PHOTO_ALBUMS`), gallery tabs = `Proposal | Bach+ette | Wedding Photos |
Guest Photos` (`src/components/gallery/constants.ts:26`). Mapping lives only in
`normalizeCollectionValue` (`src/components/gallery/data.ts:51-96`). Consequences that already ship
broken: `memoryTrails` hrefs `?collection=Guest%20Uploads` and `?collection=Engagement`
(`src/data/memoryTrails.ts:41,49`) and film CTAs `?collection=Wedding+Day` / `+Guest+Uploads`
(`src/pages/Film.tsx:514-524`) are **ignored** by Gallery (it only accepts the 4 tab names,
`src/pages/Gallery.tsx:147-152`). `?collection=Bach%2Bette` works.

Date/time drift: `WEDDING_DATE = 2025-05-10T17:00:00-05:00` (`src/config/weddingConfig.ts:1`) uses a
winter offset in May (EDT is `-04:00`, so the instant is 18:00 EDT), while JSON-LD uses
`2025-05-10T15:30:00-04:00` (`src/components/seo/SEOHead.tsx:27`). Visible copy says only
"May 10, 2025" (`Home.tsx:246`, `Footer.tsx:61`, `Print.tsx:39`, `Film.tsx:262`), so nothing visible
breaks — but two different "wedding instants" exist in data.

Proposal-date wording: `Oct 31, 2022` (`src/data/timeline.ts:31`), `October 31st, 2022`
(`src/data/engagement.ts:88`), `October 31, 2022` (`LoveTimeline.tsx:103`). Couple naming:
"Austin and Jordyn Porada" (`Home.tsx:177`), "Austin & Jordyn Porada" (`Print.tsx:40`), "Austin &
Jordyn" (`Footer.tsx:110`), "Austin & Jordyn's Wedding" (`SEOHead.tsx:22`), "Austin & Jordyn |
Wedding Archive" (`index.html:14`), manifest name "Austin & Jordyn | Wedding Archive" / short
"A&J Archive" (`vite.config.js:157-158`), "A&J" nav wordmark (`Header.tsx:115`, `Home.tsx:114`).

Typos / defects to preserve-or-fix deliberately: `Developer Sandbox Sandbox OTP Mode`
(`src/components/gallery/ClaimModal.tsx:103`, duplicated word); `brosonan-mccray.webp` filename vs
person "Brosnan McCray" (`src/data/weddingParty.ts:98` — URL must stay stable); archive copy still
uses pre-wedding tense in `HomeSEO` ("Join us in celebrating the wedding", `SEOHead.tsx:171`) and
`GallerySEO` ("share your own", `:242`) though the product is a post-wedding archive; `AdminLogin`
copy says admin role lives in **user** metadata (`src/pages/AdminLogin.tsx:116-121,210-212`) while the
real check is `app_metadata.role` (`src/stores/authStore.ts:177`, migration
`20260623000100_admin_role_app_metadata.sql` noted in `:166`) — the page instructs the owner to do the
wrong thing.

Two parallel timelines: `LoveTimeline.timelineEvents` (9 events, rendered) vs `src/data/timeline.ts`
(8 milestones, unreferenced) — same story, different wording, e.g. "We met at work. Who knew a summer
job would lead to forever? Sparks flew immediately." vs "We met during a summer at work and somehow
the ordinary days started feeling a lot less ordinary…". Any extraction from `src/data/` alone
captures a version **no visitor has ever seen**.

Two parallel proposal stories: `src/data/engagement.ts:85-97` (3 paragraphs) vs `LoveTimeline.tsx`
Halloween card copy (`:413-432`, Frankenstein/Bride framing). The `engagement.ts` version is not
rendered; the Halloween version is.

Duplicate/dead media: `public/images/couple/` hash-named webps, `public/images/rings/` (4 files),
`public/images/shared-gallery-new/` (473 files, no direct path reference), `src/assets/*` (4 files),
`public/video/home-hero.mp4|webm` (hero ships a still poster only — asserted by
`tests/e2e/home.spec.ts:55-66`), `edited_background_cut.mp4`, all `.flac` masters, 4 unused PWA
icons. Missing: `/audio/spooky-ambience.mp3` referenced by dead `HalloweenEngagement.tsx:192`;
`/images/og-image.webp` referenced by `index.html:31` and `src/components/ui/ShareButton.tsx:75` but
absent from `public/images/` (live catch-all serves HTML with 200 for it) — runtime `SEOHead` swaps in
`/images/home/intro-video-poster.png`, so only non-JS crawlers see the break.

Placeholders/null content: `sfx = { rewind: null, vinylStart: null }` (`src/data/music.ts:74-77`);
`storyContent.photos` captions all empty (`src/data/engagement.ts:66,73,80`); `curatedPhotos`
captions sometimes `undefined` (e.g. curated-34/35, `src/data/curated-photos.ts:~690`); dead
`VITE_ENABLE_UPLOADS`, `VITE_ENABLE_GUESTBOOK`, `VITE_REQUIRE_UPLOAD_APPROVAL` flags in `.env.example`
are read by **no** code.

## 4. DB-driven vs hardcoded

Runtime/DB (owner-editable, must be seeded not bundled): guest uploads + statuses + rejection reasons,
guestbook messages/comments/reactions, `photos` rows (captions, albums, sort order, faces, likes,
comments count), `site_editorial_features` + history (4 slots), `moderation_audit_log`,
`activity_log`, `media_review_*` (face names → public verified names), `guest_identities`,
`photo_claims`, `guest_share_tokens`, `error_logs`.

Build-time/hardcoded (must move to `contracts/content/`): story/timeline copy, wedding party roster,
curated 35 engagement photos with their captions/faces/comments, film chapters + family films +
moments, memory-trail labels/descriptions, music playlist, all editorial UI copy, SEO strings,
admin/login/settings copy, print book copy, upload/guestbook success and error copy, 404 copy.

Hybrid: gallery covers (`COLLECTION_COVERS`, `src/components/gallery/constants.ts:88-95`) are
hardcoded paths pointing at CDN `_thumbs` objects; the actual album contents are DB rows. Print
defaults (`Wedding Day`, `maxPhotosPerAlbum = 40`, `Print.tsx:39-40,149-160`) are hardcoded policy.

## 5. Cross-check against `contracts/content/` (contracts-eng, do not edit)

Captured and matching source: `wedding.json` (date/couple/title + hero poster), `party.json` (20
people), `curated-photos.json` (35 entries), `film.json` (runtime, 10 chapters + slugs, 4 family
films, quotes, watch paths, moment targets), `music.json` (10 tracks + halloween), `memory-trails.json`
(5), `story.json` (engagement story + 35 photos), `timeline.json` (8 milestones),
`MEDIA_MANIFEST.json` (83 entries: 61 image / 11 audio / 5 video / 6 VTT, all `existsLocally: true`).

Must-not-miss list for contracts-eng (each item is either not captured, or captured from a dead source):

1. **Rendered timeline ≠ `timeline.json`.** `timeline.json` was extracted from the unrendered
   `src/data/timeline.ts`. The rendered Home timeline is `LoveTimeline.tsx:35-161` (9 events, its own
   wording, locations, and media configs). Capture it as rendered text or replace `timeline.json`.
2. **Rendered proposal story ≠ `story.json`.** `story.json` captures unrendered `engagement.ts`. The
   rendered proposal copy lives in `LoveTimeline.tsx`'s `HalloweenCard` (`:413-432`).
3. **MEDIA_MANIFEST has zero `/media/**` entries.** Missing 22 `/media/timeline/*` files (18 of them
   referenced by `mediaFiles` at `LoveTimeline.tsx:165-190`), the 4 `COLLECTION_COVERS` `_thumbs`
   paths (`src/components/gallery/constants.ts:88-95`), `/captions/empty.vtt`, `/images/og-image.webp`
   (absent), PWA icons, favicons, and every path only reachable through the Cloudflare worker's
   filename map. `existsLocally` is therefore misleading for `/media/**` (not tracked at all).
4. **Local `/media/timeline` basenames do not match `mediaFiles`.** The code lists CDN names with
   `__hash` suffixes (`…_4__1r5aqbl.jpg`), the repo has differently suffixed local mirrors
   (`…~4.jpg`). Only 2 of the 4 `cats` entries and all `engagement`/`bachelor+ette` entries exist
   locally under the listed names. A parity build that stubs the CDN must not assume the repo copy
   is the same object.
5. **Do not treat `filmQuotes`/`filmWatchPaths` as rendered content.** They only feed dead
   `Search.tsx`; including them in rendered-text parity would assert text no visitor sees (keep them
   in `film.json` as archived, not as parity targets).
6. **Music has no rendered surface.** `music.json` is correct as data, but `BackgroundMusic` is
   unmounted; do not let rendered-text parity expect a player.
7. **`src/data/timeline.ts`, `src/data/engagement.ts`, `src/data/gallery.ts`,
   `src/data/weddingParty.ts`'s `WeddingPartySection` consumers, `src/assets/*`** are all
   dead-or-data-only; label them in contracts as `sourceModule` + `rendered: false`.
8. **Copy hotspots not yet in contracts:** every string in `GuestShare.tsx`, `PhotoLightbox.tsx`,
   `ClaimModal.tsx`/`claimStore.ts`, upload queue/success copy, guestbook hero/composer/empty-state
   copy, admin dashboard/settings/featured/claims copy, `AdminLogin` role instructions, and the 404
   page copy — these need `contracts/content/rendered/<route>.json` captures, not paraphrases.
   `contracts/content/rendered/` did not exist at audit time.
9. **PWA/manifest strings** (`vite.config.js:156-188`: name, short_name, description, 2 shortcuts) and
   **`index.html` static meta** (`:14-48`) are content too; they are not in any content JSON yet.
10. **`/people` SEO copy** (`PeopleSEO`, `SEOHead.tsx:292-307`) is dead copy for a retired route —
    archive it, don't migrate it.
11. `MEDIA_MANIFEST` should record byte sizes and `tracked|gitignored|remote-only` provenance; today
    it has only `existsLocally` + `referencedBy`, so the no-media-loss check cannot distinguish a
    gitignored-but-present file from a missing one.
12. Existing `wedding.json` `weddingDateUtc: 2025-05-10T22:00:00.000Z` inherits the `-05:00` offset
    bug (should be `-04:00` → 19:00Z or 15:30 per JSON-LD); flag before it becomes the rebuild's
    canonical instant.

## 6. Content migration checklist

Must move to `contracts/content/` (structured, reviewed):
- [ ] Replace/add rendered-truth timeline JSON from `LoveTimeline.tsx:35-161`; keep
      `src/data/timeline.ts` only as an archived alternate.
- [ ] Replace/add rendered proposal copy from `LoveTimeline.tsx:413-432`; archive `engagement.ts`.
- [ ] All 35 curated photos with captions/likes/aspectRatio/faces coords/tags/seeded comments
      (`src/data/curated-photos.ts`) — faces drive the lightbox hotspots.
- [ ] 4 family films (labels/descriptions/durations/preview timestamps) + 10 chapters with stable
      `momentSlug`s + runtime label.
- [ ] 20 wedding-party people incl. `mirrorImage`, `description`, `funFact`, image paths.
- [ ] 5 memory trails (labels/descriptions/cues) with **corrected** hrefs (tab vocabulary).
- [ ] Editorial slot keys + default badges + source-type vocabulary
      (`FeaturedContentManager.tsx:29-61`).
- [ ] PWA manifest strings, manifest icons list, shortcuts, theme/background colours.
- [ ] Static meta (`index.html`) and every `SEOHead` preset string, incl. description/JSON-LD copy.

Must be re-captured as rendered text (per route, from the frozen app with fixtures):
- [ ] `/` hero, story panel, countdown labels, guest-reel headings, editorial-section headings,
      footer; `/film` hero + player chrome + parent-dance + guest-highlights + next-step; `/gallery`
      control panel, empty/error states, upload-lookup panel, lightbox chrome; `/upload` (all queue,
      error, success copy); `/guestbook` (hero, composer, empty, feed header, reactions);
      `/guest-photos`; `/guest/:token` (both error states); `/activity`; `/print`; 404;
      `/admin/login` + every admin page heading/help copy + audit action labels
      (`src/pages/admin/utils.ts:487-498`).
- [ ] Error/retry/rate-limit strings are content too (`useUploadQueue.ts:183-199`,
      `useGuestbookComposer.ts:76-86`, `useGalleryData.ts:81-86,143-147`).

Runtime/DB (do not put in content bundles; seed/migrate instead):
- [ ] `photos`, `guest_uploads`, `guestbook_messages`/`guestbook_comments`,
      `site_editorial_features`(+history), `moderation_audit_log`, `activity_log`, `media_review_*`,
      `guest_identities`, `photo_claims`, `guest_share_tokens`; plus exported open-format DB dump for
      the exit-ability invariant.
- [ ] Media: preserve R2 objects + Cloudflare worker rewrite map + filename map (or re-key and update
      every stored row); keep original bytes for downloads.

Media manifest expectations to encode explicitly:
- [ ] `/images/**` = tracked, shipped in dist, never offloaded; exact bytes/sizes recorded.
- [ ] `/video/**`, `/background_audio/**`, `/media/**` = gitignored local + remote in R2; manifest
      must state remote origin, worker rewrite rule, and CORS/Range contract (VTT 206 + ACAO).
- [ ] Guest-upload media = R2 `guest-uploads/{photos,videos}/{uuid}.{ext}` via presign fn; not part
      of the static manifest, but URLs are stored in DB rows (`photo_urls`, `video_urls`, `photos.url`,
      `photos.download_url`) → no-media-loss check must scan DB, not just the filesystem.
- [ ] Redundant/unreferenced media must be listed as such before deletion (rings, hash-named couple
      images, shared-gallery-new, src/assets, unused mp4/webm, flac masters, 4 icons).

## 7. Open questions for the owner

1. **`public/images/shared-gallery-new/` (473 files, 88 MB)**: is this the reviewed guest-upload
   stills mirror that should be the canonical guest album, or an obsolete export that can be dropped?
   Nothing in code reads the paths directly.
2. **Unreferenced asset cleanup**: rings (4), hash-named couple photos (2), `src/assets/*` (4), flac
   masters (11), `home-hero.mp4/.webm`, `edited_background_cut.mp4`, 4 unused PWA icons — confirm
   they are not wanted in the archive before the rebuild omits them.
3. **Timeline/story truth**: which version is canonical — the rendered `LoveTimeline` copy (what
   guests saw) or the `src/data/*` copy (never rendered)? Proposed default: rendered copy is truth,
   archived modules kept as historical variants.
4. **Wording fixes vs parity**: several visible defects exist (pre-wedding tense in SEO descriptions,
   "Developer Sandbox Sandbox", AdminLogin's user-metadata instruction, four Bach+ette spellings,
   `/people` in the sitemap). Fix as reviewed allowlist entries or preserve pixel/text parity?
5. **Guest upload status lookup by email**: content promises "enter the email you used to see your
   status" (`GalleryUploadLookup.tsx:44-47`). Keep that public promise (and accept its privacy
   trade-off) or change the copy/flow?
6. **Original downloads**: should the rebuilt archive keep serving original full-resolution bytes for
   every photo/video (bandwidth cost) or a "best available" rendition? `download-pack` currently zips
   `download_url || url`, so originals are the current promise.
7. **Media end-state hosting**: keep Cloudflare worker + R2 (and its path/filename rewrite map) as the
   documented, exit-able contract, or re-key media to a clean scheme during cutover (bigger migration,
   cleaner future)?
