# Roadmap: Wedding Website Overhaul

## Milestones

- [x] **v1.0 MVP** — Phases 1-4 (shipped 2026-04-25)
- [x] **v1.1 Polish & Feature Expansion** — Phases 5-9 (shipped 2026-04-28)
- [x] **v2.0 UI/UX Polish Round 2** — Phases 10-14 (shipped 2026-04-30)
- [ ] **v3.0 Guest Experience Enhancements** — Phases 15-19 (planning)

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
| 9. PWA Offline Verification | v1.1 | 1/1 | Complete | 2026-04-28 |
| 10. Fix Blockers | v2.0 | 2/2 | Complete | 2026-04-28 |
| 11. Design Token Unification | v2.0 | 4/4 | Complete | 2026-04-28 |
| 12. Component Consolidation | v2.0 | 1/1 | Complete | 2026-04-28 |
| 13. Accessibility & Motion | v2.0 | 4/4 | Complete | 2026-04-28 |
| 14. Animation & Visual Polish | v2.0 | 3/3 | Complete | 2026-04-30 |
| 15. Activity Feed | v3.0 | 2/2 | Complete    | 2026-04-30 |
| 16. Lightbox Enhancement | v3.0 | 1/1 | Complete    | 2026-04-30 |
| 17. Download Management | v3.0 | 0/1 | Not started | — |
| 18. Photo Claiming | v3.0 | 0/1 | Not started | — |
| 19. Shared Links & Print | v3.0 | 0/1 | Not started | — |

## Archived Milestones

<details>
<summary>v1.0 MVP (Phases 1-4) — SHIPPED 2026-04-25</summary>

- [x] Phase 1: Foundation & Polish (4/4 plans) — completed 2026-04-24
- [x] Phase 2: Gallery Performance & UX (4/4 plans) — completed 2026-04-24
- [x] Phase 3: Upload Experience (1/1 plan) — completed 2026-04-24
- [x] Phase 4: Navigation & Design Consistency (3/3 plans) — completed 2026-04-25

</details>

<details>
<summary>v1.1 Polish & Feature Expansion (Phases 5-9) — SHIPPED 2026-04-28</summary>

- [x] Phase 5: Social Sharing & Upload Resume (2/2 plans) — completed 2026-04-25
- [x] Phase 6: Guest Reactions & Upload Status (1/1 plan) — completed 2026-04-25
- [x] Phase 7: Gallery Virtualization (2/2 plans) — completed 2026-04-25
- [x] Phase 8: Moderation Queue & Featured Spotlight (2/2 plans) — completed 2026-04-28
- [x] Phase 9: PWA Offline Verification (1/1 plan) — completed 2026-04-28

**Deferred:** MOD-03 (featured spotlight), GAL-03 (homepage editorial slot)

</details>

<details>
<summary>v2.0 UI/UX Polish Round 2 (Phases 10-14) — SHIPPED 2026-04-30</summary>

- [x] Phase 10: Fix Blockers (2/2 plans) — completed 2026-04-28
- [x] Phase 11: Design Token Unification (4/4 plans) — completed 2026-04-28
- [x] Phase 12: Component Consolidation (1/1 plan) — completed 2026-04-28
- [x] Phase 13: Accessibility & Motion (4/4 plans) — completed 2026-04-28
- [x] Phase 14: Animation & Visual Polish (3/3 plans) — completed 2026-04-30

**Key accomplishments:**
- Fixed invalid Tailwind classes (z-100, CSS var syntax)
- Design tokens unified across all components
- Border radius standardized to rounded-xl
- Animation durations standardized to 300ms
- Accessibility: aria-labels, prefers-reduced-motion, gold focus rings

</details>

---

## Phase Details

### Phase 15: Activity Feed

**Goal:** Users can view a chronological feed of recent site activity with realtime updates and filtering.

**Depends on:** None (first phase of v3.0)

**Requirements:** SOC-01, SOC-02, SOC-03

**Success Criteria** (what must be TRUE):
1. Activity feed page renders at `/activity` with chronological listing
2. Feed shows approved guest uploads, guestbook messages, and featured moments in order
3. New activity appears in feed without page refresh via Supabase Realtime subscription
4. "New activity" banner appears when new items arrive
5. Filter toggles (All / Photos / Guestbook / Moments) work and persist during session

**Plans:**
2/2 plans complete
- [x] 15-02-PLAN.md — UI (Activity page, components, realtime subscription)

**UI hint:** yes

---

### Phase 16: Lightbox Enhancement

**Goal:** Users can zoom, navigate, and view metadata on photos in the lightbox.

**Depends on:** Phase 15 (Activity Feed can ship independently)

**Requirements:** LB-01, LB-02, LB-03, LB-04

**Success Criteria** (what must be TRUE):
1. Pinch-to-zoom works on mobile with zoom range 1x to 3x
2. Double-tap toggles between 1x and 2x zoom
3. Swipe left/right navigates to next/previous photo with proper threshold
4. When zoomed > 1x, swipe pans instead of navigating
5. Info panel shows date taken and camera info from EXIF (graceful fallback)
6. Download button in lightbox toolbar downloads current photo at high quality

**Plans:**
1/1 plans complete
- [x] 16-01-PLAN.md — Enhance PhotoLightbox with pinch-to-zoom, swipe refinement, EXIF display, download button

**UI hint:** yes

---

### Phase 17: Download Management

**Goal:** Users can select multiple photos and download them as a batch with queue persistence.

**Depends on:** Phase 16 (Lightbox completion)

**Requirements:** DL-01, DL-02, DL-03

**Success Criteria** (what must be TRUE):
1. Long-press or checkbox toggle selects multiple photos in gallery
2. Selected count displays in header during multi-select mode
3. "Add to Download" button appears when photos are selected
4. Queue panel shows selected photos with remove option
5. "Download All" generates zip file with progress indicator
6. Queue persists across page reloads via sessionStorage

**Plans:** TBD

---

### Phase 18: Photo Claiming

**Goal:** Users can claim photos they uploaded or appear in via email or face cluster verification.

**Depends on:** Phase 17 (Download Management)

**Requirements:** SC-01, SC-02

**Success Criteria** (what must be TRUE):
1. "Claim My Photos" button visible on Guest Uploads page
2. Email entry shows matching uploads (if any) for verification
3. Magic Link email sent for identity verification before claim finalization
4. Face cluster "Claim these photos" option works for People gallery
5. Claim requests appear in admin moderation panel for approval
6. After approval, guest identity links to face cluster and guest name appears on tagged photos

**Plans:** TBD

---

### Phase 19: Shared Links & Print

**Goal:** Users can share a link to view all their contributions and order prints.

**Depends on:** Phase 18 (Photo Claiming)

**Requirements:** SC-03, PR-01

**Success Criteria** (what must be TRUE):
1. Share button generates unique link per guest
2. `/guest/:token` route renders public view of guest's uploads and guestbook entries
3. Invalid or expired token shows friendly error message
4. "Order Prints" button visible in lightbox
5. Clicking "Order Prints" opens external print provider (Shutterfly/Artifact Uprising) in new tab

**Plans:** TBD

---

## v3.0 Coverage

**Requirements:** 13/13 mapped

| Requirement | Phase |
|-------------|-------|
| SOC-01 Activity Feed Page | 15 |
| SOC-02 Realtime Updates | 15 |
| SOC-03 Filtering | 15 |
| LB-01 Pinch-to-Zoom | 16 |
| LB-02 Swipe Refinement | 16 |
| LB-03 EXIF Display | 16 |
| LB-04 Lightbox Download | 16 |
| DL-01 Multi-Select Queue | 17 |
| DL-02 Batch Download | 17 |
| DL-03 Queue Persistence | 17 |
| SC-01 Photo Claiming Email | 18 |
| SC-02 Photo Claiming Face | 18 |
| SC-03 Shared Album Links | 19 |
| PR-01 Print Redirect | 19 |

**No orphaned requirements.** All requirements mapped.

---

_Last updated: 2026-04-30 for v3.0 milestone_