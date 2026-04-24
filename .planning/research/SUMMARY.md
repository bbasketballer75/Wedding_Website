# Project Research Summary

**Project:** Wedding Archive Website (theporadas.com)
**Domain:** Post-wedding photo/video archive and guest interaction platform
**Researched:** 2026-04-23
**Confidence:** MEDIUM-HIGH

## Executive Summary

The wedding archive website is a content-heavy, read-heavy application requiring strong gallery performance, reliable upload handling, and an effective admin moderation workflow. Experts build these platforms with virtualization at scale, centralized state management, and progressive enhancement for the upload experience. The current codebase has a solid foundation (React 19, Supabase, Tailwind 4, Zustand, Framer Motion) but suffers from component-level state fragmentation, missing upload persistence, and a monolithic MediaReviewPanel that needs decomposition.

The recommended approach prioritizes foundation work first: consolidate state management into Zustand stores with proper caching, decompose the 900+ line MediaReviewPanel into focused components, and ensure auth operations are race-condition free. Gallery performance and upload polish follow, then admin controls refinement. This sequence respects dependencies: gallery caching must exist before virtualization improvements, and MediaReviewPanel decomposition enables parallel admin work.

Key risks center on state management consistency (existing `useState` in Gallery.tsx vs new Zustand stores), photo type drift between local definitions and supabase.ts exports, and seasonal code paths that may bypass error boundaries. Mitigation requires explicit state ownership, type consolidation, and feature-flag-first seasonal rendering.

## Key Findings

### Recommended Stack

The existing stack is well-suited for this domain. React 19's concurrent features enable smooth gallery scrolling without complex virtualization. Supabase provides all backend needs: database, auth, storage with built-in image transformations. Zustand handles state management with minimal boilerplate. Framer Motion delivers polished animations and lightbox transitions.

**Core technologies:**
- React 19.x — UI framework with concurrent features for gallery performance
- Supabase 2.99.x — backend (DB, Auth, Storage) with RLS for moderation workflow
- Tailwind CSS 4.x — styling with CSS-first configuration
- Zustand 5.x — lightweight state management with devtools support
- Framer Motion 12.x — best-in-class animation library for transitions

**Critical gaps identified:**
- No gallery virtualization (memory risk at 200+ photos)
- No upload progress persistence (progress lost on refresh)
- MediaReviewPanel.tsx at 900+ lines needs decomposition
- Gallery makes parallel Supabase calls without caching
- No LQIP (low-quality image placeholder) strategy

### Expected Features

**Must have (table stakes):**
- Photo gallery with album organization — users expect to browse by event/date
- Lightbox image viewing — standard expectation from all photo apps
- Video playback — wedding films are central memories
- Guest upload functionality — "Share your photos" expected at weddings
- Mobile responsiveness — 60%+ of guests view on phone
- Loading states everywhere — users panic without feedback
- Error states with recovery — something always fails

**Should have (competitive):**
- Face-tagged people gallery — high value differentiator vs generic wedding sites
- Admin content moderation queue — clean site, quality over quantity
- Lazy loading with placeholder shimmer — fast perceived performance
- Guest upload progress persistence — "Will my upload survive page refresh?"
- Featured content spotlight — couple highlights best moments

**Defer (v2+):**
- PWA offline verification — verify full offline gallery browsing
- Photo moment captions — context text on photos
- Album cover customization — admin sets covers
- Guest upload queue status — "Your photo is being reviewed" feedback

### Architecture Approach

The system follows a layered architecture: UI Layer (React components) → State Layer (Zustand stores) → Service Layer (galleryService, uploadService, moderationService) → Data Layer (Supabase). The GalleryStore manages gallery state, filters, pagination, and selection. The UploadStore (new) manages upload queue, progress, and retry state. AuthStore handles session and admin status.

**Major components:**
1. GalleryStore — centralized gallery state with caching; replaces component-level useState
2. uploadStore (new) — manages upload queue with progress tracking, pause/resume, retry
3. galleryService — service layer with in-memory cache for Supabase responses to avoid repeated calls
4. MediaReviewPanel decomposition — break 900+ line component into BatchList, FaceReviewGrid, ClusterMergeModal, FaceTaggingConfirmation, ReviewImportManifest

### Critical Pitfalls

1. **Photo Gallery "Feels Incomplete"** — Gallery state in component useState causes inconsistent behavior; add loading skeletons, implement shared lightbox state in Zustand, use Framer Motion shared layout for transitions. Address in Phase 2.

2. **Guest Upload Abandonment** — No visible progress, cryptic errors, progress lost on refresh. Implement per-file progress bars, persist upload queue to localStorage, add retry logic for large files. Address in Phase 3.

3. **Admin Tool Complexity Creep** — MediaReviewPanel at 900+ lines handles batches, faces, clusters, UI. Decompose into discrete sub-pages with one primary action per card. Address in Phase 1 (foundation) and Phase 4 (admin polish).

4. **Breaking Auth During Refactor** — Race conditions between initializeAuth and refreshSession documented in CONCERNS.md. Implement auth state machine, queue operations, consolidate to single Supabase client. Address in Phase 1.

5. **State Management Inconsistency After Migration** — Moving to Zustand but components still hold local state causes data to appear inconsistent. Inventory all gallery state before migration, remove component state in same PR that adds Zustand state. Address in Phase 2.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation & Auth Polish
**Rationale:** Critical path dependencies — MediaReviewPanel decomposition enables parallel admin work; auth fixes prevent race conditions during later phases; type consolidation prevents drift.
**Delivers:** Decomposed MediaReviewPanel (BatchList, FaceReviewGrid, ClusterMergeModal, FaceTaggingConfirmation, ReviewImportManifest); consolidated Photo type from src/lib/supabase.ts; auth state machine with explicit states; single Supabase client; error boundaries on admin routes; console.* replaced with logger utility; Edge Function rate limiting.
**Addresses:** Pitfalls 3 (admin complexity), 4 (auth race conditions), 7 (type drift), 8 (console errors), 10 (rate limiting bypass)
**Avoids:** Breaking existing functionality while enabling parallel work

### Phase 2: Gallery Performance & UX
**Rationale:** Depends on GalleryStore caching from foundation; virtualization requires stable state management; state consolidation must happen before performance work.
**Delivers:** Zustand GalleryStore with caching layer (galleryService.ts); virtualized MasonryGrid with react-window for 200+ photos; shared lightbox state in Zustand with Framer Motion transitions; loading skeletons matching expected photo dimensions; LQIP strategy for gallery images.
**Addresses:** Pitfalls 1 (gallery feels incomplete), 6 (state inconsistency)
**Implements:** Pattern 1 (Virtualized Gallery), Pattern 4 (Gallery Caching Layer)

### Phase 3: Upload Experience Polish
**Rationale:** Upload reliability critical for guest engagement; queue must exist before broadening upload access; depends on UploadStore foundation.
**Delivers:** UploadStore with queue persistence (localStorage); per-file progress bars with percentage; specific error messages (network timeout vs file too large); chunked uploads for files >10MB; success confirmation with "what happens next"; session tracking with resume capability.
**Addresses:** Pitfalls 2 (upload abandonment)
**Implements:** Pattern 2 (Upload Queue with Retry)

### Phase 4: Admin Controls & Moderation
**Rationale:** Final integration; admin polish depends on decomposed components from Phase 1 and moderation service patterns.
**Delivers:** Admin moderation queue with approve/reject/feature workflow; pagination for batch queries; bulk actions with clear individual override; error recovery UI on all admin pages; optimistic UI patterns with rollback on failure.
**Addresses:** Pitfalls 3 (admin complexity creep), 9 (dead UI after network errors)
**Implements:** Pattern 3 (Admin Panel Decomposition), Pattern 5 (Error Boundary Per Admin Route)

### Phase Ordering Rationale

- **Foundation first:** MediaReviewPanel decomposition and auth fixes are prerequisites for parallel work. Cannot safely add admin features without component decomposition and auth stability.
- **Gallery before admin polish:** State consolidation and virtualization must happen before refining admin controls. Prevents working on admin features with unstable state foundations.
- **Upload after foundation, before final admin:** Upload experience depends on UploadStore which depends on foundation patterns. Completes before final admin polish for integration.
- **Pitfall mapping ensures coverage:** Each phase directly addresses mapped pitfalls, preventing known failure modes.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Gallery Performance):** Virtualization patterns with masonry layout — current `react-masonry-css` lacks virtualization; evaluate `@tanstack/react-virtual` vs `react-virtuoso`. Skip research if gallery under 200 photos.
- **Phase 3 (Upload Polish):** Chunked upload implementation — Edge Function storage patterns for resumable uploads need API research.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Component decomposition, auth patterns, error boundaries — well-documented React patterns
- **Phase 4 (Admin Polish):** Pagination, bulk actions, optimistic UI — standard admin patterns

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Based on existing codebase analysis and package.json verification |
| Features | MEDIUM-HIGH | Domain knowledge + competitor analysis; web search unavailable for verification |
| Architecture | HIGH | Based on existing codebase analysis and established React patterns |
| Pitfalls | MEDIUM-HIGH | Based on CONCERNS.md documented issues and known patterns |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Gallery scale:** Unclear if gallery will exceed 200 photos. If <200, virtualization may be unnecessary. Validate during Phase 2 planning.
- **Upload volume:** No data on expected guest uploads. Rate limiting strategy depends on volume estimates.
- **Face tagging UX:** FaceReviewGrid component design needs user research. Current assumption may not match actual admin workflow.

## Sources

### Primary (HIGH confidence)
- `package.json` dependencies — current installed versions, verified in codebase
- Codebase analysis: Gallery.tsx, Upload.tsx, PhotoModeration.tsx, galleryStore.ts — current implementation patterns

### Secondary (MEDIUM-HIGH confidence)
- `.planning/codebase/CONCERNS.md` — documented issues, auth race conditions
- `.planning/PROJECT.md` — project requirements and constraints
- React 19 Blog — concurrent features documentation

### Tertiary (MEDIUM confidence)
- Supabase Storage Documentation — storage patterns, needs verification for chunked upload patterns
- Domain knowledge — wedding photo archive product patterns, not verified via external sources

---
*Research completed: 2026-04-23*
*Ready for roadmap: yes*