# Phase 16: Lightbox Enhancement - Research

**Researched:** 2026-04-30
**Domain:** Mobile touch gestures, image zoom, EXIF metadata display
**Confidence:** HIGH

## Summary

Phase 16 enhances the existing `PhotoLightbox` component with pinch-to-zoom, double-tap zoom toggle, zoom-aware swipe navigation, EXIF metadata display, and download button. The key technical challenge is integrating the existing `useTouchGestures` hook's `onPinch` callback with PhotoLightbox's zoom state, and modifying the drag behavior to distinguish between navigation (when zoomed at 1x) and panning (when zoomed > 1x). EXIF extraction uses `exifr` (already installed at v7.1.3), and zoom animations use `framer-motion` (already at v12.38.0).

**Primary recommendation:** Wire `onPinch` from `useTouchGestures` to zoom state with 1x-3x clamping; modify drag handler to check zoom level before deciding to navigate or pan; use `exifr` for EXIF parsing; no new dependencies needed.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

| ID | Decision |
|----|----------|
| D-01 | Pinch-to-zoom with scale range 1x to 3x |
| D-02 | Double-tap toggles between 1x and 2x zoom (not 3x) |
| D-03 | Zoom uses Framer Motion for smooth animation (300ms ease-out) |
| D-04 | Zoom state stored in PhotoLightbox local state (not global store) |
| D-05 | Swipe threshold: ~50px offset + velocity check |
| D-06 | When zoomed > 1x: swipe pans the image, does NOT navigate |
| D-07 | When zoomed = 1x: swipe navigates to next/previous photo |
| D-08 | Info panel slides in from right side (existing showInfo pattern) |
| D-09 | Shows: date taken, camera model, lens info if available |
| D-10 | Graceful fallback: if EXIF missing, show "No metadata available" text |
| D-11 | Download button in lightbox toolbar (top right area) |
| D-12 | Downloads current photo at high quality via existing onDownload prop |
| D-13 | Transitions: 300ms ease-out |
| D-14 | Micro-interactions: 150ms |
| D-15 | Gold accent: #d4af37 |
| D-16 | Cream backgrounds: cream-50, cream-100 |
| D-17 | Border radius: rounded-xl for cards, rounded-lg for buttons |

### Out of Scope

None — discussion stayed within phase scope.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Pinch-to-zoom gesture | Browser/Client | — | Touch gesture detection, zoom state in React component |
| Double-tap zoom toggle | Browser/Client | — | Touch gesture detection, local state toggle |
| Swipe navigation/pan | Browser/Client | — | Framer Motion drag, zoom-aware behavior |
| EXIF extraction | Browser/Client | — | `exifr` library runs client-side on image load |
| Download initiation | Browser/Client | — | Triggers via existing `onDownload` prop |
| Metadata display | Browser/Client | — | Info panel already exists, add EXIF fields |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `exifr` | 7.1.3 | EXIF metadata extraction | [VERIFIED: npm registry] Already installed in project |
| `framer-motion` | 12.38.0 | Smooth zoom animation | [VERIFIED: npm registry] Already installed, used for all animations |
| `useTouchGestures` | existing | Touch gesture detection | Custom hook already in `src/hooks/useTouchGestures.ts` |

### No New Dependencies Required

All required libraries are already installed. No npm packages need to be added for this phase.

---

## Architecture Patterns

### System Architecture Diagram

```
User Touch Input (PhotoLightbox container)
         |
         v
+------------------+
| useTouchGestures|  ---> Detects pinch, swipe, double-tap
|    hook         |        (already has onPinch callback)
+------------------+
         |
         v
   [Zoom State]  <-- local useState in PhotoLightbox
   [1x to 3x]         |
         |            v
         |   +------------------+
         |   | Framer Motion    | ---> animate={{ scale: zoom }}
         |   | scale transform |     transition={{ duration: 0.3 }}
         |   +------------------+
         |            |
         v            v
   [Image Display] <-- Scaled img element

Swipe Navigation Logic:
  - zoom === 1: drag -> navigate (next/prev photo)
  - zoom > 1: drag -> pan image (no navigation)
  - Implemented in existing drag="x" onDragEnd handler
```

### Recommended Project Structure

No new files required. All changes in existing file:
- `src/components/photo-viewer/PhotoLightbox.tsx` — main implementation
- `src/hooks/useTouchGestures.ts` — no changes needed (already has onPinch)

### Pattern 1: Touch Gesture to Zoom State

**What:** Pinch gesture from `useTouchGestures` updates PhotoLightbox zoom state

**When to use:** Mobile zoom interaction

**Implementation approach:**
```typescript
// In PhotoLightbox, wire onPinch to setZoom
useEffect(() => {
  if (!lightboxRef.current) return

  const gestures = useTouchGestures(lightboxRef, {
    onPinch: (scale: number, e: TouchEvent) => {
      // scale is relative to last pinch, need cumulative zoom
      // Approach: maintain a base zoom and multiply
      setZoom(prev => Math.min(Math.max(prev * scale, 1), 3))
    }
  })
}, [lightboxRef])
```

### Pattern 2: Zoom-Aware Drag Navigation

**What:** Modify existing drag="x" handler to check zoom level

**When to use:** Swipe left/right navigation vs pan when zoomed

**Implementation approach (existing code at lines 246-252):**
```typescript
// Current implementation (lines 246-252):
drag="x"
dragConstraints={{ left: 0, right: 0 }}
dragElastic={0.12}
onDragEnd={(_, info) => {
  if (info.offset.x < -50 && info.velocity.x < -80) handleNext()
  else if (info.offset.x > 50 && info.velocity.x > 80) handlePrevious()
}}

// Modified: only navigate when zoom === 1
onDragEnd={(_, info) => {
  if (zoom > 1) return // pan only, no navigation
  if (info.offset.x < -50 && info.velocity.x < -80) handleNext()
  else if (info.offset.x > 50 && info.velocity.x > 80) handlePrevious()
}}
```

### Pattern 3: Double-Tap Zoom Toggle

**What:** Detecting double-tap and toggling between 1x and 2x

**Implementation approach:**
- `useTouchGestures` hook does not have double-tap detection
- Add local double-tap detection directly in PhotoLightbox:
```typescript
// In PhotoLightbox
const lastTapTime = useRef<number>(0)
const handleDoubleTap = (e: TouchEvent) => {
  const now = Date.now()
  if (now - lastTapTime.current < 300) {
    setZoom(prev => prev === 1 ? 2 : 1)
    lastTapTime.current = 0
  } else {
    lastTapTime.current = now
  }
}
```

### Anti-Patterns to Avoid

- **Global zoom state:** D-04 explicitly forbids global store for zoom — keep in PhotoLightbox local state
- **3x on double-tap:** D-02 specifies double-tap toggles 1x/2x only, not 3x
- **Navigation when zoomed:** D-06 is clear — swipe should pan when zoomed > 1x
- **Blocking swipe entirely when zoomed:** Should pan, not prevent all drag

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| EXIF parsing | Custom regex on JPEG binary | `exifr` | Handles all EXIF formats, edge cases, already installed |
| Zoom animation | CSS transitions or setTimeout | Framer Motion | Already used for all animations in project, consistent API |
| Touch gesture math | Manual pinch distance calculation | `useTouchGestures` hook | Already calculates scale from touch coordinates |

---

## Common Pitfalls

### Pitfall 1: Pinch Scale Accumulation

**What goes wrong:** Pinch scale from `onPinch` is relative to last pinch call, not absolute. Multiplying cumulatively causes zoom to jump unexpectedly on rapid pinches.

**Why it happens:** `onPinch(scale)` returns a ratio like 1.1 (10% larger), not an absolute scale. These multiply against current zoom.

**How to avoid:** Clamp after each update: `Math.min(Math.max(newZoom, 1), 3)` to prevent overflow/underflow.

**Warning signs:** Zoom jumps to 5x or drops below 1x on fast pinch.

### Pitfall 2: Drag Navigation Fires When Zoomed

**What goes wrong:** Existing `onDragEnd` navigation logic runs even when zoom > 1x, causing photo to change while user is trying to pan.

**Why it happens:** The drag handler at line 246-252 does not check zoom level before navigating.

**How to avoid:** Add `if (zoom > 1) return` at start of `onDragEnd` to prevent navigation when zoomed.

**Warning signs:** Photo changes while user is trying to pan around a zoomed image.

### Pitfall 3: EXIF Extraction on Large Images

**What goes wrong:** EXIF extraction blocks UI thread on very large images.

**Why it happens:** `exifr` parses the binary image data. Large images take longer.

**How to avoid:** Parse EXIF in a `useEffect` with a small debounce, or use web workers if performance is problematic. For typical wedding photos (< 20MB), this is unlikely to be an issue.

**Warning signs:** Lightbox feels sluggish when opening new photos.

### Pitfall 4: Missing Double-Tap Detection

**What goes wrong:** `useTouchGestures` does not have a built-in double-tap callback — only `onPinch`, `onSwipe*`, and `onLongPress`.

**Why it happens:** Hook was designed for swipe and pinch, not double-tap.

**How to avoid:** Implement double-tap detection manually in PhotoLightbox using `useRef` to track `lastTapTime`.

**Warning signs:** Double-tap does nothing or triggers other gestures.

### Pitfall 5: Resetting Zoom on Photo Navigation

**What goes wrong:** User zooms to 2x, swipes to next photo, zoom persists at 2x on the new photo.

**How to avoid:** The existing code already handles this — `handleNext()` and `handlePrevious()` both call `setZoom(1)` (lines 89, 97). This is correct behavior per LB-01 success criteria: "Zoom persists when swiping to next/previous photo (resets to 1x)."

**Warning signs:** Zoom does not reset when navigating.

---

## Code Examples

### EXIF Extraction Pattern (LB-03)

```typescript
// Source: exifr documentation — https://github.com/MikeKovarik/exifr
import exifr from 'exifr'

// In PhotoLightbox, on photo change:
useEffect(() => {
  if (!currentPhoto?.url) return

  const parseExif = async () => {
    try {
      const exif = await exifr.parse(currentPhoto.url, {
        pick: ['DateTimeOriginal', 'Make', 'Model', 'LensModel']
      })
      if (exif) {
        setPhotoMetadata({
          dateTaken: exif.DateTimeOriginal,
          camera: exif.Make && exif.Model ? `${exif.Make} ${exif.Model}` : null,
          lens: exif.LensModel || null,
        })
      }
    } catch (err) {
      // Graceful fallback — metadata unavailable
      setPhotoMetadata(null)
    }
  }

  parseExif()
}, [currentPhoto?.id])

// Display in info panel:
{metadata?.camera && (
  <div className="flex items-center gap-2 text-charcoal-500 text-sm">
    <Camera className="w-4 h-4 text-gold-500" />
    <span>{metadata.camera}</span>
  </div>
)}
```

### Zoom-Aware Swipe Navigation (LB-02)

```typescript
// From existing PhotoLightbox lines 246-252, modified:
<motion.div
  drag="x"
  dragConstraints={{ left: 0, right: 0 }}
  dragElastic={0.12}
  onDragEnd={(_, info) => {
    // D-06: When zoomed > 1x, swipe pans, does NOT navigate
    if (zoom > 1) return

    // D-05: ~50px offset + velocity check
    if (info.offset.x < -50 && info.velocity.x < -80) {
      handleNext()
    } else if (info.offset.x > 50 && info.velocity.x > 80) {
      handlePrevious()
    }
  }}
>
```

### Double-Tap Zoom Toggle (LB-01)

```typescript
// In PhotoLightbox — double tap detection:
const lastTapRef = useRef<number>(0)

const handleImageTap = (e: React.TouchEvent) => {
  const now = Date.now()
  const timeSinceLastTap = now - lastTapRef.current

  if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
    // Double tap — D-02: toggle between 1x and 2x (not 3x)
    setZoom(prev => prev === 1 ? 2 : 1)
    lastTapRef.current = 0
  } else {
    lastTapRef.current = now
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No zoom | Pinch-to-zoom with framer-motion scale | Phase 16 | Mobile UX improvement |
| Click navigation arrows only | Swipe navigation + zoom-aware behavior | Phase 16 | Natural touch interaction |
| No EXIF | EXIF display with exifr library | Phase 16 | Photo context for users |
| Download via bottom toolbar | Download button in top toolbar | Phase 16 | Easier access, cleaner UI |

**No deprecated patterns in this phase scope.**

---

## Assumptions Log

All claims in this research were verified against existing code, npm registry, or official documentation. No assumptions were made that require user confirmation.

---

## Open Questions

1. **Double-tap vs single-tap on image**
   - The image element already has `onClick` for potential interactions
   - Need to ensure double-tap detection doesn't interfere with existing click handlers
   - Recommendation: Use `onTouchEnd` for double-tap, not `onClick`, since `onClick` has delay

2. **EXIF `photo_metadata` column vs runtime parsing**
   - LB-03 requirements mention `photo_metadata` JSONB column to populate on upload
   - This would require a database migration and batch update of existing photos
   - For Phase 16, runtime EXIF parsing (on photo open) is sufficient
   - Database population can be done as a separate data migration task if needed

3. **Download button placement**
   - D-11 says "in lightbox toolbar (top right area)"
   - Existing code has Download in bottom toolbar (lines 359-372)
   - Need to clarify: add to top toolbar only, or move entirely?
   - Recommendation: Add to top-right toolbar alongside existing ZoomIn/ZoomOut buttons, keep bottom Download for discoverability

---

## Environment Availability

> Step 2.6: SKIPPED — no external dependencies beyond project code.

This phase modifies only existing files in the project. No external tools, services, or runtimes are required beyond what is already in the project.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | `vitest.config.js` |
| Quick run command | `npm run test` (or `npm run test:run` for CI) |
| Full suite command | `npm run test:run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LB-01 | Pinch-to-zoom changes zoom state | unit | `vitest src/components/photo-viewer/PhotoLightbox --run` | No — needs creation |
| LB-01 | Double-tap toggles 1x/2x | unit | `vitest src/components/photo-viewer/PhotoLightbox --run` | No — needs creation |
| LB-02 | Swipe navigates when zoom=1 | unit | `vitest src/components/photo-viewer/PhotoLightbox --run` | No — needs creation |
| LB-02 | Swipe pans when zoom>1 | unit | `vitest src/components/photo-viewer/PhotoLightbox --run` | No — needs creation |
| LB-03 | EXIF data displays in info panel | unit | `vitest src/components/photo-viewer/PhotoLightbox --run` | No — needs creation |
| LB-04 | Download button triggers onDownload | unit | `vitest src/components/photo-viewer/PhotoLightbox --run` | No — needs creation |

### Sampling Rate
- **Per task commit:** `npm run test -- --run` (fast subset)
- **Per wave merge:** `npm run test:run` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/components/photo-viewer/PhotoLightbox.test.tsx` — covers LB-01 through LB-04
- [ ] `src/setupTests.jsx` — shared test setup (likely exists, verify)
- [ ] Framework install: Vitest already configured in `vitest.config.js` — no install needed

*(If no gaps: "None — existing test infrastructure covers all phase requirements")*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | No | Not applicable — no user input in this phase |
| V4 Access Control | No | Read-only enhancements to existing functionality |

**Security notes:**
- EXIF parsing runs entirely client-side — no server exposure
- Download URLs use existing signed URL pattern — no new security concerns
- No user input is collected or processed

---

## Sources

### Primary (HIGH confidence)
- `exifr` npm registry — verified v7.1.3 installed
- `framer-motion` npm registry — verified v12.38.0 installed
- `src/components/photo-viewer/PhotoLightbox.tsx` — existing component to enhance
- `src/hooks/useTouchGestures.ts` — existing hook with onPinch callback

### Secondary (MEDIUM confidence)
- exifr GitHub documentation — https://github.com/MikeKovarik/exifr

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified via npm registry
- Architecture: HIGH — all patterns verified against existing code
- Pitfalls: HIGH — identified from existing code analysis

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (stable phase, no fast-moving dependencies)