# Requirements: Wedding Website Overhaul

**Defined:** 2026-04-23
**Core Value:** Guests and the couple can browse, upload, and share wedding memories in a beautiful, elegant experience that feels finished and polished — not a work-in-progress.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Foundation & Polish

- [ ] **POLISH-01**: Loading states on all async operations — Skeleton/spinner components for gallery, uploads, admin data fetches
- [ ] **POLISH-02**: Error states with clear recovery — "Something went wrong, tap to retry" with specific error messages
- [ ] **POLISH-03**: Lightbox keyboard navigation — Arrow keys to navigate, ESC to close, visible close button
- [ ] **POLISH-04**: Mobile navigation consistency — Hamburger menu works on all pages, smooth transitions
- [ ] **POLISH-05**: Console.* removal in production — Replace all console.log/warn/error with logger utility
- [ ] **POLISH-06**: Smooth page transitions — Consistent Framer Motion transitions between all routes

### Admin Foundation

- [ ] **ADMIN-01**: Admin error boundaries — No white screens when components fail in admin
- [ ] **ADMIN-02**: MediaReviewPanel decomposition — Break 900+ line component into: BatchList, FaceReviewGrid, ClusterMergeModal, FaceTaggingConfirmation, ReviewImportManifest
- [ ] **ADMIN-03**: Auth race condition fix — Implement auth state machine, queue operations, prevent initializeAuth/refreshSession conflicts
- [ ] **ADMIN-04**: Single Supabase client — Consolidate duplicate client instances, ensure consistent auth state

### Gallery Performance

- [ ] **GALLERY-01**: GalleryStore with caching — Centralized Zustand store with in-memory cache for Supabase responses
- [ ] **GALLERY-02**: Photo type consolidation — Import Photo type from supabase.ts, remove duplicate local definitions in Gallery.tsx
- [ ] **GALLERY-03**: Lazy loading with LQIP — Low-quality image placeholders during load, progressive image loading
- [ ] **GALLERY-04**: Lightbox performance — Shared lightbox state in Zustand, prefetch adjacent images

### Upload Experience

- [ ] **UPLOAD-01**: Upload progress feedback — Visible progress bar during upload with percentage
- [ ] **UPLOAD-02**: Upload error recovery — Specific error messages (network timeout vs file too large), retry capability
- [ ] **UPLOAD-03**: Upload confirmation — Success confirmation after upload with "what happens next" info

### Navigation & UX

- [ ] **NAV-01**: Polished navigation — Menu feels complete and intuitive, smooth transitions
- [ ] **NAV-02**: Consistent design language — Cohesive gold theme (#d4af37) throughout all pages
- [ ] **NAV-03**: Fast perceived performance — Skeleton screens, no layout shift, smooth scrolling (Lenis)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Admin Controls

- **ADMIN-05**: Full moderation queue — Approve/reject/feature workflow for guest uploads
- **ADMIN-06**: Pagination for batch queries — Admin moderation with 50+ items
- **ADMIN-07**: Bulk actions — Batch approve/reject with individual override

### Gallery Enhancements

- **GALLERY-05**: Virtualized MasonryGrid — @tanstack/react-virtual for 200+ visible photos
- **GALLERY-06**: Guest message reactions — Heart/like on guestbook entries
- **GALLERY-07**: Featured content spotlight — Admin can highlight best photos on home page
- **GALLERY-08**: Download original quality — Save button on lightbox for full resolution

### Social & Sharing

- **SOCIAL-01**: Share to social — Share buttons with proper OG tags for wedding photos
- **SOCIAL-02**: OG tag verification — Ensure all shared links show preview images

### Advanced

- **ADV-01**: PWA offline verification — Test and verify full offline gallery browsing
- **ADV-02**: Upload resume capability — Persist upload queue to localStorage, resume on return
- **ADV-03**: Guest upload status — "Your photo is being reviewed" feedback for guests
- **ADV-04**: Album cover customization — Admin can set cover image per album

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| RSVP or invitation management | Post-wedding archive only per PROJECT.md |
| Wedding registry or gift management | Not in scope per user requirements |
| Pre-wedding announcements | Post-wedding site only |
| Real-time notifications | Creates complexity without real value |
| Live chat/messaging | Out of scope per PROJECT.md |
| Multiple event sections | Single archive with albums organizing by date/event |
| Email newsletter signup | Adds complexity and consent requirements |
| Auto face recognition | Privacy concerns, accuracy issues, manual tagging works well |
| ZIP download of all photos | Storage costs, server strain, no real urgency |
| Unlimited video uploads | Storage costs, playback performance issues |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| POLISH-01 | Phase 1 | Pending |
| POLISH-02 | Phase 1 | Pending |
| POLISH-03 | Phase 1 | Pending |
| POLISH-04 | Phase 1 | Pending |
| POLISH-05 | Phase 1 | Pending |
| POLISH-06 | Phase 1 | Pending |
| ADMIN-01 | Phase 1 | Pending |
| ADMIN-02 | Phase 1 | Pending |
| ADMIN-03 | Phase 1 | Pending |
| ADMIN-04 | Phase 1 | Pending |
| GALLERY-01 | Phase 2 | Pending |
| GALLERY-02 | Phase 2 | Pending |
| GALLERY-03 | Phase 2 | Pending |
| GALLERY-04 | Phase 2 | Pending |
| UPLOAD-01 | Phase 3 | Pending |
| UPLOAD-02 | Phase 3 | Pending |
| UPLOAD-03 | Phase 3 | Pending |
| NAV-01 | Phase 4 | Pending |
| NAV-02 | Phase 4 | Pending |
| NAV-03 | Phase 4 | Pending |
| ADMIN-05 | Phase 5 | Pending |
| ADMIN-06 | Phase 5 | Pending |
| ADMIN-07 | Phase 5 | Pending |
| GALLERY-05 | Phase 6 | Pending |
| GALLERY-06 | Phase 7 | Pending |
| GALLERY-07 | Phase 8 | Pending |
| GALLERY-08 | Phase 8 | Pending |
| SOCIAL-01 | Phase 8 | Pending |
| SOCIAL-02 | Phase 8 | Pending |
| ADV-01 | Future | Pending |
| ADV-02 | Future | Pending |
| ADV-03 | Future | Pending |
| ADV-04 | Future | Pending |

**Coverage:**
- v1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-23*
*Last updated: 2026-04-23 after research synthesis*
