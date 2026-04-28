# Roadmap: Wedding Website Overhaul

## Milestones

- [x] **v1.0 MVP** — Phases 1-4 (shipped 2026-04-25)
- [x] **v1.1 Polish & Feature Expansion** — Phases 5-9 (shipped 2026-04-28)
- [ ] **v2.0 UI/UX Polish Round 2** — Phases 10-14 (in progress)

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
| 10. Fix Blockers | v2.0 | 0/2 | Not started | - |
| 11. Design Token Unification | v2.0 | 0/4 | Not started | - |
| 12. Component Consolidation | v2.0 | 0/2 | Not started | - |
| 13. Accessibility & Motion | v2.0 | 0/4 | Not started | - |
| 14. Animation & Visual Polish | v2.0 | 0/3 | Not started | - |

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

---

## Phase Details

### Phase 10: Fix Blockers

**Goal**: Eliminate invalid Tailwind classes that cause build warnings and potential runtime issues

**Depends on**: Nothing

**Requirements**: UX-01, UX-02

**Success Criteria** (what must be TRUE):
1. BackgroundMusic.tsx no longer uses invalid `z-100` class (z-50 is max valid)
2. ErrorBoundary.tsx no longer uses invalid `bg-(--color-gold)` CSS var syntax
3. Build produces no Tailwind class validation errors for these files

**Plans**: TBD

**UI hint**: yes

---

### Phase 11: Design Token Unification

**Goal**: Replace all hardcoded values with design token references for consistency

**Depends on**: Phase 10

**Requirements**: UX-03, UX-04, UX-05, UX-06

**Success Criteria** (what must be TRUE):
1. Footer.tsx uses only design token colors (no hardcoded hex like #d4af37)
2. Home page sections use only design token colors
3. `shadow-gold` is defined in designTokens.ts or replaced with valid token
4. Avatar components use consistent gradient definition across all usages

**Plans**: TBD

**UI hint**: yes

---

### Phase 12: Component Consolidation

**Goal**: Eliminate duplicate components and fix token usage

**Depends on**: Phase 10

**Requirements**: UX-07, UX-08

**Success Criteria** (what must be TRUE):
1. Only one LoadingSpinner implementation exists (remove duplicate)
2. DarkModeToggle uses gold tokens instead of gray tokens

**Plans**: TBD

**UI hint**: yes

---

### Phase 13: Accessibility & Motion

**Goal**: Improve accessibility compliance and respect user motion preferences

**Depends on**: Phase 11

**Requirements**: UX-09, UX-10, UX-11, UX-12

**Success Criteria** (what must be TRUE):
1. All interactive elements have appropriate aria-labels
2. CustomCursor respects `prefers-reduced-motion` media query
3. Focus ring color is consistent across all focusable elements (gold or neutral)
4. Theme toggle animation is consistent with other animations

**Plans**: TBD

**UI hint**: yes

---

### Phase 14: Animation & Visual Polish

**Goal**: Standardize animation timings and visual properties for cohesive feel

**Depends on**: Phase 12

**Requirements**: UX-13, UX-14, UX-15

**Success Criteria** (what must be TRUE):
1. Border radius is consistent across components (choose rounded-xl, rounded-2xl, or rounded-3xl as standard)
2. Animation durations are consistent across components (e.g., 200ms for micro-interactions, 300ms for transitions)
3. All components use the same border-radius standard

**Plans**: TBD

**UI hint**: yes

---

## Archived Phase Details

See `.planning/milestones/` for archived milestone phase details.

---
_Last updated: 2026-04-28 for v2.0 milestone_