# A1 — Architecture audit (frozen legacy app)

Read-only audit of the parity oracle, produced for the Wave 0 stack gate. Every claim below is a
measured fact from the checkout unless explicitly marked **inference**. The audit proposes target
module boundaries only; it moves no code and makes no stack choice (A7 owns the decision).

- Oracle: tag `legacy-freeze-2026-11-08` → commit `dd0cf48`; audited HEAD `ef148a0`
  (`git rev-parse 'legacy-freeze-2026-11-08^{commit}'`, `git log --oneline -5`).
- Method: `read`/`grep`/`glob` + read-only shell. Reachability and import graphs computed in-memory
  with a Node ESM script over `git ls-files 'src/*'` (static `from` imports, `import()` and
  `import 'x'` forms; `@/` alias and relative paths resolved, extensionless and `index.*`
  resolution). Nothing executed from the app.

## 1. Summary (measured)

| Metric | Value | How |
|---|---|---|
| Tracked files under `src/` | 352 (337 `.ts/.tsx`, 6 `.css`, 9 other) | `git ls-files` |
| Lines in `src/**/*.{ts,tsx,css}` | 53,289 | sum of per-file line counts |
| Component files / lines | 154 / 21,684 | `src/components/**` |
| Page files / lines | 62 / 9,965 | `src/pages/**` |
| Modules reachable from `src/main.tsx` | 192 | import-graph BFS |
| **Dead modules (unreachable from entry)** | **110 files / 14,534 lines (27.3% of src)** | same BFS, tests excluded |
| `index.ts` barrels | 12, of which 3 have any importer | `grep from '@/…'` |
| Zustand store modules | 8 (+ barrel + 2 tests = 11 files) | `src/stores/` |
| `index.css` | 805 lines; 4 competing token systems | read |
| Unit tests under `src/` | 42 files / 346 tests (baseline in `RISK_REGISTER.md:31`) | `git ls-files` |

The app is a single-page React 19 SPA: `index.html` → `src/main.tsx` → `BrowserRouter` →
`AuthProvider` → `AppProviders` → `App` (`src/main.tsx:40-50`). All 12 route components are
`React.lazy` imports (`src/App.tsx:17-28`); there is no SSR, prerender or route-level data loader.
More than a quarter of the source tree is unreachable from the entry point — this is the single most
important input to A7 after the product contract.

## 2. Module map

| Folder | Files | Lines | Responsibility (evidence) |
|---|---:|---:|---|
| `src/` root | 7 | 1,309 | entry, shell, global CSS, test setup (`main.tsx`, `App.tsx`, `index.css`, `setupTests.tsx`) |
| `src/pages/` | 18 | 3,677 | route components; `pages/admin/` 11/2,947, `pages/guestbook/` 18/1,189, `pages/upload/` 14/1,746, `pages/film/` 2/481 |
| `src/components/` | 154 | 21,684 | UI: `ui/` 40 files, `sections/` 26, `gallery/` 27, `admin/` 16, `video/` 11, `layout/` 8, `timeline/` 6, `activity/` 6, rest ≤3 each |
| `src/hooks/` | 23 | 2,180 | gallery orchestration hooks + generic utilities; 7 dead |
| `src/stores/` | 11 | 2,360 | 8 Zustand stores + barrel + 2 tests |
| `src/utils/` | 23 | 3,383 | media paths, download, storage, retry, image compression, workers; 9 dead |
| `src/lib/` | 12 | 2,353 | `lib/supabase.ts` 159-line barrel + `lib/supabase/*` 9 modules (1,747); `lib/utils.ts` 93 |
| `src/data/` | 8 | 1,510 | static content modules (film chapters, timeline, wedding party, curated photos); 4 dead |
| `src/services/` | 4 | 766 | analytics (48), error logging/Sentry (278), gallery service (300, dead) |
| `src/context/` | 2 | 141 | `ToastContext.tsx` 108; `HalloweenContext.tsx` 33 (dead) |
| `src/workers/` | 5 | 1,641 | image/search/sync workers + media-rewrite; **all dead** |
| `src/design-system/` | 2 | 646 | a second, unused token/theme system (**0 importers**) |
| `src/composables/` | 3 | 275 | `useAnimation`, `usePageTransition` (**0 importers**) |
| `src/tokens/` + `src/themes/` | 2 | 145 | `designTokens.ts` (3 importers), `themes/index.ts` (3 importers) |
| `src/accessibility/` + `components/accessibility/` | 5 | 750 | provider, focus management, shortcuts, SkipLink, modal — split across two folders |
| `src/components/seo/` | 2 | 356 | imperative `<head>` writer + JSON-LD component (StructuredData dead) |
| `src/types/` | 3 | 1,392 | hand-written domain types (194), global `.d.ts` (117, dead), generated Supabase types (1,081, only `Json` used) |
| `src/validators/` | 5 | 303 | zod schemas — **all dead** |
| `src/config/` | 2 | 131 | `weddingConfig` (live), `constants` (dead) |
| `src/styles/` | 1 | 318 | `optimizations.css` — dead |

**Shell composition** (`src/App.tsx`): `App()` wraps `AccessibilityProvider` + `ThemeController`
(256-267); `AppContent()` owns header/footer visibility by route predicate (63-68, 110-111, 251),
`<main id='main-content'>` landmarks (114-120), a page-view analytics effect (90-93), scroll reset
(95-101), and a single `<RouteErrorBoundary>` around `<AnimatePresence>` + `<Routes>` (122-247).
`Header`/`Footer` come from `src/components/layout/`, `OfflineIndicator`/`PageLoader` from `ui/`.

## 3. Dependency direction

Folder→folder import edges (top, from measured graph; 130 distinct edges):

```
src/pages      -> src/components/ui (31)   src/pages -> src/lib (30)      src/pages -> src/utils (13)
src/pages      -> src/stores (12)          src/pages -> src/components/gallery (10)
src/pages      -> src/components/seo (11)  src/pages -> src/components/sections (7)
src/components/admin   -> src/lib (18)     src/components/admin -> src/components/ui (15)
src/components/gallery -> src/lib (17)     src/components/gallery -> src/components/ui (7)
src/components/sections-> src/lib (11)     src/components/sections -> src/data (7)
src/hooks      -> src/components/gallery (10)   src/hooks -> src/lib (7)   src/hooks -> src/utils (4)
src/stores     -> src/lib (7)              src/utils -> src/lib (2)
```

Layering is broadly `pages → components → hooks/stores → lib/utils → data`, but there are **10
upward imports in 3 folder pairs** (lower layer importing a higher one):

| From | To | Count | Example |
|---|---|---:|---|
| `src/hooks/` | `src/components/gallery/` | 8 | `useGalleryData.ts:26-27` imports `constants.ts` + `data.ts` |
| `src/data/` | `src/components/gallery/` | 1 | `curated-photos.ts:13` imports the `GalleryPhoto` type |
| `src/stores/` | `src/components/admin/` | 1 | `mediaReviewStore.ts:15` type-only import from `MediaReviewPanel.tsx` |

Barrel fan-in is essentially nil. The 12 `index.ts` barrels are
`components/{activity,layout,ui,video}/index.ts`, `composables/index.ts`, `hooks/index.ts`,
`pages/index.ts`, `stores/index.ts`, `themes/index.ts`, `types/index.ts`, `validators/index.ts`, and
`workers/media-rewrite/index.ts` (not a barrel — 693-line implementation). Importers measured:
`@/themes` 3, `@/types` 3 (one importer is dead), `@/stores` 2, and **zero** for hooks, validators,
pages, ui, layout, activity, video, composables. Imports bypass barrels to concrete paths. Two
barrels are broken by construction: `src/hooks/index.ts:2-7` re-exports `./useDebounce.js` etc.
(`.js` specifiers for `.ts` sources) and lines 1-3 export `usePageTransition` twice; nothing imports
the file, so the defects are latent.

Feature folders do not import each other. Measured cross-folder edges are page shells importing
their own feature subfolder (`pages/Guestbook.tsx` → `pages/guestbook/` 15 imports, `pages/Upload.tsx`
→ `pages/upload/` 8, `pages/Film.tsx` → `pages/film/` 2, `pages/Admin.tsx` → `pages/admin/` 1) plus
components importing the shared `ui/`, `theme/`, `accessibility/` libraries. The only genuine
feature→feature dependency in the live graph is the shared-lib inversion above plus
`photo-viewer/PhotoLightbox` importing `share/ShareModal`.

The one barrel that *is* load-bearing is `src/lib/supabase.ts`: 81 imports from 68 files against a
159-line re-export surface: the client (18), `PHOTO_ALBUMS` (21),
41 types (24-73) and 57 functions from 7 domain modules (76-156). `vite.config.js:329` additionally
forces `src/lib/supabase` into its own `app-supabase` chunk.

## 4. State and data ownership

| Layer | Contents | Notes / evidence |
|---|---|---|
| Zustand stores (8) | `authStore` 191, `galleryStore` 271, `uiStore` 116, `mediaReviewStore` **753**, `moderationStore` 256, `claimStore` 262, `downloadStore` 129, `activityFeedStore` 74 | Hooks used per file; 32 `@/stores/*` imports from 31 files |
| React context (2) | `ToastContext` 108 (live, 16 importers), `HalloweenContext` 33 (dead) | Two toast systems coexist — see §5 |
| Providers (2) | `AuthProvider` 46 (live, main.tsx:43), `AppProviders` 16 (toast only; main.tsx:44) | `AppProviders` is a one-provider indirection layer |
| Hooks (23) | 6 gallery hooks (`src/hooks/useGallery*.ts`), 7 generic, 10 other | `@/hooks/*` imported by 6 live files (12 imports) |
| Services (2 live) | `AnalyticsService` GA4 via `window.dataLayer`; `ErrorLoggingService` Sentry init + `logError`; (`galleryService` is dead) | No repository layer; stores/pages call `supabase` directly |
| Data layer | `src/lib/supabase/{photos,claims,mediaReview,guestUploads,editorial,moderation,activity,client,types}.ts` | 57 barrel exports; **hand-written** row types (41) while `src/types/supabase.generated.ts` (1,081 lines) is unused except `Json` (`lib/supabase/types.ts:8`); `createClient` is not typed with `Database` (`lib/supabase/client.ts:25`) |

Data fetching has three overlapping idioms: (a) direct `supabase.from(...)` calls in pages/stores,
(b) the typed wrappers in `lib/supabase/*`, and (c) `src/services/galleryService.ts` (dead). Example
of (a) surviving in a page: `src/pages/Gallery.tsx:96-100`, `src/hooks/useGalleryData.ts:65-79`.
Error handling is per-call-site try/catch plus a store toast; there is no single query layer, retry
policy or cache — `src/hooks/useGalleryData.ts` re-fetches the full `photos` table page-by-page
(`PAGE_SIZE = 1000`, line 30) on mount and after mutations.

## 5. Duplicate and vestigial modules (usage evidence)

Reachability from `src/main.tsx` (192 modules) leaves **110 dead modules / 14,534 lines**:

| Dead folder | Files | Lines | Representative modules |
|---|---:|---:|---|
| `src/components/ui/` | 29 | 2,991 | `CustomVideoPlayer` 397, `OptimizedImage` 322, `VirtualScroll` 253, `ImmersiveView` 244, `AccessibleGallery` 188, `Card` 155 |
| `src/components/sections/` | 19 | 2,670 | entire legacy home/engagement set: `EngagementSection` 193, `VideoSection` 272, `LoveQuiz` 197, `StoryTimeline` 163, `WeddingPartySection` 149, `engagement/` subtree 1,195 |
| `src/utils/` | 9 | 1,816 | `guestTagging` 286, `imageOptimization` 264, `renderOptimization` 243, `memoization` 240, `sanitize` 230, `workerPool` 198 |
| `src/workers/` | 4 | 1,547 | `media-rewrite` 693, `image.worker` 321, `sync.worker` 269, `search.worker` 264 — **no reachable code instantiates a Worker** |
| `src/components/gallery/` | 8 | 1,241 | `MapView` 327, `PhotoGrid` 318, `TimelineView` 206, `components/GalleryHeader` 130, `SortDropdown` 102, `components/PhotoItem` 96, `components/MasonryGrid` 45 |
| `src/design-system/` | 2 | 646 | `tokens.ts` 354, `theme.ts` 292 — 0 importers |
| `src/components/layout/` | 5 | 473 | `BackgroundMusic` 309, `CustomCursor` 102, `Layout` 46, `ScrollToTop` 14 |
| `src/components/search/` | 1 | 439 | `Search.tsx` (no `/search` route) |
| `src/hooks/` | 7 | 385 | `useIdleCallback`, `useWorkers`, `useBlurHash`, `useKeyboardShortcuts`, `useLocalStorage`, `useDebounce`, `hooks/index.ts` |
| `src/validators/` | 5 | 303 | all zod schemas + barrel |
| `src/composables/` | 3 | 275 | 0 importers |
| `src/data/` | 4 | 232 | `engagement` 97, `music` 77, `timeline` 55, `gallery` 3 |
| `src/config/constants.ts` | 1 | 123 | 0 importers |

Named duplicates/vestiges from the task outline, with measured status:

- **`providers/AppProviders.tsx`** — present, live, but wraps exactly one provider
  (`ToastContext`, 12-14). Not dead, structurally redundant.
- **`composables/*`** — 3 files / 275 lines, **0 importers anywhere** (`grep '@/composables'` and
  `composables/` → no matches outside themselves).
- **`design-system/*`** — 2 files / 646 lines, **0 importers**; only `docs/archival/CODEX.md:78,309`
  references it. It defines a third palette (`primary` gold `#C9A05C`) that does not match the
  shipped CSS tokens (`--color-gold-500: #d4af37`, `src/index.css:34`).
- **`src/types/supabase.generated.ts`** — 1,081 lines; only `Json` is imported
  (`src/lib/supabase/types.ts:8`). Every other generated table type is unused.
- **`src/routes/.eslintrc.js`** — present, and it is the **only** file under `src/routes/`. ESLint 9
  flat config (`eslint.config.js`) does not load `.eslintrc.*`, so the rule override is dead config.
- **`memoriesStore` / `useMemories`** — no longer present on this branch (`git ls-files '*memories*'`
  empty). The 2026-03-28 health analysis entry is stale; record closed.
- **`GuestBookEntry`** — defined twice (`src/types/global.d.ts:46-52`,
  `src/validators/guestBookSchema.ts:49`) and imported nowhere. `global.d.ts`'s entire export block
  (37-117) is module-scoped and unreachable; the file itself is in the dead set (117 lines).
- **Album/gallery dual path** — live: `GalleryGrid` → `VirtualizedPhotoGrid` →
  `components/VirtualizedMasonryGrid` + `useVirtualizedMasonry`. Dead: `PhotoGrid` →
  `components/MasonryGrid`; `components/PhotoItem`; duplicate `components/GalleryHeader` 130 lines
  (search/filter/upload UI) vs live `gallery/GalleryHeader` 32 lines (title + count). Also dead:
  `MapView`, `TimelineView`, `SortDropdown`, `AdvancedGallery.css`.
- **Photo viewer variants** — only one shipped viewer: `src/components/photo-viewer/PhotoLightbox.tsx`
  (773 lines, lazy-loaded from `pages/Gallery.tsx:31-33`, also reused by `GuestShare`); it embeds
  `PrintModal` (219) and uses `exifr`. There is no second live lightbox; the alternative "gallery
  immersive/AccessibleGallery" implementations are dead.
- **Two toast systems** — `context/ToastContext.tsx` (react state, mounted by `AppProviders`,
  `useToast` imported by 16 files) and `uiStore.toasts` + `components/notifications/Toast.tsx`
  (dead renderer, but still written to by `ErrorBoundary.tsx:103-108`). Neither is authoritative.
- **Two accessibility folders** — `src/accessibility/` (provider + focus + shortcuts; 8 imports from
  7 files) and `src/components/accessibility/` (SkipLink, modal; 2 imports). Same concern, two homes.
- **Four token/style systems** — (1) Tailwind v4 `@theme` in `src/index.css:21-117` is the real
  source of truth; (2) `src/tokens/designTokens.ts` claims alignment (`:2`) but its typography
  references fonts the app does not load (`'Newsreader'`, `'Allura'`, `:54-58` vs loaded
  Cormorant Garamond / Instrument Sans / Pinyon Script, `index.css:91-93`); (3) `src/themes/index.ts`
  duplicates the `--ui-*` variables also declared in `index.css:123-157` (drift risk: two copies);
  (4) `src/design-system/*` (dead). Plus dead stylesheets: `App.css` (1 line, unused),
  `styles/optimizations.css` (318), `EngagementSection.css` (196), `AdvancedGallery.css` (17).

## 6. Complexity concentration

| Lines | File | Note |
|---:|---|---|
| 1,081 | `src/types/supabase.generated.ts` | generated; effectively unused |
| 945 | `src/__tests__/ciWorkflowContract.test.ts` | test asserting workflows/config strings |
| 918 | `src/components/timeline/LoveTimeline.tsx` | scroll-driven home timeline |
| 805 | `src/index.css` | tokens + utilities + media queries |
| 773 | `src/components/photo-viewer/PhotoLightbox.tsx` | viewer, gestures, EXIF, comments, print |
| 753 | `src/stores/mediaReviewStore.ts` | admin face-review state machine |
| 696 | `src/data/curated-photos.ts` | static photo data |
| 693 | `src/workers/media-rewrite/index.ts` | dead |
| 575 | `src/components/admin/AlbumOrganizer.tsx` | drag-and-drop organizer |
| 570 | `src/pages/Film.tsx` | chaptered player page |
| 549 | `src/pages/GuestShare.tsx` | shared-album page |
| 518 | `src/components/admin/useAlbumOrganizer.ts` | organizer logic |
| 499 | `src/components/video/VideoPlayer.tsx` | custom player |
| 498 | `src/pages/admin/utils.ts` | admin nav/config helpers |
| 496 | `src/pages/admin/FeaturedContentManager.tsx` | editorial slots |
| 488 | `src/components/family-tree/FamilyTree.tsx` | film-page family tree |
| 467 | `src/pages/admin/ClaimsModeration.tsx` | claims queue |
| 462 | `src/lib/supabase/types.ts` | hand-written row types |
| 447 | `src/pages/Gallery.tsx` | gallery composition (7 hooks + 8 components) |
| 445 | `src/components/gallery/ClaimModal.tsx` | claim flow |

Complexity concentrates in the gallery (page importing 6 hooks; 27 files under
`src/components/gallery/`), the admin portal
(27 files / 6,283 lines across `components/admin` + `pages/admin`), the lightbox, and the film
timeline. Two structural duplications inflate these:

- **Routing boilerplate**: `src/App.tsx:125-244` repeats the `<RouteErrorBoundary><LazyPage ...>`
  wrapper 12 times (one per route) instead of composing it once; page titles are duplicated in
  `getPageTitle` (71-88) and again in each route's `LazyPage title=` (129-240) and again in
  `SEOHead`'s per-page factories (`SEOHead.tsx:167-344`).
- **Admin nested routing**: `src/pages/admin/AdminLayout.tsx:144-155` and `227-238` contain the
  **identical 10-route table** twice (review-layout branch vs standard branch).

## 7. Error, loading, empty-state, and a11y shell patterns

- Error: one class `ErrorBoundary` (166 lines) exporting `RouteErrorBoundary`,
  `ComponentErrorBoundary`, `APIErrorBoundary` (`components/error/ErrorBoundary.tsx:75-164`); 12
  route-level uses in `App.tsx` plus one outer boundary (122). It logs via `logError` (Sentry) and
  tries to show a toast through `uiStore` (103-108).
- Loading: `Suspense` fallback `PageLoader` per lazy route (`App.tsx:45-61`); route-level
  `AdminPageSkeleton` in `AdminLayout.tsx:143,226`; per-feature skeleton modules
  (`ui/Skeleton.tsx`, `pages/guestbook/GuestbookSkeletons.tsx`) are used directly in feature
  components rather than through one boundary.
- Empty states: inlined per feature (e.g. `GalleryGrid.tsx:59-72`); 59 matches for
  empty-state strings across 18 files. There is no shared `EmptyState` component; the
  `LoadingState`/`ErrorState` interfaces in `src/types/index.ts:69-78` are imported by nobody.
- Accessibility: `AccessibilityProvider` + `SkipLink` + `KeyboardShortcutsModal` are live;
  reduced-motion is handled globally (`index.css:731-740`) and per-component
  (`useReducedMotion` in `Home.tsx:68`, `ThemeToggle`, `GuestPhotos`).

## 8. SEO, analytics and Sentry wiring

- **SEO**: `SEOHead` (345 lines) imperatively creates/updates `<head>` meta, canonical, OG/Twitter
  and JSON-LD on mount (`components/seo/SEOHead.tsx:70-165`); nine page wrappers (`HomeSEO`,
  `FilmSEO`, `GallerySEO`, …) live in the same file (167-344) and are imported by 11 route/page
  files. Static defaults are baked into `index.html` with `__SITE_URL__` replacement
  (`vite.config.js:210-215`). Per-photo share previews are produced by a Netlify edge function on
  `/gallery` (`netlify.toml:20-22`, `netlify/edge-functions/gallery-share.ts`).
- **Analytics**: `initAnalytics()`/`trackPageView()` (`services/AnalyticsService.ts:16-48`), gated on
  `VITE_GA_ID`, called from `main.tsx:15` and `App.tsx:90-93`; no router integration, so it is a
  manual effect.
- **Sentry**: `initErrorTracking()` (`services/ErrorLoggingService.ts:37-46`), selected by
  `VITE_SENTRY_DSN`, release identity `__APP_VERSION__` injected from the Netlify commit ref
  (`vite.config.js:40-42,394-398`); source maps uploaded by `@sentry/vite-plugin` and deleted from
  `dist` (vite config 293-312; `scripts/prune-sourcemaps.js`). This is the most carefully specified
  part of the legacy pipeline and should be preserved semantically (see A2 §6).
- **PWA**: `vite-plugin-pwa` with autoUpdate, manifest and two CacheFirst runtime caches for media
  (`vite.config.js:216-282`); SW registration + cache purge in `main.tsx:6,22-33` and
  `utils/serviceWorker.ts` (which dynamically imports `workbox-window`).

## 9. Content and media ownership

- Static content is TypeScript modules under `src/data/` (8 files): live ones are `curated-photos.ts`
  (696, gallery fallback), `film.ts` (292, chapters), `memoryTrails.ts`, `weddingParty.ts`; dead:
  `engagement.ts`, `music.ts`, `timeline.ts`, `gallery.ts`.
- Media URL construction is centralised in exactly one place: `src/utils/media.ts`
  (`getMediaPath`/`getAbsoluteUrl`, 54 lines, 14 importers) driven by `VITE_MEDIA_BASE_URL`, with a
  dev proxy (`vite.config.js:363-393`). This is a clean seam to keep.
- The data/DB boundary is not typed end-to-end: `src/lib/supabase/types.ts` (462) is hand-written,
  generated types unused; `PHOTO_ALBUMS` is a runtime constant (line 99) shared through the same
  module as types.

## 10. Target module boundaries (proposal only — no code moves in Wave 0)

A feature-sliced layout that keeps the measured good seams (`lib/utils`, `utils/media`, the Supabase
domain modules) and removes the measured duplication:

```
src/app/          entry (main), router table, shell (Header/Footer/SkipLink/ErrorBoundary),
                  providers composition, error+loading boundaries, analytics/Sentry init
src/features/
  home/           Home page, timeline, countdown, editorial sections (live subset only)
  film/           Film page, chaptered player, family tree, quotes
  gallery/        gallery page + hooks + grid/virtualization + lightbox + downloads + claims/map/timeline
  guestbook/      feed, composer, moderation view models
  uploads/        guest upload flow, queue, compress/retry
  admin/          layout + 10 routes, media review, album organizer, claims, editorial, audit
  people/         face/people browsing (PeopleSEO exists today; verify route in contracts)
  print/          memory-book route + print styles
src/shared/
  ui/             design-system primitives that survive parity review (Button, Input, Skeleton…)
  data/           Supabase client + typed RPC modules + generated DB types (single source)
  lib/            utils (cn), media paths, storage, retry, logging
  config/         env contract, wedding config, analytics/Sentry adapters
```

Rules: imports flow `app → features → shared` only; no `shared → features` (this removes the 10
measured upward imports); one barrel per slice with explicit public API (avoid the legacy pattern of
12 unused barrels); delete-not-port the 110 dead modules above rather than migrating them.

## 11. Inputs this gives A7 (criteria evidence, not a choice)

- **C1 parity effort**: the oracle is client-rendered; all behaviour (lightbox, virtualization,
  chaptered film, admin drag/drop, page transitions) is client state + DOM. A candidate that keeps
  React and a client-render path inherits the oracle's component/state model almost one-to-one; any
  SSR/SSG candidate must reproduce the same post-hydration DOM and keep imperative `<head>`
  behaviour equivalent (`SEOHead`) or the edge OG function.
- **C3 performance**: current entry already lazy-loads 12 routes (`App.tsx:17-28`) and chunks vendors
  by package (`vite.config.js:322-332`); the rebuild inherits a working chunking strategy and a
  measured baseline (A6) rather than an unknown.
- **C4 SEO**: today SEO = static index.html + runtime meta writes + one edge function. SSR is an
  available optimisation, not a requirement to match current behaviour.
- **C6 migration risk**: data access is centralised in `lib/supabase/*` (57 functions) but call sites
  in pages/stores bypass it; a rebuild can adopt one query layer without touching schema.
- **C7 determinism/testability**: 42 unit tests / 346 tests and mocked e2e support
  (`tests/e2e/support/*`) exist; any candidate that changes rendering model must re-baseline visual
  regressions (A6/parity).
- **Maintainability**: 110 dead modules, 4 token systems, 2 toast systems and 12 wrapper-free routes
  are the concrete "do not reproduce" list; the rebuild should be smaller than the oracle by design.

## Open questions for the owner

Resolved during checkpoint review (owner decision, 2026-11-08): lifecycle of the currently
unreachable features (Halloween/engagement set, `Search`, `MapView`, `TimelineView`, background
music, custom cursor) is an owner decision recorded with the product audit (`A4-product.md`) and the
product contract; A1 does not re-ask it.

1. `/people` appears in the Product Contract and in `PeopleSEO` (`SEOHead.tsx:292`) but has no route
   in `App.tsx`; should the rebuild ship it as a public route or is it admin-only now?
2. Should the admin portal keep its current 10-route single-page structure, or is a flatter admin a
   welcome improvement (it affects parity scope, not public parity)?
