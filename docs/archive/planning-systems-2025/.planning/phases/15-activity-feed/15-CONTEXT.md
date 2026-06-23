# Phase 15: Activity Feed - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can view a chronological feed of recent site activity at `/activity` — showing approved guest photo uploads, guestbook messages, and featured moments with realtime updates and filtering. Feed is paginated (20 items/page) with infinite scroll.

**Specific scope (SOC-01, SOC-02, SOC-03):**
- Activity feed page at `/activity` with chronological listing
- Feed aggregates: guest_uploads (status='approved'), guestbook_messages, site_editorial_features
- Supabase Realtime subscription — new activity appears without refresh
- "X new activity" banner — click prepends items without scrolling
- Filter toggles (All / Photos / Guestbook / Moments) — client-side, session-persistent
- Infinite scroll with Load More button (20 items/page)
- Each entry: type icon, contributor name, thumbnail (for photos), timestamp
- Feed types: photo_upload, guestbook_entry, featured_moment
- Empty state: "Be the first to contribute" prompt with upload + guestbook links

**Out of scope:** New capabilities — only the activity feed as scoped in ROADMAP.md.

</domain>

<decisions>
## Implementation Decisions

### Activity Card Layout
- **D-01:** Thumbnail on left, info (name + type + time) on right — compact, image-forward
- **D-02:** Card background: cream/white gradient (matches GuestHighlightReel warm style)
- **D-03:** Thumbnail size: small square (like GuestHighlightReel — 4/3 or square aspect)

### Realtime Subscription Strategy
- **D-04:** Single `activity_log` channel — one unified channel for all activity types
- **D-05:** "X new activity" banner — click prepends new items to top without scrolling

### Pagination & Filtering
- **D-06:** Load all activity on mount, filter client-side — fast filtering, more initial data
- **D-07:** Auto-infinite scroll — automatically loads more as user scrolls

### Empty State
- **D-08:** "Be the first to contribute" prompt — friendly message with links to upload and guestbook

### Feed Data Sources (from ROADMAP.md SOC-01)
- **D-09:** Feed aggregates from: guest_uploads (status='approved'), guestbook_messages, site_editorial_features
- **D-10:** Chronological order: created_at DESC
- **D-11:** Pagination: 20 items per page

### Filter Behavior (from ROADMAP.md SOC-03)
- **D-12:** Filter toggles: All | Photos | Guestbook | Moments
- **D-13:** Active filter persists during session (client-side)
- **D-14:** No additional fetch needed for filtering

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Definition
- `.planning/ROADMAP.md` — Phase 15 goal, requirements (SOC-01, SOC-02, SOC-03), success criteria
- `.planning/REQUIREMENTS.md` §SOC — Activity feed requirements detail

### Prior Context
- `.planning/phases/14-accessibility-visual/14-CONTEXT.md` — Animation duration baseline (300ms transitions)
- `.planning/phases/13-accessibility-motion/13-CONTEXT.md` — Animation baseline durations
- `.planning/phases/11-design-token-unification/11-CONTEXT.md` — Gold brand color #d4af37, designTokens alignment

### Existing Code Patterns
- `src/components/sections/GuestHighlightReel.tsx` — Card layout reference (thumbnail left, gradient background, rounded-2xl)
- `src/lib/supabase.ts` — Supabase client setup with realtime config (params.eventsPerSecond: 10)
- `src/stores/` — Zustand stores for state management reference

### Design Tokens
- `src/tokens/designTokens.ts` — Gold color scale (#d4af37), CSS variable mappings
- `src/index.css` — Global CSS and Tailwind theme integration

### Animation Standards
- Transitions: 300ms (from Phase 13/14 baseline)
- Micro-interactions: 150ms
- Complex animations: 500ms+

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `GuestHighlightReel.tsx` — Card layout pattern: thumbnail left, warm gradient background, rounded-2xl, link to gallery
- `supabase.ts` — Realtime config already set: `params.eventsPerSecond: 10`
- `GuestbookMessage` and `GuestUpload` types already defined in `supabase.ts`
- `Photo` type already defined with thumbnail field

### Established Patterns
- Zustand stores for state management (galleryStore, uiStore, authStore)
- Framer Motion for animations
- Supabase Realtime subscription pattern (used in existing code)
- Design tokens via CSS variables

### Integration Points
- New `/activity` route via React Router lazy loading
- New `ActivityFeedPage` component
- Supabase realtime channels for activity updates
- sessionStorage persistence for filter state

</code_context>

<specifics>
## Specific Ideas

- Card style should feel warm and on-brand — like a highlight reel from guests
- Activity feed is the social foundation for v3.0 — should feel alive when new content arrives
- "Be the first" empty state encourages contribution rather than just saying "nothing here"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

---

*Phase: 15-activity-feed*
*Context gathered: 2026-04-29*
