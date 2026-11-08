# A4 — Product & flow audit (frozen legacy)

Status: audit complete for WP-7b. Oracle: tag `legacy-freeze-2026-11-08` (commit `dd0cf48`), branch
`rebuild/greenfield`. Read-only method: `read`/`grep`/`glob` + file counts + three read-only GETs
against `https://www.theporadas.com` (sitemap, robots, homepage meta). No builds, tests, writes or
logins were performed. Legacy source is frozen; this document and `A5-content.md` are the only writes.

Why this matters: `PRODUCT_CONTRACT.md` lists what may not change. This audit converts that list into
per-route, per-interaction invariants and records where the legacy *rendered* product already differs
from what the contract/data imply. Wire-level detail for data belongs to A3; content inventory to A5.

## 1. Route & flow inventory

All routes are declared in `src/App.tsx:124-245`, lazy-loaded (`src/App.tsx:17-28`), wrapped in
`RouteErrorBoundary` + `PageTransition` (`src/App.tsx:31-61`), and every route change:
fires `trackPageView` (`src/App.tsx:90-93`), scrolls to top unless a hash is present
(`src/App.tsx:95-101`), and announces "Navigated to <title>" to screen readers (`src/App.tsx:45-54`).
Global chrome rules: shared `Header` is hidden on `/`, `/print` and admin (`src/App.tsx:110`);
`OfflineIndicator` is hidden on admin (`src/App.tsx:111`); `Footer` is hidden on admin and `/print`
(`src/App.tsx:251`).

| Route | Purpose / entry points | Auth | Query params & deep links | Data sources | Key states |
|---|---|---|---|---|---|
| `/` | Landing: bespoke hero nav + hero poster + scroll prompt (`src/pages/Home.tsx:89-212`), "Our Story" act break (214-256), anniversary countdown (258-260), love timeline (264), guest highlight reel (268), moment-of-week / standout-upload / featured-note editorial slots (272-280) | none | none read | `site_editorial_features` ×3 slots, `photos` (top 6 by `likes`), `guestbook_messages` (10 newest), `approved guest_uploads`, `src/data/*` + `LoveTimeline` constants | hero poster always present (`tests/e2e/home.spec.ts:55-66` asserts no `<video>`); editorial sections render `null` when slot inactive or empty; countdown flips between countdown (≤30 days before anniversary) and elapsed time (`src/components/sections/AnniversaryCountdown.tsx:13-50,77-157`) |
| `/film` | Film page: hero + family tree (`src/pages/Film.tsx:276-301`), chaptered player (303-391), parent dances (393-427), film feature slot (429), guest video highlights (431-483), next-step CTAs (485-546) | none | `?moment=<chapter-slug>`, `?clip=<family-film-id>`, `?resume=1` (all cleaned up after use, `src/pages/Film.tsx:145-220`) | `/video/main.mp4`+`.vtt` via `getMediaPath`, `/video/main-film-chapters.vtt` (fallback in `src/data/film.ts:46-57`), `guest_uploads` where `status=approved` (12 fetched → ≤6 shown, `src/pages/Film.tsx:87-143`), `site_editorial_features.film_featured_guest_video`, `src/data/film.ts` | chapters show skeleton while VTT loads then 10 buttons (`src/pages/Film.tsx:355-386`); VTT returning HTML is rejected and fallback used (`src/data/film.ts:293-310`); `?resume` marked handled then removed (`src/pages/Film.tsx:205-220`); poster required (`tests/e2e/film.spec.ts:41-84`) |
| `/gallery` | Main photo archive: header count, 4 collection cards + search + 3 view modes + select mode (`src/pages/Gallery.tsx:337-365`), upload-status lookup (390), grid (377-428), lightbox (431-440), download queue + progress overlays (442-444) | none | `?collection=<tab>`, `?q=`, `?photo=<id>`, `?shared=<id>`, `?share=<id,id,…>` (`src/pages/Gallery.tsx:90-188`) | `photos` paged 1000/req (`src/hooks/useGalleryData.ts:30,54-150`), curated module (`src/data/curated-photos.ts`), RPC `get_photo_like_statuses` / `get_photo_engagement_summary_v1`, `photo_comments`, `guest_uploads` (status lookup) | loading skeleton; load error banner keeps curated photos (`src/hooks/useGalleryData.ts:81-147`); empty state per collection w/ clear-filters CTA (`src/components/gallery/GalleryGrid.tsx:59-72`); search is client-side + deferred (`src/hooks/useGallerySearchFilters.ts:73-92`); infinite scroll 18 (grid)/12 (masonry) per page (`src/pages/Gallery.tsx:197-201`) |
| `/upload` | Guest memory upload: hero with selected counts (`src/pages/Upload.tsx:70-74`), dropzone, queue panel, submit column, share-site section, `ClaimModal` mount (`src/pages/Upload.tsx:76-140`) | none | none | Netlify fn `guest-upload-url` → R2 PUT, `guest_uploads` insert (pending), `guest_share_tokens` via `getOrCreateShareToken` (`src/pages/upload/useGuestUploadSubmit.ts:69-104`) | per-file states uploading/complete/error with retry (`src/pages/upload/UploadQueuePanel.tsx`), queue persisted in localStorage, success panel testid `upload-success-panel` (`tests/e2e/upload.spec.ts:32-49`) |
| `/guestbook` | Public guestbook: hero count, composer, search + feed (`8` initially, "Read more notes"), reactions, replies (`src/pages/Guestbook.tsx:41-124`) | none | `?message=<id>` highlight deep link (`src/pages/guestbook/useGuestbookFeed.ts:24-80`) | `guestbook_messages` + nested `guestbook_comments`, RPC `submit_guestbook_message_with_rate_limit`, fallback plain insert (`src/pages/guestbook/useGuestbookComposer.ts:96-133`), reaction PATCH on `guestbook_messages.reactions` | skeleton / load-error banner ("your note will still go through", `useGuestbookMessages.ts:32-45`); honeypot silently drops bots (`useGuestbookComposer.ts:58-74`); client rate limit 3/min + server RPC (`:76-86,96-106`); empty state component |
| `/guest-photos` | Guest memories contact sheet: stats + 6 featured thumbnails + approved-upload cards (`src/pages/GuestPhotos.tsx:63-145`) | none | none | `guest_uploads` where `status=approved` (`src/lib/supabase/guestUploads.ts:11-19`) | loading skeleton, error state, empty state (`src/pages/GuestPhotos.tsx:122-141`) |
| `/guest/:token` | Per-guest showcase album: identity header, photos tab, guestbook-note tab, copy link, lightbox with like/comment (`src/pages/GuestShare.tsx:46-547`) | public token | token path param | `guest_share_tokens`, `guest_uploads` (approved, by email), `guestbook_messages` (by email), `guest_identities`+`photo_claims`+`photos`, `photos` by URL (`src/lib/supabase/claims.ts:320-403`) | spinner; `invalid` → "Album Link Unresolved", `network` → "Connection Trouble" + retry (`src/pages/GuestShare.tsx:219-269`); auto-switches to guestbook tab when no photos (`:98-101`); `noIndex` (`:273-277`) |
| `/activity` | Activity feed: title + filter tabs + infinite feed + realtime inserts (`src/pages/Activity.tsx:28-34`) | none | none | `activity_log` (`src/lib/supabase/activity.ts:8-16`), Supabase Realtime `postgres_changes` INSERT on `activity_log` (`src/hooks/useActivityRealtime.ts:22-35`) | store-backed; skips refetch when items already loaded (`src/pages/Activity.tsx:13`); realtime bypassed under `window.__E2E__` (`useActivityRealtime.ts:11-14`) |
| `/print` | Memory book: album + guestbook selection panel (hidden on print), print-ready book, `window.print()` (`src/pages/Print.tsx:148-381`) | none | none | `photos` by `album` (`fetchAlbumPhotos`), `guestbook_messages` (oldest→newest) | albums lazy-load on toggle (`:189-202`); default album `Wedding Day` preloads (`:171-173`); print disabled until something is selected (`:209,237-245`); `@media print` hides chrome and breaks albums onto pages (`src/pages/print.css:5-17,47-58`) |
| `/admin/login` | Admin sign-in or "authenticated but not admin" state (`src/pages/AdminLogin.tsx:144-238`) | Supabase Auth | `state.from` redirect target limited to `/admin*` (`:25-32`) | `supabase.auth`, `authStore.isAdmin` from `app_metadata.role` (`src/stores/authStore.ts:158-183`) | already-admin is redirected back to requested admin URL (`:34-36`); invalid creds toast; noindex (`:72`) |
| `/admin/*` | Admin workspace, auth-gated (`src/pages/Admin.tsx:9-27`) with nested routes (`src/pages/admin/AdminLayout.tsx:144-155`) | Supabase Auth + `role: admin` | none | see §2 admin group | redirect to `/admin/login` with `state.from` (`src/pages/Admin.tsx:22-25`); loading skeleton (`:9-20`); per-page `ComponentErrorBoundary`; sidebar ≥xl, horizontal button nav <xl (`AdminLayout.tsx:106-128,161-222`) |
| `*` (404) | NotFound page, "wandered off" copy, back/home CTAs (`src/pages/NotFound.tsx:7-60`) | none | n/a | none | `noindex, nofollow` + canonical `/404` (`src/components/seo/SEOHead.tsx:309-325`); `/people` lands here by design (`tests/e2e/a11y.spec.ts:27-37`, `tests/e2e/seo.spec.ts:61-74`) |

Admin child routes (all under `/admin`, rendered by `AdminLayout.tsx:144-155`; nav + copy in
`src/pages/admin/utils.ts:73-212`):

| Route | Feature | Data sources | Notable behaviour |
|---|---|---|---|
| `/admin` | Dashboard: 4 signal rows + 4 stat cards + workflow steps (`src/pages/admin/Dashboard.tsx:168-306`) | counts on `photos`, `guest_uploads` (pending/approved), `guestbook_messages`; `media_review_batches`; `guest_face_tagging_batches` | photo count/status counts loaded in parallel (`:124-166`) |
| `/admin/photos` | Guest upload moderation (`src/pages/admin/GuestUploadModerationList.tsx:20-197`) | `guest_uploads` by status; approve/reject/bulk; publish to album inserts `photos` rows (`src/lib/supabase/guestUploads.ts:43-202`) | tabs Pending/Approved/Rejected; pending→approve/reject bulk; approved→publish to `PhotoAlbum`; each transition writes `moderation_audit_log` |
| `/admin/albums` | Album organizer: drag reorder, move between albums, bulk move/delete, undo, save (`src/components/admin/useAlbumOrganizer.ts:27-71`) | `photos.album_sort_order`; RPC `save_album_organization_v2`, `delete_gallery_photos_v1` | dnd-kit pointer + keyboard sensors (`src/components/admin/AlbumOrganizer.tsx:1-16`); draft vs saved diff, unsaved-changes guard, search disables drag (`:88-101`) |
| `/admin/review` | People review (media review batches/clusters/faces) (`src/components/admin/MediaReviewPanel.tsx`) | `media_review_batches/clusters/faces`, `guest_face_tagging_batches` (`src/lib/supabase/mediaReview.ts:25-169`) | batch status transitions, cluster merge/re-name, face confirm; drives public face-name display via `media_review_faces.confirmed_name` |
| `/admin/claims` | Photo/face claim moderation (`src/pages/admin/ClaimsModeration.tsx:30-116`) | `photo_claims` + `guest_identities` + `photos` (`src/lib/supabase/claims.ts:34-65,155-251`) | pending/approved/rejected tabs; approve sets claim approved, identity `is_verified=true`, syncs `media_review_faces`, logs audit; reject requires reason modal |
| `/admin/guestbook` | Guestbook moderation | `guestbook_messages` (+comments) | search; delete with audit trail (`src/pages/admin/GuestbookModeration.tsx:161-232`) |
| `/admin/featured` | Editorial slots | `site_editorial_features` (+ history) | 4 fixed slots (`src/pages/admin/FeaturedContentManager.tsx:29-54`): `home_moment_of_the_week`, `home_newest_standout_upload`, `home_featured_guestbook_note`, `film_featured_guest_video`; source types custom/guest_upload/guestbook_message/film_chapter (`:56-61`); upsert + history on each save (`:141+`) |
| `/admin/audit` | Moderation audit trail | `moderation_audit_log` (limit 500) | entity/action/actor filters + free-text over summary/metadata (`src/pages/admin/AuditLogView.tsx:13-70`); labels in `utils.ts:487-498` |
| `/admin/analytics` | DB-backed analytics | `guest_uploads`, `guestbook_messages`, `photos` counts in 7d/30d/90d window (`src/pages/admin/Analytics.tsx:20-97`) | explicitly *not* traffic analytics; GA4/Sentry own that (`src/pages/admin/Settings.tsx:67-76`) |
| `/admin/settings` | Read-only operations notes (`src/pages/admin/Settings.tsx:1-99`) | env (`VITE_SITE_URL`, `VITE_MEDIA_BASE_URL`) | states no in-app export/backup button exists |

## 2. Feature → invariant matrix

Invariants are acceptance-level: each is something a rebuild can fail. "Evidence" lists the strongest
frozen proof (e2e test titles, testids, unit tests). `tests/e2e/*` mocks network via
`tests/e2e/support/publicSite.ts`; those mocks are themselves a behavioural contract (Supabase REST
paths, RPC names, media host, R2 presign shape).

| Area | Surface | Invariant | Evidence |
|---|---|---|---|
| Home hero | `home-hero`, `nav` | bespoke in-hero A&J nav replaces shared Header; poster image only, no local video element; "Enter archive" scrolls to `#welcome-panel`; nav links route to `/film`, `/gallery`, `/guestbook`, `/upload`, `/print` | `tests/e2e/home.spec.ts:11-66`, `src/components/layout/publicNav.ts:11-17` |
| Home story | `LoveTimeline.tsx` | 9 hard-coded milestone cards in order (Summer 2017 → May 10 2025), Halloween-styled proposal card with 8-photo carousel, per-card "Read more/less" at 120 chars, scroll-progress rail + heart marker, closing `FilmCTACard` with resume label | `src/components/timeline/LoveTimeline.tsx:35-161,165-209,494-500,683-772,875-914` |
| Home countdown | `AnniversaryCountdown.tsx` | elapsed years/days after wedding; day/hour/min/sec countdown inside 30-day pre-anniversary window; ordinal anniversary label; single `WEDDING_DATE` source | `src/components/sections/AnniversaryCountdown.tsx:6,13-50,77-157`; `src/config/weddingConfig.ts:1` |
| Home editorial | 3 sections | four slot keys are stable; inactive/absent slot renders nothing (not an error); DB error renders an accessible `role=status` banner naming the slot | `src/components/sections/MomentOfTheWeekSection.tsx:43-80`, `StandoutUploadSection.tsx:43-81`, `FeaturedNoteSection.tsx:43-78` |
| Home guest reel | `GuestHighlightReel.tsx` | top-6 `photos` by `likes` + 10 newest guestbook notes; rotating quote every 5 s with dot navigation; self-hides when both empty; links to `/gallery` and `/guestbook` | `src/components/sections/GuestHighlightReel.tsx:10-11,20-57,164-206` |
| Film player | `VideoPlayer.tsx` | poster + `preload=metadata`; captions `<track kind=captions>` with toggle, `aria-pressed`; chapter menu + progress-bar chapter markers; 10 s skip; volume; fullscreen; cast when available; saved progress keyed `video-progress-main-film`; resume CTA reads it | `src/components/video/VideoPlayer.tsx:127-172,309-397,404-490`; `tests/e2e/film.spec.ts:41-84`; `src/utils/videoProgress.ts:1-23` |
| Film chapters | `src/data/film.ts` | 10 labels+times, stable slugs used by `?moment`; VTT loader rejects non-`WEBVTT` and falls back | `src/data/film.ts:46-57,254-310`; `tests/e2e/film.spec.ts:20-39` |
| Film family films | `ParentDance` | 4 parent dances w/ captions, durations, 4 preview-frame timestamps, modal player; `?clip=<id>` deep link opens modal and clears param on close | `src/data/film.ts:59-104`; `src/pages/Film.tsx:145-156,412-425,548-563` |
| Film guest clips | highlights | only approved guest uploads with `video_urls`; `archive_only` excluded unless featured; max 6, badge + memory-trail label | `src/pages/Film.tsx:87-143` |
| Gallery collections | `collectionTabs` | exactly 4 tabs: `Proposal`, `Bach+ette`, `Wedding Photos`, `Guest Photos`; DB `album`/`category` mapped by alias table; counts per tab; cover images per tab | `src/components/gallery/constants.ts:26,41-46,88-95`; `src/components/gallery/data.ts:51-164` |
| Gallery data | `useGalleryData` | curated photos always render even when Supabase fails; merge dedupes by id/url/thumbnail; likes/comments hydrated from RPCs; single page fetch per load (regression guard) | `src/hooks/useGalleryData.ts:54-150`; `tests/e2e/gallery.spec.ts:10-51` |
| Gallery search/views | control panel | search covers caption/location/photographer/collection/source/face names/tags; 3 view modes masonry/grid/timeline with `aria-pressed`; 9 controls measured usable at 320/390 px in both themes; select mode toggles | `src/hooks/useGallerySearchFilters.ts:73-92`; `src/components/gallery/GalleryControlPanel.tsx:17-21,64-106`; `tests/e2e/gallery.spec.ts:78-130`; `tests/e2e/a11y.spec.ts:72-85` |
| Gallery ordering | infinite scroll | album order = `album_sort_order` then newest `created_at`; page sizes 12/18; scrolling container resets on collection/search/view change | `src/hooks/useGallerySearchFilters.ts:50-67`; `src/pages/Gallery.tsx:197-201,278-280` |
| Lightbox | `PhotoLightbox.tsx` | portal dialog `role=dialog aria-modal`; focus trap + restore; Esc closes, ←/→ navigate; pinch/double-tap zoom 1–3×; face hotspots w/ verified-name badge; EXIF panel; likes; comments (name persisted in `wedding-gallery-comment-author`); download; share (`?shared=`); print modal | `src/components/photo-viewer/PhotoLightbox.tsx:61-127,155-180,221-224,420-450,453-538,541-748,754-772` |
| Batch download | download queue | selection capped at 50 with toast; ≤20 photos zipped client-side, 21–50 POST `/.netlify/functions/download-pack`; progress states; queue persisted in sessionStorage | `src/pages/Gallery.tsx:254-276`; `src/stores/downloadStore.ts:68-99`; `src/utils/download.ts:97-250` |
| Share links | `?share=` | comma-separated ids become selected+queued photos and drive `GallerySEO`/edge OG image; copy-to-clipboard link | `src/pages/Gallery.tsx:118-163,325-335`; `src/hooks/useGalleryDownloads.ts:89-95` |
| Upload | `/upload` | drag/drop or picker; only image/video; 500 MB per-file cap; duplicate fingerprints skipped; resume notice for stored queue; images compressed client-side; presign → R2 PUT with XHR progress; retry; submit blocked until name+email; insert retried 3×; success panel + share-token link | `src/pages/upload/useUploadQueue.ts:73-207,209-279`; `src/pages/upload/useGuestUploadSubmit.ts:35-121`; `tests/e2e/upload.spec.ts:16-49` |
| Upload failure copy | queue | distinct messages for slot unavailable / R2 PUT / timeout / size; `hasErrors` surfaces "Needs retry" | `src/pages/upload/useUploadQueue.ts:168-206`; `tests/e2e/upload.spec.ts:17-30` |
| Guestbook read | `/guestbook` | messages newest-first with nested comments and `reactions`; search name+content; "Read more notes" paginates by 8; `?message=` scrolls to + highlights and expands pages; deep-linked message hidden by search clears search | `src/pages/guestbook/useGuestbookFeed.ts:24-80`; `src/pages/guestbook/constants.ts:1` |
| Guestbook submit | composer | honeypot field silently succeeds; client 3/min limiter; server RPC `submit_guestbook_message_with_rate_limit` (3 per 1 min) with graceful fallback insert; optimistic prepend; form resets after 2.2 s | `src/pages/guestbook/useGuestbookComposer.ts:58-151` |
| Guestbook reactions | messages | 4 reaction types (`love/clap/laugh/wow`); per-browser fingerprint dedupe via localStorage; optimistic increment/decrement with rollback on failed PATCH | `src/pages/guestbook/constants.ts:3-8`; `src/pages/guestbook/useGuestbookReactions.ts:20-92` |
| Guestbook replies | comments | optimistic reply prepend then insert into `guestbook_comments`; failures keep optimistic state | `src/pages/guestbook/useGuestbookReplies.ts:13-31` |
| Guest share album | `/guest/:token` | token→guest email→(uploads, notes, claimed photos); dedupe photos; stats counts; tab switch; copy link with execCommand fallback; lightbox like/comment | `src/lib/supabase/claims.ts:320-403`; `src/pages/GuestShare.tsx:60-217`; `tests/e2e/v3-guest-experience.spec.ts:35-65` |
| Claims wizard | `ClaimModal` + `claimStore` | 4-step wizard (identity → 6-digit code → photo selection → submitted); reachable from `/upload` "Claim My Photos"; submits `photo_claims` rows. **Verification is client-side only** — see §6 finding S1 | `src/pages/upload/UploadHero.tsx:56-83`; `src/pages/Upload.tsx:139`; `src/stores/claimStore.ts:50,103-187,189-238` |
| Guest photos | `/guest-photos` | approved uploads only; counts; 6 featured thumbs; card shows name/date/photo count/message; empty + error states | `src/pages/GuestPhotos.tsx:23-61,122-141` |
| Activity | `/activity` | filters All/Photos/Guestbook (+moments type map); realtime INSERT prepends via banner; infinite scroll at bottom; empty state | `src/components/activity/ActivityFeed.tsx:11-70`; `src/hooks/useActivityRealtime.ts` |
| Print | `/print` | album toggles load on demand; max photos per album slider (6–200) + numeric 1–500; guestbook include toggle; print disabled when nothing selected; print CSS hides chrome and starts each album on a new page | `src/pages/Print.tsx:39-40,149-209,328-377`; `src/pages/print.css:1-77` |
| Admin moderation | photos/guestbook/claims | every state change writes an audit entry with actor (`userId`, email, name), from/to status and summary; bulk actions log per item | `src/lib/supabase/guestUploads.ts:43-149`; `src/lib/supabase/moderation.ts:16-33`; `src/lib/supabase/claims.ts:199-207,239-250` |
| Admin album organizer | `/admin/albums` | drag and keyboard reorder; move between 4 albums; bulk move after anchor / to top / bottom; delete with undo; save only dirty diffs; search disables drag | `src/components/admin/useAlbumOrganizer.ts:27-71`; `src/components/admin/AlbumOrganizer.tsx:88-110` |
| Admin featured | `/admin/featured` | 4 slots, per-slot form (active, title, summary, badge, CTA, URL, source type), history entry on save | `src/pages/admin/FeaturedContentManager.tsx:29-61,112-150`; `tests/e2e/admin-workflows.spec.ts:112-165` |
| Auth | admin gate | `isAdmin` from `app_metadata.role === 'admin'` (not user metadata); unauth `/admin/*` redirects to login preserving target; non-admin signed-in sees upgrade instructions | `src/stores/authStore.ts:158-183`; `src/pages/Admin.tsx:22-25`; `tests/e2e/admin-auth.spec.ts:22-56` |
| PWA/offline | SW + manifest | manifest (name/short_name/colors/8 icons/2 shortcuts); SW autoUpdate + clientsClaim/skipWaiting; CacheFirst for `/media/_thumbs/*` (500 entries) and other `/media/*` (300), statuses `[200]` only; offline.html precached; legacy v1 caches purged on boot; registration must settle without reload loop (≤2 document loads) | `vite.config.js:105-188,216-282`; `src/main.tsx:21-33`; `src/utils/serviceWorker.ts:188-205`; `tests/e2e/pwa-registration.spec.ts:27-78` |
| Analytics | GA4 | script injected only when `VITE_GA_ID` set; anonymize_ip; page_view sent manually per route with path/title | `src/services/AnalyticsService.ts:1-48`; `src/App.tsx:90-93` |
| Sentry | error tracking | init only with `VITE_SENTRY_DSN`; release from `__APP_VERSION__` (build commit); PII-stripping `beforeSend`; source maps uploaded then deleted; DSN host allowlisted in CSP | `src/services/ErrorLoggingService.ts:37-83`; `vite.config.js:290-312`; `public/_headers:7` |
| Accessibility | app shell | skip link is the first Tab stop and focuses `#main-content`; single `main` landmark with `aria-label`; route changes announced politely; keyboard shortcuts modal (`?`), `Ctrl+K` search-focus, `Ctrl+T` theme, gallery arrows/Esc/L; modals trap focus and restore it | `src/App.tsx:104-120`; `src/components/accessibility/SkipLink.tsx`; `src/accessibility/keyboardShortcuts.ts:152-258`; `tests/e2e/a11y.spec.ts:39-70`; `tests/e2e/home.spec.ts:12-27` |
| Reduced motion | mixed | `useReducedMotion` honored in Home hero (`src/pages/Home.tsx:68-73`), GuestPhotos, and some sections; **not** globally (page transitions, timeline animations, lightbox still animate). E2E suite forces `reducedMotion: 'reduce'` for all screenshots | `tests/e2e/support/publicSite.ts:293`; `src/App.tsx:31-42` |
| Theming | dark/light | `ui-store` persists `currentTheme`; `html[data-theme]` driven by `ThemeController`; tested at 320/390 px in both themes | `src/stores/uiStore.ts:43-115`; `src/components/theme/ThemeController.tsx`; `tests/e2e/gallery.spec.ts:80-130` |

Dead-but-present code (do **not** assume these features are live): `LoveQuiz` (no importer),
`BackgroundMusic` (no importer → **no music is mounted anywhere today**), `MapView` (gallery map),
`SortDropdown` (gallery sort), `TimelineView`, `PhotoGrid`/`PhotoItem`/`MasonryGrid`, `VideoSection`,
`StoryTimeline`, `EngagementSection`, `WeddingPartySection`, `ThankYou`, `CustomCursor`,
`HalloweenEngagement`, `components/search/Search.tsx`, `galleryService`, `security`, `sanitize`,
`validation`, `useIdleCallback`, `useWorkers`, `src/components/gallery/components/GalleryHeader.tsx`
(duplicate of the live `gallery/GalleryHeader.tsx`). Verified with an import scan across `src/`.

## 3. Data-source index (tables / RPCs / buckets)

Tables read or written by the frozen app (`grep 'from('` + module reads): `photos`, `photo_comments`,
`guest_uploads`, `guestbook_messages`, `guestbook_comments`, `guest_identities`, `photo_claims`,
`guest_share_tokens`, `site_editorial_features`, `site_editorial_feature_history`,
`moderation_audit_log`, `activity_log`, `media_review_batches`, `media_review_clusters`,
`media_review_faces`, `guest_face_tagging_batches`, `error_logs` (written by
`src/utils/logger.ts:83`), plus `wedding_gallery`/`gallery_categories` only inside the dead
`src/services/galleryService.ts:53-271`. `src/config/constants.ts:69-77` also names stale
`guest_book`, `guest_pins`, `memories` tables that no code uses.

RPCs (14; `src/lib/supabase/photos.ts:65-157,207-239`, `src/pages/guestbook/useGuestbookComposer.ts:96`):
`get_photo_like_statuses`, `get_photo_engagement_summary_v1`, `toggle_photo_like_v2`,
`create_photo_comment_v1`, `get_recent_photo_comments_v1`, `hide_photo_comment_v1`,
`delete_photo_comment_v1`, `save_album_organization_v2`, `delete_gallery_photos_v1`,
`submit_guestbook_message_with_rate_limit`. Supabase Storage buckets are not touched by frontend code
(media is CDN/R2 URLs); the single `supabase` client is `src/lib/supabase/client.ts` behind the
barrel `src/lib/supabase.ts`. Realtime: one channel `activity_feed`
(`src/hooks/useActivityRealtime.ts:22-35`). `media_review_faces.confirmed_name` is the join from admin
people review → public "verified" face names (`src/components/photo-viewer/useVerifiedNames.ts`).

## 4. External-service contract table

| Service | Contract observed in frozen code | Evidence |
|---|---|---|
| Supabase REST | anon key only; tables above; nested selects used (`guestbook_comments`, `photo_claims(*,photos(*))`, `guest_identities(*, photo_claims(*, photos(*)))`); pagination via `.range`; count-only probes via `{count:'exact',head:true}` | `src/lib/supabase/*`; `tests/e2e/support/publicSite.ts:164-242` |
| Supabase Auth | email/password; `getSession()` on boot; `refreshSession()`; admin authorised by `app_metadata.role`; RLS is authoritative (client check is UI-only) | `src/stores/authStore.ts:104-183`; `src/providers/AuthProvider.tsx` |
| Supabase Realtime | websocket channel `activity_feed`, `postgres_changes` INSERT on `activity_log`, removed on unmount | `src/hooks/useActivityRealtime.ts` |
| Netlify edge `gallery-share` | runs only for path `/gallery`; if `?share=<id>` present it looks up `photos?id=eq.<id>` with anon key and rewrites `og:title/og:description/og:image` + twitter equivalents via `HTMLRewriter`; every failure path falls through to `context.next()` | `netlify.toml:20-22`; `netlify/edge-functions/gallery-share.ts:10-104` |
| Netlify fn `guest-upload-url` | `POST` JSON `{contentType, contentLength}` → `{uploadUrl, publicUrl}`; allowlist jpeg/png/webp/heic/heif/gif/mp4/quicktime/webm; 500 MB cap; 300 s signed PUT; key `guest-uploads/{photos|videos}/{uuid}.{ext}`; needs `R2_*` env | `netlify/functions/guest-upload-url.ts:6-86` |
| Netlify fn `download-pack` | `POST {photoIds[]}` → zip attachment; max 50; fetches `download_url||url` from `photos` server-side; filename from caption; skips failed items silently | `netlify/functions/download-pack.ts:5-77` |
| Cloudflare R2 | browser PUT of the raw file to the presigned URL with `Content-Type`; public URL `${R2_PUBLIC_BASE_URL}/guest-uploads/...`; used as `photo_urls`/`video_urls` | `src/pages/upload/useUploadQueue.ts:122-167`; `.env.example` R2 block |
| Media CDN | `VITE_MEDIA_BASE_URL` offloads only `/video/`, `/background_audio/`, `/media/` (not `/images/`); dev proxy `/__media_proxy`; production host `media.wedding.theporadas.com`; VTT must be 206/`text/vtt` with CORS | `src/utils/media.ts:1-54`; `vite.config.js:363-393`; `public/_headers:7`; `tests/e2e/film.spec.ts:41-84` |
| Cloudflare media worker | production media host is a worker (`src/workers/media-rewrite/index.ts:59-...`): CORS allowlist of 8 origins (`:5-14`), `Range`/`If-None-Match` support (`:38-57`, `:240-...`), immutable cache headers, and a 10-case path rewriter (`_thumbs/Album/...` and `/media/...` → R2 keys `media/Professional/...`, `media/Bach+ette/...`, `media/Guest Uploads/...`; `/video/`, `/background_audio/` as R2-root paths); plus a ~600-entry legacy→curated filename map (`DSC09497.webp → intro-video-poster.png` etc.) | `src/workers/media-rewrite/index.ts:5-240`, filename map `:180-668` |
| Google Fonts | preconnect only; **fonts are bundled via `@fontsource`** (`instrument-sans`, `cormorant-garamond`, `pinyon-script`), CSP still allows fonts.googleapis/gstatic | `index.html:8-10`; `src/index.css:1-12`; `public/_headers:7` |
| GA4 | gtag injected at runtime only when `VITE_GA_ID` present; manual page_view per route | `src/services/AnalyticsService.ts`; `src/main.tsx:15` |
| Sentry | browser SDK; DSN `VITE_SENTRY_DSN`; release = deploy commit; traces 10 %; replay 10 %/100 % on error; CSP `connect-src` must include the DSN host | `src/services/ErrorLoggingService.ts`; `public/_headers:7`; `.env.example` |
| Netlify redirects | `wedding.theporadas.com/* → www.theporadas.com/:splat` (301); SPA catch-all `/* → /index.html` (200) | `netlify.toml:13-27` |

## 5. SEO / PWA / security-header contract

Per-route metadata is imperative DOM mutation in `src/components/seo/SEOHead.tsx` (title pattern
`<title> | Austin & Jordyn's Wedding`, description, robots, OG + Twitter, canonical, one JSON-LD
script tagged `data-seo-structured-data`, `:70-161`). Route coverage: Home (`:167`), Film (`:214`),
Gallery (`:235`, image switches to shared thumbnail + canonical `/gallery`), Guestbook (`:257`),
Upload (`:274`), People (`:292`, **dead — route removed**), 404 (`:309`), Print (`:327`, `noIndex`).
`/admin/login` sets its own noindex (`src/pages/AdminLogin.tsx:67-72`); `/guest-photos` and
`/guest/:token` use inline `SEOHead` (`src/pages/GuestPhotos.tsx:65-69`,
`src/pages/GuestShare.tsx:273-277`); `/activity` and every `/admin/*` page set **no** metadata → the
previous route's title/description/canonical persist (stale-metadata defect).
Static HTML fallback (`index.html:14-48`) duplicates meta and, importantly, points `og:image` at
`/images/og-image.webp`, which does not exist (`public/images/` has no root files), so the SPA
catch-all answers it with `text/html`; verified live 2026-11-08: `GET /images/og-image.webp` → 200
`text/html`, i.e. non-JS crawlers get a broken image, while `SEOHead` swaps to the poster at runtime.
`src/components/ui/ShareButton.tsx:75` also references the missing `og-image.webp`.
Sitemap/robots are generated post-build (`scripts/generate-sitemap.js`, `package.json` postbuild) with
7 routes, including ghost `/people` (`:11-19`); live sitemap on 2026-11-08 still lists `/people`,
which the app serves as a 404 (`tests/e2e/seo.spec.ts:61-74`) — 6 real entries + 1 404.
`robots.txt` = allow all + sitemap (live matches `generateRobots`, `:43-51`). `_headers`
(`public/_headers:1-27`): `X-Frame-Options DENY`, `nosniff`, `strict-origin-when-cross-origin`,
`Permissions-Policy camera/mic/geolocation off`, HSTS 1 yr, CSP (self + GTM/GA/Supabase/Netlify/R2/
media host/Sentry, `frame-src youtube`, blob/data images), plus a report-only twin; long-cache
`/assets/*`, no-store for `sw.js`, `registerSW.js`, `manifest.webmanifest`, `robots.txt`,
`sitemap.xml`. PWA manifest/workbox are generated by `vite.config.js` (§2 PWA row). `public/offline.html`
is precached via `includeAssets` (`vite.config.js:222-230`).

## 6. Accessibility / UX findings (evidence, not opinion)

- **A11y baseline is e2e-enforced**: axe critical violations = 0 on `/`, `/film`, `/gallery`,
  `/upload`, `/guestbook`, `/activity`, `/guest-photos` and on `/people`'s 404
  (`tests/e2e/a11y.spec.ts:9-37`), admin routes too (`tests/e2e/admin-a11y.spec.ts`). Visible-focus
  helper accepts outline **or** box-shadow **or** non-transparent border
  (`tests/e2e/support/publicSite.ts:357-371`) — a rebuild must satisfy the same rule.
- **Skip link contract**: first Tab stop is "Skip to main content"; Enter focuses `#main-content`
  which has `tabIndex={-1}` (`src/App.tsx:114-120`; `tests/e2e/home.spec.ts:12-27`).
- **Modal focus**: lightbox and share/print modals trap focus and restore the previous element
  (`src/components/photo-viewer/PhotoLightbox.tsx:155-180`; `src/components/share/ShareModal.tsx:38-54`;
  `src/components/photo-viewer/PrintModal.tsx:17-33`). Claim modal only has a backdrop button and no
  focus trap (`src/components/gallery/ClaimModal.tsx:62-98`) — a11y regression risk.
- **Mobile control-bar usability is a measurable invariant**, not a snapshot: at 320/390 px all nine
  gallery controls must have non-zero boxes inside the viewport in both themes
  (`tests/e2e/gallery.spec.ts:75-130`); shared header must fit 390 px (`tests/e2e/shell.spec.ts:15`).
- **Reduced motion is partial**: many sections call `useReducedMotion`, but `PageTransition`
  (`src/App.tsx:31-42`), `LoveTimeline`'s scroll transforms and most Framer Motion animations do not
  consult it; e2e forces `reduce` for determinism (`tests/e2e/support/publicSite.ts:293`).
- **Announcements are imperative DOM injection**: a `div[role=status][aria-live]` is appended and
  removed after 1 s (`src/accessibility/AccessibilityProvider.tsx:53-67`). Route changes announce via
  `LazyPage` (`src/App.tsx:45-54`) but admin pages are announced as "Admin Dashboard".
- **Home nav behaviour is history-sensitive**: the a11y spec still waits for
  `home-nav[aria-hidden] !== 'true'` (`tests/e2e/a11y.spec.ts:50-64`) but the frozen `Home.tsx` no
  longer sets `aria-hidden` (attribute is absent → test passes trivially). The invariant to keep is
  the observable one: skip link first, then nav reachable and visibly focused after the hero.
- **Stale/duplicate control affordances**: `PhotoLightbox` toolbar exposes Print ("Order Prints") and
  Share side-by-side with Like/Download (`:453-538`), and `PrintModal` copies the image URL to the
  clipboard before opening a vendor (`src/components/photo-viewer/PrintModal.tsx:35-53`) — UX detail
  easy to drop.
- **Security/UX finding S1 (claims)**: the "verify your identity" claim wizard never leaves the
  browser. Sandbox mode defaults on (`src/stores/claimStore.ts:50`), the 6-digit code is generated in
  the client and `console.log`ged (`:113-119`), and **both** modes accept `123456`
  (`:149-162`); only then are `photo_claims` rows inserted directly via anon REST (`:189-238`). The
  queue is admin-moderated, so nothing is auto-approved, but the UI claims identity verification that
  does not exist. Owner decision required before rebuilding this surface (see §9).
- **Security finding S2 (upload status lookup)**: `fetchGuestUploadStatus(email)` queries
  `guest_uploads` by email with the anon key (`src/lib/supabase/guestUploads.ts:205-218`) and is
  exposed as an on-page form on `/gallery` (`src/components/gallery/GalleryUploadLookup.tsx:22-40`).
  Whether anon may read arbitrary guests' rows is an RLS decision (A3), but the product behaviour
  ("enter any email, see their upload status/rejection reason") is what the rebuild would replicate.
- **Security finding S3 (guestbook reactions)**: reactions are a client-computed count PATCHed onto
  the shared message row with a localStorage fingerprint for dedupe
  (`src/pages/guestbook/useGuestbookReactions.ts:20-92`). Last-write-wins with full-object overwrite;
  two concurrent reactors can clobber each other. Preserve or replace with an RPC/RPC-count table —
  do not silently drop the 4 reaction types.

## 7. Behaviours easy to lose in a rewrite

1. Curated gallery photos must render even when `photos` RPC fails (`src/hooks/useGalleryData.ts:81-147`).
2. Gallery dedupe keys on id **or** url **or** thumbnail; curated rows are merged before live rows (`:88-107`).
3. Album → collection alias table maps 15 raw values (`src/components/gallery/data.ts:51-96`); dropping
   aliases silently empties collections (e.g. `Guest Uploads` → `Guest Photos`, `engagement` → `Proposal`).
4. `?collection=` vocabulary is the 4 **tab** names; memory-trail and film CTAs already emit
   `Guest Uploads` / `Engagement` / `Wedding Day` which the gallery ignores — the rebuild must decide
   one vocabulary, not inherit both (`src/data/memoryTrails.ts:41,49`, `src/pages/Film.tsx:514-524` vs
   `src/components/gallery/constants.ts:26`).
5. `?share=` both preselects photos for the download queue and changes OG image (edge function reads
   the same param); `?shared=` fetches one `photos` row and opens the lightbox.
6. 50-photo selection cap is enforced in three places (store, select-all, server function) — keep all three.
7. Download path splits at 20 photos: client zip ≤20, server zip 21–50 (`src/utils/download.ts:105-250`).
8. Lightbox focus trap + Esc/←/→ + pinch zoom + face hotspots + comment-author persistence are separate
   behaviours, each easy to omit.
9. Progress persistence key `video-progress-main-film` + resume CTA label + `?resume=1` cleanup.
10. Chapter VTT loader's anti-HTML guard (SPA catch-all returns HTML for missing media) (`src/data/film.ts:302-305`).
11. Parent-dance modal opens from `?clip=` and removes the param on close (`src/pages/Film.tsx:548-563`).
12. Guestbook deep link `?message=` expands pagination, clears a conflicting search, then scrolls (`useGuestbookFeed.ts:56-80`).
13. Honeypot + client limiter + server RPC rate limit stack; each layer alone is insufficient (`useGuestbookComposer.ts:58-106`).
14. Upload resume: fingerprint-matched queue persisted in localStorage, previews restored, dedupe on re-add (`useUploadQueue.ts:53-61,209-270`).
15. Upload submit retries 3× **after** R2 success so a DB blip does not orphan files (`useGuestUploadSubmit.ts:65-92`).
16. Guest-share token creation is race-safe (insert → retry read) (`src/lib/supabase/claims.ts:278-318`).
17. `AnniversaryCountdown` switches modes within 30 days of the anniversary; independent of build time (`AnniversaryCountdown.tsx:41-50`).
18. `Print` defaults to `Wedding Day` album only and disables print until content is selected.
19. Admin audit writes are part of the UX (audit page + per-card history), not just logging.
20. Album organizer saves only diffs (moves/deletes/order) via `save_album_organization_v2`; a naive
   "rewrite all rows" save changes semantics.
21. 404s must stay 404s: noindex + canonical `/404`; `/people` must not be recreated
   (`tests/e2e/seo.spec.ts:61-74`).
22. `index.html` entry is `/src/main.jsx` while the file is `src/main.tsx` — only bundler `js→ts`
   fallback (rolldown/esbuild) makes the build work; a rebuild without that fallback breaks the entry.
23. `data-testid` surfaces used by parity/e2e: `home-hero`, `home-nav`, `public-header`,
   `public-footer`, `film-hero`, `film-player-section`, `gallery-control-bar`, `gallery-results`,
   `gallery-filter-bar`, `upload-queue`, `upload-success-panel`, `admin-header`, `admin-sidebar`,
   `admin-content`, `admin-mobile-nav`, `guestbook-moderation-list`, `home-nav`.

## 8. Cross-check against `contracts/` (drift found 2026-11-08)

Read-only review of `contracts/routes.json`, `contracts/features.json`, `contracts/ui.json`,
`contracts/content/*.json` (contracts-eng's parallel work; do not edit them from this task).

- `routes.json` gallery note says collections are "Proposal, Engagement, Bach+ette, Wedding Day,
  Guest Uploads"; the frozen tab union is `Proposal | Bach+ette | Wedding Photos | Guest Photos`
  (`src/components/gallery/constants.ts:26`). Two of those five are never valid `?collection=` values.
- `routes.json` film note mentions "film quotes and watch-path CTAs"; in the frozen app
  `filmQuotes`/`filmWatchPaths` are only imported by the dead `src/components/search/Search.tsx`
  (`src/data/film.ts:106-196`) and are not rendered.
- `features.json` `home.hero` lists `src/components/sections/VideoSection.tsx` as a legacy file; it has
  no importer (dead). `home.story-timeline` lists `StoryTimeline.tsx` / `EngagementSection.tsx` /
  `src/data/timeline.ts`, none of which render; the live story is `LoveTimeline.tsx`'s own copy.
- Missing from `routes.json`: `/activity`, `/admin/*` children, `/guest/:token`, `/print` were checked
  present in part; confirm each has `query: []` where applicable and that `/activity` +
  `/admin/*` metadata behaviour (stale metadata) is captured somewhere, since it is a known defect.
- `features.json` has no feature rows yet for: claims wizard, guest-share album, guest photos page,
  print/memory book, PWA/offline, SEO/OG edge behaviour, analytics/Sentry, a11y shell, admin
  dashboard/audit/analytics/settings, album organizer semantics. These are in this A4 matrix; A4 should
  be the source when filling them in.
- `ui.json` fixes `defaultTheme: "dark"`; verify against `src/stores/uiStore.ts:46` (`defaultThemeName`
  from `@/themes`) before treating it as an invariant.

## 9. Open questions for the owner

1. **Music**: a full background-music player (`src/components/layout/BackgroundMusic.tsx`) and an
   11-track playlist exist, but nothing mounts it — no music plays today. Is the archive meant to have
   music (restore as a new/visible feature) or is the dead player out of scope?
2. **Quiz**: `LoveQuiz` ("How Well Do You Know Us?") is complete but unmounted, and
   `PRODUCT_CONTRACT.md:44` lists "quiz" under Home. Restore it, or amend the contract?
3. **Map**: `PRODUCT_CONTRACT.md:44` lists "guest map"; the Leaflet `MapView` is unmounted and the only
   map rendered is the decorative `LocationMap` inside the love timeline. Which is meant by "map"?
4. **Claims**: keep the current client-side pseudo-verification (and its `123456` bypass), replace it
   with Supabase OTP/edge-function verification, or retire the claim wizard before cutover?
5. **Guest upload status lookup by email**: keep as-is (any email can query that guest's status),
   gate it behind a magic-link/token, or remove the panel from `/gallery`?
6. **`/people`**: the sitemap advertises it while the app 404s it. Preserve the 404 and fix the
   sitemap, or restore a People page after all?
7. **Sort / gallery map / timeline views**: the contract names "sort" and "map" for the gallery but
   frozen UI ships masonry/grid/timeline + search only. Scope them in or drop them from the contract?
8. **Stale SEO on `/activity` and `/admin/*`**: fix during parity (intentional difference) or preserve
   legacy behaviour exactly?
9. **Print vendor integrations**: keep the "Order Prints" clipboard-then-open-vendor flow with
   Artifact Uprising/Shutterfly, or reduce to plain download in the rebuild?
