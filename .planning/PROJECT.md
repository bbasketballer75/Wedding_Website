# Wedding Website Overhaul

## What This Is

A post-wedding digital archive for Austin & Jordyn (theporadas.com) — a permanent home for engagement and wedding memories, accessible to extended guests and the local community. The site serves as a beautiful, elegant memory preservation platform where guests can upload photos, sign the guestbook, claim their photos, share album links, and relive the celebration.

**Core value:** Create a stunning, complete-feeling archive that guests and the couple will treasure for years — every interaction should feel polished and intentional.

## Core Value

Guests and the couple can browse, upload, and share wedding memories in a beautiful, elegant experience that feels finished and polished — not a work-in-progress. Self-service features let guests claim their photos, share their contributions, and order prints.

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
- ✓ UI/UX consistency — Design tokens unified, invalid Tailwind classes fixed, border radius/animation standardized — v2.0
- ✓ Activity Feed at /activity with realtime updates and filtering — v3.0
- ✓ Lightbox pinch-to-zoom (1x-3x), double-tap toggle, zoom-aware swipe, EXIF display — v3.0
- ✓ Multi-select download queue with sessionStorage persistence — v3.0
- ✓ Email-based photo claiming with magic link verification — v3.0
- ✓ Guest shared album links at /guest/:token — v3.0
- ✓ Order Prints button to Shutterfly/Artifact Uprising — v3.0

### Active

What we're building toward in next release.

- [ ] **Next milestone TBD** — Run `/gsd-new-milestone` to define v4.0 scope

### Out of Scope

Explicitly excluded — do not add these.

- RSVP or invitation management — This is a POST-wedding archive, not a planning site
- Wedding registry or gift management
- Save-the-date or pre-wedding announcements
- Chat or messaging between guests
- Email campaigns or newsletters
- Multiple event support (rehearsal dinner, brunch, etc. as separate sections)
- Face cluster claiming (SC-02) — deferred to post-launch; email claiming (SC-01) is functional

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
| Activity Feed first in v3.0 | Foundation for social layer, minimal dependencies | ✓ Achieved |
| Hybrid download (JSZip/Edge) | JSZip ≤20 photos, Edge Function >20 | ✓ Achieved — avoids memory issues |
| Supabase signInWithOtp() | Magic link without deprecated API | ✓ Achieved |
| Email enumeration protection | Same message regardless of email existence | ✓ Achieved — security best practice |
| Face cluster claiming deferred | SC-02 deferred to post-launch per D-16 | ⚠ Deferred — SC-01 is functional |

## Current State

**v3.0 Guest Experience Enhancements shipped** — All v3.0 requirements complete as of 2026-05-01.

### What This Is Now

A complete-feeling wedding archive with full social and self-service capabilities — activity feed with realtime updates, pinch-to-zoom lightbox, multi-select batch downloads, email-based photo claiming, shared album links, and print ordering. Guests can claim their photos, share their contributions, and enjoy a rich photo viewing experience.

### Context Update

- v1.0: MediaReviewPanel decomposed, gallery state centralized, upload progress, skeleton loading, gold theme
- v1.1: Social sharing with OG tags, guest heart reactions, gallery virtualization (200+ photos), moderation queue, PWA offline caching
- v2.0: Design token unification, invalid Tailwind classes fixed, border radius standardized to rounded-xl, animation durations at 300ms, CustomCursor respects prefers-reduced-motion, aria-labels on interactive elements, gold focus rings
- v3.0: Activity feed with realtime updates, lightbox enhancement (zoom, swipe, EXIF), download queue with batch download, email-based photo claiming, shared album links, print ordering redirect

## Current Milestone: v4.0 TBD

**Goal:** Run `/gsd-new-milestone` to define next milestone scope.

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
*Last updated: 2026-05-01 after v3.0 milestone*