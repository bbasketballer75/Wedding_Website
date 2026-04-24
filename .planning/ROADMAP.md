# Roadmap: Wedding Website Overhaul

## Overview

Transform theporadas.com into a polished, complete-feeling wedding archive. Start with foundation work (error handling, auth stability, code quality), move to gallery performance and upload reliability, then finalize with navigation polish and admin controls.

## Phases

- [ ] **Phase 1: Foundation & Polish** - Error boundaries, auth stability, code quality, console removal
- [ ] **Phase 2: Gallery Performance & UX** - State consolidation, caching, lazy loading, lightbox improvements
- [ ] **Phase 3: Upload Experience Polish** - Progress feedback, error recovery, upload confirmation
- [ ] **Phase 4: Navigation & Design Consistency** - Polished nav, cohesive gold theme, fast perceived performance

## Phase Details

### Phase 1: Foundation & Polish
**Goal**: Eliminate white screens, stabilize auth, remove debug code, improve lightbox and transitions
**Depends on**: Nothing (first phase)
**Requirements**: POLISH-01, POLISH-02, POLISH-03, POLISH-04, POLISH-05, POLISH-06, ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04
**Success Criteria** (what must be TRUE):
  1. Admin pages show graceful error UI (not white screens) when components fail
  2. MediaReviewPanel is decomposed into: BatchList, FaceReviewGrid, ClusterMergeModal, FaceTaggingConfirmation, ReviewImportManifest
  3. Auth operations complete without race conditions between initializeAuth and refreshSession
  4. Single Supabase client instance used throughout the app
  5. Lightbox responds to arrow keys (prev/next) and ESC to close, with visible close button
  6. All console.log/warn/error replaced with logger utility in production
  7. Page transitions use consistent Framer Motion animations across all routes
  8. Hamburger menu works on all pages with smooth open/close transitions
**Plans**: TBD

### Phase 2: Gallery Performance & UX
**Goal**: Gallery feels fast and responsive with proper state management and progressive loading
**Depends on**: Phase 1
**Requirements**: GALLERY-01, GALLERY-02, GALLERY-03, GALLERY-04
**Success Criteria** (what must be TRUE):
  1. Gallery state managed by centralized Zustand store with in-memory cache
  2. Photo type imported from supabase.ts with no duplicate local definitions
  3. Gallery images show low-quality placeholders during load, then progressively reveal full images
  4. Lightbox uses shared Zustand state, prefetches adjacent images, and navigates smoothly
**Plans**: TBD

### Phase 3: Upload Experience Polish
**Goal**: Guests see upload progress, understand errors, and receive confirmation
**Depends on**: Phase 1
**Requirements**: UPLOAD-01, UPLOAD-02, UPLOAD-03
**Success Criteria** (what must be TRUE):
  1. Upload page displays visible progress bar with percentage during file upload
  2. Upload errors show specific messages (network timeout vs file too large) with retry capability
  3. Upload success shows confirmation with "what happens next" info
**Plans**: TBD

### Phase 4: Navigation & Design Consistency
**Goal**: Navigation feels complete and intuitive with cohesive gold theme throughout
**Depends on**: Phase 3
**Requirements**: NAV-01, NAV-02, NAV-03
**Success Criteria** (what must be TRUE):
  1. Navigation menu feels complete and intuitive with smooth transitions
  2. Gold theme (#d4af37) consistently applied to all interactive elements across all pages
  3. Pages load with skeleton screens and scroll smoothly without layout shift
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Polish | 0/8 | Not started | - |
| 2. Gallery Performance & UX | 0/4 | Not started | - |
| 3. Upload Experience Polish | 0/3 | Not started | - |
| 4. Navigation & Design Consistency | 0/3 | Not started | - |