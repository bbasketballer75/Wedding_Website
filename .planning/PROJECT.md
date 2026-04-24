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

### Active

What we're building toward in this overhaul.

- [ ] **Polished, intuitive navigation** — Menu that feels complete, smooth transitions, clear wayfinding
- [ ] **Admin panel for guest content moderation** — Clean interface to approve/reject uploads, manage guestbook, feature content
- [ ] **Consistent, elegant UI/UX** — Every page feels polished, cohesive design language throughout
- [ ] **Gallery performance & UX** — Fast loading, smooth scrolling, proper caching, lightbox that flows
- [ ] **Fully wired features** — No broken links, dead ends, or "coming soon" placeholders
- [ ] **Reliable upload experience** — Progress indication, error handling, confirmation feedback
- [ ] **Admin error boundaries** — Graceful error handling on all admin pages

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
- MediaReviewPanel.tsx is 900+ lines — hard to maintain
- Gallery state held in component state vs Zustand
- Photo type duplication between Gallery.tsx and supabase.ts
- Auth has race conditions between initializeAuth and refreshSession
- Admin pages lack error boundaries
- Gallery makes parallel Supabase calls with no caching
- No upload progress persistence
- Console.log throughout production code

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
| Post-wedding only | Explicit user requirement | — Pending |
| Build on existing codebase | User said "don't wipe what we have" | — Pending |
| Open to suggestions | User invited additions | — Pending |
| Prioritize polish over new features | "Feels incomplete" is main pain point | — Pending |

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
*Last updated: 2026-04-23 after initialization*
