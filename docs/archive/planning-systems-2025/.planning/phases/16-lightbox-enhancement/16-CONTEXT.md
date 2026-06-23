# Phase 16: Lightbox Enhancement - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can zoom, navigate, and view metadata on photos in the lightbox. Enhances existing PhotoLightbox component with pinch-to-zoom (1x-3x), double-tap toggle (1x/2x), swipe navigation with zoom-aware behavior, EXIF info panel, and download button.

**Specific scope (LB-01, LB-02, LB-03, LB-04):**
- Pinch-to-zoom on mobile with zoom range 1x to 3x
- Double-tap toggles between 1x and 2x zoom
- Swipe left/right navigates photos with proper threshold
- When zoomed > 1x, swipe pans instead of navigating
- Info panel shows date taken and camera info from EXIF (graceful fallback)
- Download button in lightbox toolbar

**Out of scope:** New capabilities — only lightbox enhancement as scoped in ROADMAP.md.

</domain>

<decisions>
## Implementation Decisions

### Zoom Behavior (LB-01)
- **D-01:** Pinch-to-zoom with scale range 1x to 3x
- **D-02:** Double-tap toggles between 1x and 2x zoom (not 3x)
- **D-03:** Zoom uses Framer Motion for smooth animation (300ms ease-out)
- **D-04:** Zoom state stored in PhotoLightbox local state (not global store)

### Swipe Navigation (LB-02)
- **D-05:** Swipe threshold: ~50px offset + velocity check
- **D-06:** When zoomed > 1x: swipe pans the image, does NOT navigate
- **D-07:** When zoomed = 1x: swipe navigates to next/previous photo

### EXIF Display (LB-03)
- **D-08:** Info panel slides in from right side (existing showInfo pattern)
- **D-09:** Shows: date taken, camera model, lens info if available
- **D-10:** Graceful fallback: if EXIF missing, show "No metadata available" text

### Download Button (LB-04)
- **D-11:** Download button in lightbox toolbar (top right area)
- **D-12:** Downloads current photo at high quality via existing onDownload prop

### Animation Standards (from prior phases)
- **D-13:** Transitions: 300ms ease-out (Phase 13/14 baseline)
- **D-14:** Micro-interactions: 150ms

### Design Tokens (from Phase 11)
- **D-15:** Gold accent: #d4af37
- **D-16:** Cream backgrounds: cream-50, cream-100
- **D-17:** Border radius: rounded-xl for cards, rounded-lg for buttons

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Definition
- `.planning/ROADMAP.md` — Phase 16 goal, requirements (LB-01, LB-02, LB-03, LB-04), success criteria
- `.planning/REQUIREMENTS.md` §LB — Lightbox enhancement requirements detail

### Prior Context
- `.planning/phases/15-activity-feed/15-CONTEXT.md` — Activity feed patterns, realtime approach
- `.planning/phases/14-accessibility-visual/14-CONTEXT.md` — Animation duration baseline (300ms)
- `.planning/phases/13-accessibility-motion/13-CONTEXT.md` — Animation standards
- `.planning/phases/11-design-token-unification/11-CONTEXT.md` — Gold brand color #d4af37, designTokens

### Existing Code
- `src/components/photo-viewer/PhotoLightbox.tsx` — Existing lightbox component to enhance
- `src/hooks/useTouchGestures.ts` — Touch gesture hook with onPinch callback already defined
- `src/tokens/designTokens.ts` — Color scale and CSS variables

</canonical_refs>

<specifics>
## Specific Ideas

- Existing `useTouchGestures` hook already has `onPinch` callback — wire it to PhotoLightbox zoom state
- PhotoLightbox already has `showInfo` state and zoom state — extend them
- Download button should match existing toolbar button style (Lucide icons, rounded-lg)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

---

*Phase: 16-lightbox-enhancement*
*Context gathered: 2026-04-30*