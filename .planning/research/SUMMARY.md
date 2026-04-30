# Project Research Summary

**Project:** Wedding Website v3.0 — Guest Experience Enhancements
**Domain:** Wedding photo archive guest experience layer
**Researched:** 2026-04-29
**Confidence:** MEDIUM

## Executive Summary

The v3.0 features (social round 2, guest self-service, lightbox enhancement) require minimal new infrastructure — only 1 new npm package (react-zoom-pan-pinch) and moderate Supabase schema changes. All features build on existing infrastructure (Supabase Realtime, Auth, Storage, JSZip). The core work is orchestration: new Zustand stores, new pages, wiring existing capabilities together.

The key constraint is **print ordering**: no photo book API exists for the major providers (Printful has no photo books via API, Shutterfly API is not publicly available). The recommended approach is external redirect to Artifact Uprising or Shutterfly — no internal payment/fulfillment complexity.

**Key risks:** Activity feed can explode in volume as guests upload. Large batch downloads hit client-side memory limits. Photo claiming requires careful identity verification to avoid privacy issues.

## Key Findings

### Recommended Stack

**Core technologies unchanged** — React 19 + Supabase + Zustand + Framer Motion + Tailwind CSS v4 already handle all v3.0 requirements.

**Only 1 new package needed:**
- `react-zoom-pan-pinch` 3.1.10 — lightbox zoom/swipe gestures (React 19 compatible)

**Existing packages covering needs:**
- JSZip 3.10.1 (already installed) — batch download zip generation
- exifr 7.1.3 (already installed) — EXIF parsing for lightbox info display
- Supabase Realtime (already configured) — activity feed subscriptions

**Print ordering:** External redirect only. No API integration. Link to Shutterfly/Artifact Uprising, let them handle payment/fulfillment.

### Expected Features

**P1 — Must have (table stakes):**
- Activity Feed — chronological aggregation of uploads, guestbook, featured moments
- Lightbox Pinch-to-Zoom — wire existing `useTouchGestures` `onPinch` to `setZoom` (existing hook, not wired)
- Download Queue — multi-select gallery photos, batch signed URL generation, progress indicator
- Guest Upload Status Enhancement — make status check more prominent

**P2 — Should have (differentiators):**
- Photo Claiming — guests claim photos they're in via face cluster linking
- Shared Album Links — per-guest view of contributions with shareable link
- EXIF Display — extract date, camera, location from photo metadata
- Activity Feed Filtering — toggle All/Photos/Guestbook/Moments

**P3 — Nice to have (defer):**
- Print/Photo Book Ordering — third-party integration, high complexity
- Comment Threading — nested replies, schema + UI changes

### Architecture Approach

All features extend existing patterns:

- **Activity Feed:** New `activity_log` table + Realtime subscription in new `activityStore`. Wires into existing `guest_uploads` approval flow.
- **Photo Claiming:** Email-based identity via existing `guest_email` field. New `guest_identities` + `photo_claims` tables link uploads to face clusters.
- **Downloads:** Extend `downloadStore`, reuse signed URL pattern from `supabase.ts` line 772-779. Client-side JSZip for small batches.
- **Lightbox:** Wrap existing `PhotoLightbox` with `TransformComponent` from react-zoom-pan-pinch. Keep face tag overlay working.
- **Print:** Redirect to external provider — no Supabase involvement after link generation.

**Build order:** Activity Feed → Photo Claiming → Downloads → Lightbox Enhancement → Print (lowest priority)

### Critical Pitfalls

1. **Activity feed explosion** — Each guest upload generates multiple activity entries. Prune activity older than 90 days. Realtime subscriptions work for 0-1k users; pagination needed at scale.
2. **Large batch download memory** — Client-side JSZip hits memory limits around 50 photos. Edge Function zip for large batches (>20 photos recommended threshold).
3. **Photo claiming identity fraud** — Email verification must be robust. Use Supabase Magic Link, not just form submission. Link claims to session for continuity.
4. **Pinch-to-zoom not wired** — `useTouchGestures` has `onPinch` callback but PhotoLightbox doesn't wire it to `setZoom`. 10-line fix that's been missing since hook was added.
5. **Print ordering anti-pattern** — Don't build e-commerce. External redirect only. Building payment/fulfillment would dwarf the value.

## Implications for Roadmap

### Phase 1: Activity Feed Foundation
**Rationale:** Lowest dependency, uses existing Supabase Realtime already configured.
**Delivers:** `activity_log` table, `activityStore`, `ActivityFeed` page, guest upload approval wiring
**Addresses:** SOC-01, SOC-02 (P1 table stakes)
**Avoids:** Realtime polling anti-pattern — use subscriptions, not polling

### Phase 2: Lightbox Enhancement
**Rationale:** Single npm package, isolated change, visible improvement (pinch-to-zoom)
**Delivers:** `react-zoom-pan-pinch` integration, zoom-to-pinch wiring, EXIF display, swipe navigation refinement
**Addresses:** LB-01, LB-02, LB-03 (low complexity, high impact)
**Avoids:** `useTouchGestures` `onPinch` left unwired — the hook exists but wasn't connected

### Phase 3: Download Management
**Rationale:** Reuses existing signed URL pattern, adds queue orchestration
**Delivers:** `downloadStore`, multi-select batch download, progress UI, Edge Function for large batches
**Addresses:** DL-01, DL-02 (medium complexity)
**Avoids:** Blocking download UI during large batch — streaming approach for >20 photos

### Phase 4: Photo Claiming
**Rationale:** Depends on guest identity infrastructure, admin moderation
**Delivers:** `guest_identities` + `photo_claims` tables, `claimStore`, `PhotoClaimModal`, claim flow UI
**Addresses:** SC-01, SC-02 (medium complexity)
**Avoids:** Identity fraud — robust email verification via Supabase Magic Link

### Phase 5: Shared Album Links + Print
**Rationale:** Independent of other phases, lower priority
**Delivers:** Per-guest shareable link, print redirect integration
**Addresses:** SC-03, SC-04
**Print ordering:** External redirect, no API complexity

### Phase Ordering Rationale

1. **Activity Feed first:** Foundation for social layer. Minimal dependencies, uses existing infrastructure.
2. **Lightbox second:** Single package, isolated change. Quick win that makes mobile browsing significantly better.
3. **Downloads third:** Uses existing signed URL pattern. Clear UI improvement with batch download queue.
4. **Photo Claiming fourth:** Requires identity verification + face cluster linking. More complex.
5. **Shared/Print last:** Lower priority, can be parallel work.

### Research Flags

- **Phase 4 (Photo Claiming):** Face cluster linking needs validation — verify `media_review_faces` + `guest_uploads` join works as expected
- **Phase 5 (Print):** Vendor selection (Shutterfly vs Artifact Uprising) depends on couple preference — needs decision, not research

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | react-zoom-pan-pinch npm verified, JSZip/exifr already in project |
| Features | MEDIUM | Based on codebase analysis + standard patterns; web search unavailable |
| Architecture | HIGH | Existing patterns well-understood from codebase |
| Pitfalls | MEDIUM | Known patterns from codebase, limited external validation |

**Overall confidence:** MEDIUM — research is solid but Context7 was unavailable for some library verification.

### Gaps to Address

- **Face cluster linking validation:** During Phase 4 planning, verify the join between `guest_uploads` and `media_review_faces` works as described
- **Print vendor preference:** Artifact Uprising vs Shutterfly — couple decides, not a technical question
- **Edge Function memory limit:** 150MB limit for large batch zip — streaming approach vs. client-side for >50 photos needs decision during Phase 3

## Sources

### Primary (HIGH confidence)
- react-zoom-pan-pinch npm — version 3.1.10, React 19 peer deps confirmed
- JSZip npm — version 3.10.1, already in project
- package.json dependencies — current installed versions verified
- PhotoLightbox.tsx — current zoom implementation, `useTouchGestures` hook location
- supabase.ts — signed URL pattern at line 772-779

### Secondary (MEDIUM confidence)
- Supabase Realtime documentation — postgres_changes subscription pattern
- Architecture docs from `.planning/codebase/ARCHITECTURE.md`
- Existing Photo type with `photo_faces`, `GuestUpload` type with `guest_email`

### Tertiary (LOW confidence)
- Print provider API availability (Printful photo book confirmation via API docs) — confirmed no photo books via API, external link is recommendation

---
*Research completed: 2026-04-29*
*Ready for roadmap: yes*