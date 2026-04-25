# Project Research Summary

**Project:** Wedding Archive v1.1 Feature Expansion
**Domain:** Wedding Memory Archive Website (theporadas.com)
**Researched:** 2026-04-24
**Confidence:** HIGH

## Executive Summary

This project expands an existing wedding archive (React 19 + Supabase + Zustand) with 7 new features: gallery virtualization, guest reactions polish, featured spotlight, social sharing with OG tags, upload resume, upload status feedback, and PWA offline support. The key finding: **only ONE new library is needed** (@tanstack/react-virtual). Everything else leverages existing infrastructure or Supabase schema changes.

The recommended approach is to implement features in dependency order: social sharing and upload resume first (no dependencies), then guest reactions (requires DB migration), then gallery virtualization (core performance), then featured spotlight, then PWA offline. The critical risk is masonry virtualization breaking scroll behavior - this requires row-based virtualizer approach, not item-based. Additionally, OG tags set via useEffect will not be crawled by social bots, requiring SSR or static OG image generation.

## Key Findings

### Recommended Stack

The existing stack requires minimal changes. Only **@tanstack/react-virtual 3.13.24** is needed for gallery virtualization. Everything else is implementation work within existing patterns.

**Core technologies (no changes needed):**
- React 19.2.4, Supabase 2.99.0, Zustand 5.0.11, Framer Motion 12.35.2, Tailwind CSS 4.1.18, Vite 7.3.2
- vite-plugin-pwa 1.2.0 already configured, needs workbox tuning for offline gallery
- react-router-dom 7.13.1 with lazy-loaded routes

**New library:**
- @tanstack/react-virtual: Headless virtualization for 200+ photo galleries with masonry support

**No new libraries needed for:**
- Guest reactions: Supabase RPC + existing lucide-react Heart icon
- Social sharing: Native Web Share API with clipboard fallback
- Upload resume: Zustand persist middleware with localStorage
- Upload status: Supabase Realtime (already configured)
- PWA offline: Workbox via vite-plugin-pwa (already bundled)

### Expected Features

**Must have (table stakes - P1):**
- Gallery virtualization: Handle 200+ photos without scroll lag, use @tanstack/react-virtual with row-based masonry approach
- Guest reactions polish: Fix optimistic update rollback, ensure reactions persist after page reload
- Social sharing with OG tags: Per-page OG meta, dynamic og:image for gallery shares (note: needs SSR approach, not useEffect)
- Upload resume: localStorage queue with metadata only (NOT File objects which are non-serializable)
- Guest upload status: Post-submission status display with pending/approved/rejected states

**Should have (competitive - P2):**
- Featured content spotlight: Wire admin FeatureContentManager to homepage display
- PWA offline verification: Full offline gallery test with Supabase storage URL caching

**Defer (v2+):**
- Real-time sync of reactions: Use optimistic updates instead (not worth Supabase Realtime complexity)
- Photo comments/tagging: Use existing people gallery with face tagging instead
- Push notifications: Use email notification on approval instead

### Architecture Approach

The architecture extends existing patterns with new stores, hooks, and components. Virtualization wraps PhotoGrid via VirtualizedPhotoGrid component. Upload queue persists to localStorage via new uploadQueueStore. Guest reactions use useGuestReactions hook with optimistic updates and rollback. Featured spotlight uses existing site_editorial_features table with new FeaturedSpotlight component. PWA offline extends workbox with runtime caching for Supabase storage URLs.

**Major components:**
1. VirtualizedPhotoGrid: Replaces PhotoGrid rendering with @tanstack/react-virtual for visible-only rendering
2. uploadQueueStore: Zustand store persisting upload queue to localStorage (metadata only, not File objects)
3. useGuestReactions: Encapsulates optimistic reaction updates with rollback on failure
4. FeaturedSpotlight: Displays featured content from site_editorial_features on Home
5. ShareButtons: Social share with per-photo OG image URL generation

### Critical Pitfalls

1. **Masonry virtualization breaks scroll**: Row-based virtualizer required, not item-based. Pre-calculate item heights or use fixed aspect ratio containers. Warning: scroll position jumps, items cut off, blank gaps.

2. **Optimistic update without rollback**: Current Guestbook.tsx catches errors but does nothing. Store previous state, restore in catch block. Warning: reaction counts differ after reload.

3. **OG tags via useEffect not crawled**: Social bots see raw HTML before JS executes. Use SSR or static generation for OG tags. Warning: Facebook debugger shows incorrect thumbnail.

4. **File objects not serializable to localStorage**: File objects are browser constructs, not JSON-serializable. Store metadata only (name, size, type, fingerprint), prompt user to re-select files on restore. Warning: silent failure, empty queue on reload.

5. **PWA cache invalidation causes white screen**: New JS bundles have different hashes. Use registerType: 'prompt' or implement update notification. Warning: white screen after deploy.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Social Sharing & Upload Resume
**Rationale:** No database changes, no complex patterns, builds on existing infrastructure. These features unlock shareability and upload reliability immediately.
**Delivers:** ShareButtons component with per-photo OG support, uploadQueueStore with localStorage persistence
**Addresses:** SOCIAL-01, SOCIAL-02, ADV-02
**Avoids:** OG tags via useEffect (must use SSR-compatible approach)

### Phase 2: Guest Reactions Polish
**Rationale:** Requires DB schema change (reactions column) and Supabase RPC function. Should be in same phase as gallery virtualization since both touch Guestbook.tsx.
**Delivers:** Reactions JSONB column, atomic RPC, useGuestReactions hook with proper rollback
**Addresses:** GALLERY-06
**Avoids:** Optimistic update without rollback pitfall

### Phase 3: Gallery Virtualization
**Rationale:** Core performance feature. Must be row-based for masonry compatibility. Affects PhotoGrid, galleryStore, and Lightbox integration.
**Delivers:** VirtualizedPhotoGrid component, masonry-compatible virtualizer
**Addresses:** GALLERY-05
**Avoids:** Masonry virtualization breakage - use row-based approach with pre-calculated heights

### Phase 4: Featured Spotlight
**Rationale:** Depends on moderation queue existing. Home page integration with existing GuestHighlightReel sections.
**Delivers:** FeaturedSpotlight component, Home page integration
**Addresses:** GALLERY-07
**Avoids:** Featured spotlight not reflecting admin selections - ensure status='approved' filter

### Phase 5: PWA Offline Verification
**Rationale:** Configuration work on vite.config.js workbox settings. Caches Supabase storage URLs for offline gallery browsing.
**Delivers:** Runtime caching for gallery images, offline fallback testing
**Addresses:** ADV-01
**Avoids:** PWA cache invalidation white screen - verify update flow after deploy

### Phase Ordering Rationale

- Social sharing and upload resume have no dependencies, come first
- Guest reactions need DB migration, logically groups with virtualization work
- Virtualization is the core performance concern, should happen before spotlight which is decorative
- PWA offline is configuration work, can come last
- Featured spotlight is lowest priority (P2) among must-haves

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Gallery Virtualization):** Complex integration with masonry layout, may need detailed API research for useVirtualizer configuration
- **Phase 4 (Featured Spotlight):** Verify admin FeatureContentManager fully covers needs before implementing display

Phases with standard patterns (skip research-phase):
- **Phase 1 (Social Sharing):** Web Share API is well-documented, OG tag patterns are standard
- **Phase 2 (Guest Reactions):** Optimistic update patterns are standard, Supabase RPC is documented
- **Phase 5 (PWA Offline):** Workbox configuration is well-documented by Google

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Single new library needed, everything else verified in existing codebase |
| Features | HIGH | All features identified with implementation approach, priority matrix clear |
| Architecture | HIGH | New components and integration points mapped, patterns well-understood |
| Pitfalls | MEDIUM | Some pitfalls (OG tag crawler, masonry virtualization) need verification during implementation |

**Overall confidence:** HIGH

### Gaps to Address

- **OG tag SSR:** Need to verify whether Netlify supports SSR or if static OG image generation is needed. Facebook debugger testing required after implementation.
- **Masonry virtualizer:** Need to verify row-based approach works with existing MasonryGrid component. May need to create simplified grid layout for virtualization.
- **RLS policy audit:** Before Phase 4 (Featured Spotlight), verify site_editorial_features RLS policies allow admin access.

## Sources

### Primary (HIGH confidence)
- STACK.md: Verified existing stack, library compatibility, installation approach
- FEATURES.md: Feature prioritization matrix with complexity estimates, implementation approach for each
- ARCHITECTURE.md: Component structure, data flow, build order with dependencies
- PITFALLS.md: Critical pitfalls with prevention strategies and recovery approaches

### Codebase Sources (HIGH confidence)
- package.json: Current installed versions for compatibility verification
- src/stores/galleryStore.ts: Existing caching implementation
- src/components/gallery/PhotoGrid.tsx, MasonryGrid.tsx: Current masonry layout structure
- src/pages/Guestbook.tsx: Current reaction handling with optimistic updates
- src/pages/Upload.tsx: Current upload flow and progress tracking
- src/components/seo/SEOHead.tsx: Existing OG tag implementation
- vite.config.js: Current PWA configuration

### Documentation Sources (HIGH confidence)
- @tanstack/react-virtual documentation: React 19 compatible, peerDeps verified
- vite-plugin-pwa docs: Workbox configuration for offline gallery caching
- MDN Web Share API: Native sharing with fallback
- Supabase Realtime: Already configured, documented integration

---
*Research completed: 2026-04-24*
*Ready for roadmap: yes*