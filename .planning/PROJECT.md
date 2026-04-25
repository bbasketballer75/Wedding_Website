# Wedding Website Overhaul

## What This Is

A post-wedding digital archive for Austin & Jordyn (theporadas.com) — a permanent home for engagement and wedding memories, accessible to extended guests and the local community. The site serves as a beautiful, elegant memory preservation platform where guests can upload photos, sign the guestbook, and relive the celebration.

**Core value:** Create a stunning, complete-feeling archive that guests and the couple will treasure for years — every interaction should feel polished and intentional.

## Core Value

Guests and the couple can browse, upload, and share wedding memories in a beautiful, elegant experience that feels finished and polished — not a work-in-progress.

## Requirements

### Validated

These features exist and work — they form the foundation we're building on.

- ✓ Photo gallery with albums (Engagement, Bach+ette, Wedding Day, Guest Uploads)
- ✓ Video playback with chaptered film
- ✓ Guest upload functionality (photos/videos)
- ✓ Guestbook message submission
- ✓ Face-tagged people gallery
- ✓ Admin authentication and login
- ✓ React Router navigation between pages
- ✓ Basic mobile responsiveness
- ✓ PWA support for offline access
- ✓ Polished, intuitive navigation — Gold border active state, smooth transitions — v1.0
- ✓ Admin panel for guest content moderation — MediaReviewPanel decomposed, error boundaries — v1.0
- ✓ Consistent, elegant UI/UX — Gold theme consistently applied — v1.0
- ✓ Gallery performance & UX — Zustand store, LQIP, prefetch, sessionStorage caching — v1.0
- ✓ Fully wired features — No broken links, skeleton loading states — v1.0
- ✓ Reliable upload experience — Determinate progress bar, error differentiation, retry — v1.0
- ✓ Admin error boundaries — No white screens on component failures — v1.0
- ✓ Auth race condition fix — Serialized auth operations, single Supabase client — v1.0
- ✓ MediaReviewPanel decomposition — 1716 → 325 lines, 5 components — v1.0

### Active

What we're building toward in next release.

- [ ] **Moderation queue expansion** — Full approve/reject/feature workflow (ADMIN-05, ADMIN-06, ADMIN-07)
- [ ] **Gallery virtualization** — @tanstack/react-virtual for 200+ visible photos (GALLERY-05)
- [ ] **Guest reactions** — Heart/like on guestbook entries (GALLERY-06)
- [ ] **Featured content spotlight** — Admin highlights best photos on home (GALLERY-07)
- [ ] **Social sharing** — Share buttons with OG tags (SOCIAL-01, SOCIAL-02)
- [ ] **PWA offline verification** — Test full offline gallery browsing (ADV-01)
- [ ] **Upload resume** — Persist upload queue to localStorage (ADV-02)
- [ ] **Guest upload status** — "Your photo is being reviewed" feedback (ADV-03)

### Out of Scope

Explicitly excluded — do not add these.

- RSVP or invitation management — This is a POST-wedding archive, not a planning site
- Wedding registry or gift management
- Save-the-date or pre-wedding announcements
- Chat or messaging between guests
- Email campaigns or newsletters
- Multiple event support (rehearsal dinner, brunch, etc. as separate sections)

## Context

**Technical Environment:**
- React 19 + TypeScript + Vite frontend
- Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- Zustand for state management
- Framer Motion for animations
- Netlify deployment

**Current Issues (from codebase analysis):**
- ~~MediaReviewPanel.tsx is 900+ lines~~ — RESOLVED v1.0 (decomposed into 5 components)
- ~~Gallery state held in component state~~ — RESOLVED v1.0 (Zustand with sessionStorage)
- ~~Photo type duplication~~ — RESOLVED v1.0 (canonical Photo from supabase.ts)
- ~~Auth race conditions~~ — RESOLVED v1.0 (serialized operation queue)
- ~~Admin pages lack error boundaries~~ — RESOLVED v1.0 (ComponentErrorBoundary wrapping)
- ~~Gallery no caching~~ — RESOLVED v1.0 (sessionStorage persistence)
- ~~No upload progress~~ — RESOLVED v1.0 (XHR with progress tracking)
- ~~Console.log in production~~ — RESOLVED v1.0 (esbuild console drop)

**Design Context:**
- Beautiful, elegant wedding aesthetic
- Gold accents (theme color #d4af37)
- Dark theme with cream backgrounds
- Should feel timeless, not trendy

## Constraints

- **Budget**: Cost-effective or free/open-source solutions only
- **Timeline**: No hard deadline, but "done ASAP"
- **Tech Stack**: Must use existing React + Supabase + Netlify stack
- **Content**: All existing photos/videos/content must be preserved

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Post-wedding only | Explicit user requirement | ✓ Confirmed — archive site only |
| Build on existing codebase | User said "don't wipe what we have" | ✓ Confirmed — incremental improvements |
| Open to suggestions | User invited additions | ✓ Applied — suggestions incorporated |
| Prioritize polish over new features | "Feels incomplete" is main pain point | ✓ Achieved — v1.0 shipped with polish |
| Foundation before features | Stability and code quality first | ✓ Validated — good engineering practice |
| Zustand for gallery state | Centralized state with persistence | ✓ Achieved — sessionStorage caching working |
| XHR for upload progress | Need progress events from fetch | ✓ Achieved — real percentage progress bar |

## Current State

**v1.0 MVP shipped** — All v1 requirements complete as of 2026-04-25.

### What This Is Now

A polished, complete-feeling wedding archive for Austin & Jordyn (theporadas.com) — all core features working, stable auth, performant gallery, and elegant design.

### Context Update

- MediaReviewPanel decomposed: 1716 → 325 lines
- Gallery state centralized in Zustand with sessionStorage caching
- Upload progress with XHR tracking and error differentiation
- All pages have skeleton loading states
- Gold theme consistently applied

## Current Milestone: v1.1 Polish & Feature Expansion

**Goal:** Expand moderation capabilities, improve gallery performance, add social features, and enhance PWA functionality

**Target features:**
- Moderation queue expansion (ADMIN-05, ADMIN-06, ADMIN-07)
- Gallery virtualization for 200+ photos (GALLERY-05)
- Guest reactions on guestbook (GALLERY-06)
- Featured content spotlight (GALLERY-07)
- Social sharing with OG tags (SOCIAL-01, SOCIAL-02)
- Upload resume with localStorage persistence (ADV-02)
- Guest upload status feedback (ADV-03)
- PWA offline verification (ADV-01)

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-25 after v1.0 milestone*
