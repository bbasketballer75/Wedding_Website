# Roadmap: Wedding Website Overhaul

## Milestones

- [x] **v1.0 MVP** - Phases 1-4 (shipped 2026-04-25)
- [ ] **v1.1 Polish & Feature Expansion** - Phases 5-9 (in progress)
- [ ] **v2.0 Future** - TBD

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED 2026-04-25</summary>

- [x] Phase 1: Foundation & Polish (4/4 plans) — completed 2026-04-24
- [x] Phase 2: Gallery Performance & UX (4/4 plans) — completed 2026-04-24
- [x] Phase 3: Upload Experience (1/1 plan) — completed 2026-04-24
- [x] Phase 4: Navigation & Design Consistency (3/3 plans) — completed 2026-04-25

</details>

### 🚧 v1.1 Polish & Feature Expansion (In Progress)

**Milestone Goal:** Expand moderation capabilities, improve gallery performance, add social features, and enhance PWA functionality

- [ ] **Phase 5: Social Sharing & Upload Resume** - Share buttons with OG tags, upload queue persistence
- [ ] **Phase 6: Guest Reactions & Upload Status** - Heart reactions on guestbook, upload status feedback
- [ ] **Phase 7: Gallery Virtualization** - @tanstack/react-virtual for 200+ photos
- [ ] **Phase 8: Moderation Queue & Featured Spotlight** - Full approve/reject workflow (no spotlight per D-04)
- [ ] **Phase 9: PWA Offline Verification** - Cached Supabase storage images for offline browsing

## Phase Details

### Phase 5: Social Sharing & Upload Resume
**Goal**: Guests can share photos with rich social previews and resume interrupted uploads
**Depends on**: Phase 4 (v1.0 complete)
**Requirements**: SOC-01, SOC-02, UPL-01
**Success Criteria** (what must be TRUE):
  1. Guest can tap share button on any photo and see preview modal with title/image/description
  2. Shared photo URL generates correct og:image social preview when pasted into social sites
  3. Guest with interrupted upload can return later and see incomplete uploads in queue
  4. Resumed uploads continue from where they left off (not re-uploaded from scratch)
  5. Upload queue persists across browser sessions (localStorage)
**Plans**: 2 plans
  - [x] `05-01-PLAN.md` — Share URL + OG Tags (SOC-01, SOC-02)
  - [x] `05-02-PLAN.md` — Upload Queue Persistence (UPL-01)

### Phase 6: Guest Reactions & Upload Status
**Goal**: Guests can heart guestbook entries and see upload status after submission
**Depends on**: Phase 5
**Requirements**: GAL-02, UPL-02
**Success Criteria** (what must be TRUE):
  1. Guest can tap heart icon on any guestbook entry to add/remove their reaction
  2. Heart count updates immediately (optimistic UI) and persists after page reload
  3. If optimistic update fails, previous state is restored (proper rollback)
  4. After uploading, guest sees "Your photo is being reviewed" confirmation
  5. Guest can return to site and lookup their upload status via email lookup
**Plans**: 1 plan
  - [ ] `06-01-PLAN.md` — Guest Reactions with Fingerprint + Optimistic UI (GAL-02)

### Phase 7: Gallery Virtualization
**Goal**: Gallery renders 200+ photos smoothly without scroll lag
**Depends on**: Phase 6
**Requirements**: GAL-01
**Success Criteria** (what must be TRUE):
  1. Gallery page scrolls smoothly with 200+ photos (no lag/jank)
  2. Only visible photos are rendered in DOM (virtualization working)
  3. Masonry layout preserved with proper row-based virtualization approach
  4. Lightbox opens for any virtualized photo without issues
  5. Adjacent photos prefetch for smooth lightbox navigation
**Plans**: 2 plans
  - [x] `07-01-PLAN.md` — Virtualized PhotoGrid with @tanstack/react-virtual (GAL-01)
  - [ ] `07-02-PLAN.md` — Lightbox Portal Integration (GAL-01)
**UI hint**: yes

### Phase 8: Moderation Queue & Featured Spotlight
**Goal**: Admin can approve/reject guest uploads with one click from a moderation queue. Rejected uploads include a reason visible to the guest. Bulk approve/reject supported.
**Depends on**: Phase 7
**Requirements**: MOD-01, MOD-02
**Success Criteria** (what must be TRUE):
  1. Admin sees queue of pending guest uploads in MediaReviewPanel
  2. Admin can approve any pending upload with one click
  3. Admin can reject any upload with a reason (saved to moderation_audit_log)
  4. Admin can bulk approve selected uploads
  5. Admin can bulk reject selected uploads with confirmation dialog
  6. Guest can lookup upload status by email and see rejection reason if rejected
**Plans**: 2 plans
  - [x] `08-01-PLAN.md` — Schema + Supabase functions + Zustand store
  - [x] `08-02-PLAN.md` — UI components + MediaReviewPanel integration + Gallery.tsx extension

### Phase 9: PWA Offline Verification
**Goal**: PWA serves cached gallery images when offline
**Depends on**: Phase 8
**Requirements**: PWA-01
**Success Criteria** (what must be TRUE):
  1. PWA caches Supabase storage image URLs for offline access
  2. Guest can browse previously-viewed gallery photos while offline
  3. Offline browsing works for photos in any album
  4. PWA update notification appears when new version available (no white screen)
  5. Offline fallback tested and working
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation & Polish | v1.0 | 4/4 | Complete | 2026-04-24 |
| 2. Gallery Performance & UX | v1.0 | 4/4 | Complete | 2026-04-24 |
| 3. Upload Experience | v1.0 | 1/1 | Complete | 2026-04-24 |
| 4. Navigation & Design Consistency | v1.0 | 3/3 | Complete | 2026-04-25 |
| 5. Social Sharing & Upload Resume | v1.1 | 2/2 | Complete | 2026-04-25 |
| 6. Guest Reactions & Upload Status | v1.1 | 1/1 | Complete | 2026-04-25 |
| 7. Gallery Virtualization | v1.1 | 2/2 | Complete | 2026-04-25 |
| 8. Moderation Queue & Featured Spotlight | v1.1 | 2/2 | Complete | 2026-04-28 |
| 9. PWA Offline Verification | v1.1 | 0/TBD | Not started | - |

---
_Archived milestones: `.planning/milestones/`
