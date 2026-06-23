# Phase 2: Gallery Performance & UX - Research

**Researched:** 2026-04-24
**Domain:** Gallery state management, progressive image loading, lightbox performance
**Confidence:** MEDIUM-HIGH

## Summary

Phase 2 requires centralizing gallery state in Zustand with sessionStorage caching, consolidating the fragmented Photo type definitions, implementing blur hash LQIP placeholders, and enhancing the lightbox with aggressive prefetching. The existing codebase has solid foundations: `OptimizedImage` already supports blur placeholders, `uiStore` demonstrates Zustand persist patterns, and `galleryStore` provides a base to build upon. However, `Gallery.tsx` currently uses local state instead of the store, and the PhotoLightbox is controlled via props rather than shared Zustand state. Key implementation challenges include handling sessionStorage hydration timing, implementing blur hash client-side fallback, and coordinating lightbox state across components.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Gallery cache uses sessionStorage persistence
- **D-02:** Blur hash placeholders for LQIP
- **D-03:** Aggressive prefetching (both next AND previous images)
- **D-04:** supabase.ts Photo type is canonical — planner should resolve which approach aligns with existing patterns

### Claude's Discretion
- Exact blur hash implementation strategy (client-side fallback if server doesn't provide)
- sessionStorage hydration timing and error handling
- Specific LRU cache size limits if sessionStorage proves insufficient

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GALLERY-01 | GalleryStore with caching — Centralized Zustand store with in-memory cache for Supabase responses | Zustand persist middleware pattern, sessionStorage error handling |
| GALLERY-02 | Photo type consolidation — Import Photo type from supabase.ts, remove duplicate local definitions in Gallery.tsx | Canonical type analysis, display wrapper pattern |
| GALLERY-03 | Lazy loading with LQIP — Low-quality image placeholders during load, progressive image loading | BlurHash library usage, OptimizedImage enhancement |
| GALLERY-04 | Lightbox performance — Shared lightbox state in Zustand, prefetch adjacent images | Lightbox architecture, prefetch strategy |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Gallery state management | Frontend Client (Zustand) | — | In-browser state, session-persistent |
| Photo data fetching | API (Supabase) | — | Database queries, network-bound |
| LQIP placeholder generation | API (server generates) | Frontend (fallback) | Blur hash computed on upload or client-side |
| Lightbox navigation | Frontend Client | — | User interaction, state-driven |
| Image prefetch | Frontend Client | — | Browser-level resource hinting |
| Blur hash decoding | Frontend Client | — | CPU-bound, runs in browser |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | 5.0.11 | State management | Lightweight, TypeScript-first, devtools support |
| blurhash | 2.0.5 | Blur hash encode/decode | Official Wolt library, 14 versions, well-maintained |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zustand/middleware | (bundled) | persist, subscribeWithSelector | Built into zustand |
| react-intersection-observer | 10.0.3 | Lazy loading triggers | Grid item visibility detection |

**Installation:**
```bash
npm install blurhash react-intersection-observer
```

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Gallery.tsx                              │
│  (fetches from Supabase, manages local state today)             │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   galleryStore (Zustand)                        │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │ images[]    │  │ lightbox     │  │ cache (in-memory)       │ │
│  │ filters     │  │ selectedIdx  │  │ + sessionStorage persist│ │
│  │ pagination  │  │ isOpen       │  │                         │ │
│  └─────────────┘  └──────────────┘  └─────────────────────────┘ │
└─────────────────────────┬───────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
   ┌────────────┐  ┌────────────┐  ┌────────────┐
   │PhotoGrid   │  │PhotoLightbox│  │PhotoItem   │
   │(renders)   │  │(shared     │  │(LQIP with  │
   │            │  │Zustand     │  │blur hash)  │
   │            │  │state)      │  │            │
   └────────────┘  └────────────┘  └────────────┘
                          │
                          ▼
               ┌─────────────────────┐
               │ Image Prefetch      │
               │ next + prev URLs    │
               └─────────────────────┘
```

### Recommended Project Structure
```
src/
├── stores/
│   └── galleryStore.ts        # Enhanced with sessionStorage cache + lightbox state
├── lib/
│   └── supabase.ts            # Photo type canonical definition
├── components/
│   ├── gallery/
│   │   ├── PhotoGrid.tsx       # Uses galleryStore.images
│   │   ├── components/
│   │   │   ├── PhotoItem.tsx   # Enhanced with LQIP blur placeholder
│   │   │   └── MasonryGrid.tsx # Unchanged
│   │   └── ProgressiveImage.tsx # NEW: blur hash rendering component
│   └── photo-viewer/
│       └── PhotoLightbox.tsx   # Enhanced to use shared Zustand state + prefetch
├── hooks/
│   └── useBlurHash.ts         # NEW: blur hash decode hook
└── pages/
    └── Gallery.tsx            # Refactored to use galleryStore instead of local state
```

### Pattern 1: Zustand sessionStorage Caching

**What:** Use Zustand persist middleware with sessionStorage to cache gallery responses.

**When to use:** When gallery data should survive page refresh but clear on tab close.

**Implementation approach:**
```typescript
// From uiStore.ts (existing pattern)
export const useGalleryStore = create<GalleryState>()(
  persist(
    (set, get) => ({
      // ... state and actions
    }),
    {
      name: 'gallery-store',
      storage: createJSONStorage(() => sessionStorage),
      partialize: state => ({ /* only cache serializable slices */ }),
    }
  )
)
```

**Key considerations:**
- sessionStorage can throw `QuotaExceededError` for large data — wrap in try-catch
- Only persist serializable state (images array, filters, pagination) — not derived state
- Hydration is async — use `useIsHydrated()` pattern or `useEffect` to handle SSR

### Pattern 2: Blur Hash LQIP

**What:** Show a 32x32 blur hash placeholder while full image loads, then fade in.

**When to use:** Every gallery image that loads lazily.

**Implementation approach:**
```typescript
// BlurHash decode + render as background
import { decode } from 'blurhash'

function useBlurHash(hash: string, width: number, height: number): string {
  const pixels = decode(hash, width, height)
  // Convert to canvas, then to data URL
  return canvas.toDataURL()
}
```

**UI-SPEC contract (from 02-UI-SPEC.md):**
- 20px blur with `scale(1.1)` to hide blur edges
- 300ms opacity fade from placeholder to full image
- `bg-charcoal-200` base for images without blurDataURL

### Pattern 3: Aggressive Lightbox Prefetch

**What:** Prefetch both next AND previous images when lightbox opens.

**When to use:** Lightbox navigation, especially for larger images.

**Implementation approach:**
```typescript
// In galleryStore or PhotoLightbox
const prefetchAdjacent = (currentIndex: number, images: Photo[]) => {
  const next = images[currentIndex + 1]
  const prev = images[currentIndex - 1]
  if (next) {
    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.href = next.url
    document.head.appendChild(link)
  }
  // ... same for prev
}
```

**Alternative: `new Image()` preloading:**
```typescript
const preloadImage = (url: string) => {
  const img = new Image()
  img.src = url
}
```

### Pattern 4: Type Consolidation

**What:** Use `Photo` from supabase.ts as canonical, wrap at display boundary.

**When to use:** When components need additional display-only properties beyond DB schema.

```typescript
// supabase.ts defines canonical Photo type
// Display components receive Photo and can extend with local-only fields

// Gallery.tsx display wrapper (if needed)
interface GalleryPhoto extends Photo {
  aspectRatio?: number
  blurHash?: string
}
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Blur hash decoding | Manual canvas pixel manipulation | blurhash library | Correct algorithm, tested |
| Image lazy loading | Custom IntersectionObserver | react-intersection-observer | Handles edge cases |
| State persistence | Manual sessionStorage read/write | Zustand persist middleware | Handles hydration, errors |
| Image prefetch | raw `new Image()` scattered | Prefetch utility function | Centralized, trackable |

## Common Pitfalls

### Pitfall 1: sessionStorage Hydration Mismatch
**What goes wrong:** Server renders with empty state, client hydrates with cached state, causes flicker or duplicate requests.
**Why it happens:** Zustand persist reads sessionStorage asynchronously after mount.
**How to avoid:**
```typescript
// Pattern from uiStore.ts
const [isHydrated, setIsHydrated] = useState(false)
useEffect(() => {
  // Zustand persist triggers re-render when hydrate complete
  setIsHydrated(true)
}, [])

// In component
if (!isHydrated) return <Skeleton />
```

### Pitfall 2: Large sessionStorage Writes Failing
**What goes wrong:** QuotaExceededError when caching many images.
**Why it happens:** sessionStorage limited to ~5MB, photos array can exceed this.
**How to avoid:**
- Cache metadata only (id, url, thumbnail, caption), not full images
- Use LRU eviction when cache grows beyond threshold
- Wrap persistence in try-catch, fallback to memory-only

### Pitfall 3: Photo Type Fragmentation
**What goes wrong:** Gallery.tsx defines local `Photo` interface different from supabase.ts and types/index.ts.
**Why it happens:** Historical evolution — Gallery.tsx grew its own types.
**How to avoid:**
- Import `Photo` from supabase.ts as canonical
- Add display-only properties via type extension at boundary
- Remove duplicate interface definitions

**Current type situation:**
| Location | Type | Status |
|----------|------|--------|
| src/lib/supabase.ts:50 | `Photo` | Canonical DB type |
| src/types/index.ts:15 | `GalleryImage` | Display wrapper (not used in Gallery.tsx) |
| src/pages/Gallery.tsx:44 | `Photo` | Local duplicate, needs consolidation |

### Pitfall 4: BlurHash Missing from Server
**What goes wrong:** No blurHash field in Supabase photos table.
**Why it happens:** Server-side generation not implemented.
**How to avoid:**
- Client-side fallback: generate low-res blur placeholder from thumbnail
- Mark as [ASSUMED] — needs verification

### Pitfall 5: Lightbox State Not Shared
**What goes wrong:** PhotoLightbox receives controlled props, can't be opened from multiple entry points.
**Why it happens:** Current architecture uses local state in Gallery.tsx.
**How to avoid:**
- Move lightbox state (selectedImageIndex, isModalOpen) to galleryStore
- PhotoLightbox subscribes to store, renders based on store state

## Code Examples

### BlurHash Decoding Hook
```typescript
// src/hooks/useBlurHash.ts
import { useState, useEffect } from 'react'
import { decode } from 'blurhash'

export function useBlurHash(
  hash: string | null,
  width = 32,
  height = 32
): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!hash) {
      setDataUrl(null)
      return
    }

    try {
      const pixels = decode(hash, width, height)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const imageData = ctx.createImageData(width, height)
      imageData.data.set(pixels)
      ctx.putImageData(imageData, 0, 0)

      setDataUrl(canvas.toDataURL())
    } catch {
      setDataUrl(null)
    }
  }, [hash, width, height])

  return dataUrl
}
```

### GalleryStore with sessionStorage Cache
```typescript
// src/stores/galleryStore.ts (enhancement)
import { create } from 'zustand'
import { devtools, subscribeWithSelector } from 'zustand/middleware'
import { persist, createJSONStorage } from 'zustand/middleware'

// Safe sessionStorage wrapper
const safeSessionStorage = {
  getItem: (name: string): string | null => {
    try {
      return sessionStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      sessionStorage.setItem(name, value)
    } catch {
      // Quota exceeded — clear oldest entries or skip
    }
  },
  removeItem: (name: string): void => {
    try {
      sessionStorage.removeItem(name)
    } catch {}
  },
}

export const useGalleryStore = create<GalleryState>()(
  devtools(
    subscribeWithSelector(
      persist(
        (set, get) => ({
          // ... existing state and actions
        }),
        {
          name: 'gallery-store',
          storage: createJSONStorage(() => safeSessionStorage),
          partialize: state => ({
            images: state.images,
            pagination: state.pagination,
            filters: state.filters,
            // Lightbox state
            lightboxIndex: state.selectedImageIndex,
            isLightboxOpen: state.isModalOpen,
          }),
        }
      )
    ),
    { name: 'gallery-store' }
  )
)
```

### Prefetch Adjacent Images
```typescript
// In PhotoLightbox or galleryStore
const prefetchAdjacentImages = (currentIndex: number, images: Photo[]) => {
  const toPrefetch = []

  if (currentIndex > 0) {
    toPrefetch.push(images[currentIndex - 1].url)
  }
  if (currentIndex < images.length - 1) {
    toPrefetch.push(images[currentIndex + 1].url)
  }

  toPrefetch.forEach(url => {
    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.as = 'image'
    link.href = url
    document.head.appendChild(link)

    // Alternative: new Image()
    const img = new Image()
    img.src = url
  })
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Gallery local state | Centralized Zustand store | Phase 2 | Consistent state across components |
| No placeholder | Blur hash LQIP | Phase 2 | Better perceived performance |
| Controlled lightbox | Shared Zustand lightbox state | Phase 2 | Opens from anywhere |
| No prefetch | Aggressive prefetch next+prev | Phase 2 | Smoother navigation |

**Deprecated/outdated:**
- Gallery.tsx local `Photo` interface: Should import from supabase.ts
- types/index.ts `GalleryImage`: Not used in Gallery.tsx, may be redundant

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Supabase `photos` table has no `blur_hash` column — client-side fallback needed | LQIP Approach | Would need DB migration to add column |
| A2 | sessionStorage quota is ~5MB — may need LRU eviction for large galleries | Caching Strategy | Users with many photos won't get caching benefits |
| A3 | BlurHash decode on main thread is fast enough for 20-30 visible images | LQIP Approach | May cause jank on lower-end devices — would need web workers |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

**NOTE:** A1, A2, A3 are [ASSUMED] — need verification before implementation.

## Open Questions

1. **Blur hash field in Supabase**
   - What we know: `photos` table exists, has `url`, `thumbnail`, `caption`, etc.
   - What's unclear: Whether `blur_hash` or similar column exists
   - Recommendation: Check Supabase schema for blur placeholder column

2. **sessionStorage size limits**
   - What we know: UI-SPEC requires caching, D-01 locks sessionStorage
   - What's unclear: How many photos can we cache before quota exceeded
   - Recommendation: Cache metadata only (id, url, thumbnail), not full Photo objects

3. **Lightbox integration point**
   - What we know: PhotoLightbox is controlled via props in Gallery.tsx
   - What's unclear: Whether other components need to open lightbox (People page?)
   - Recommendation: Move lightbox state to galleryStore, verify all consumers

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| zustand | State management | Yes | 5.0.11 | — |
| sessionStorage | Cache persistence | Yes | Browser native | localStorage fallback |
| blurhash | LQIP decode | No | — | Client-side generation from thumbnail |

**Missing dependencies with fallback:**
- blurhash: Not installed — install `npm install blurhash`, client-side fallback via thumbnail

**Missing dependencies with no fallback:**
- None identified — all required tools available or installable

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (existing project setup) |
| Config file | `vitest.config.ts` (existing) |
| Quick run command | `npm run test:run` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GALLERY-01 | GalleryStore caches to sessionStorage | unit | `vitest run src/stores/galleryStore.test.ts` | ❌ Wave 0 |
| GALLERY-01 | Cache survives page refresh | unit | `vitest run src/stores/galleryStore.test.ts` | ❌ Wave 0 |
| GALLERY-02 | Photo type imported from supabase.ts | type check | `npm run build` | ✅ |
| GALLERY-03 | Blur placeholder shows during load | unit | `vitest run src/components/gallery/*.test.tsx` | ❌ Wave 0 |
| GALLERY-03 | Progressive reveal animation 300ms | unit | `vitest run src/components/gallery/*.test.tsx` | ❌ Wave 0 |
| GALLERY-04 | Lightbox state from Zustand | unit | `vitest run src/stores/galleryStore.test.ts` | ❌ Wave 0 |
| GALLERY-04 | Adjacent images prefetched | unit | `vitest run src/components/photo-viewer/*.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test:run`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/stores/galleryStore.test.ts` — tests cache hydration, sessionStorage persistence
- [ ] `src/components/gallery/ProgressiveImage.test.tsx` — tests blur placeholder, fade animation
- [ ] `src/components/photo-viewer/PhotoLightbox.test.tsx` — tests Zustand state, prefetch behavior
- [ ] `src/hooks/useBlurHash.test.ts` — tests decode hook
- [ ] Framework install: `npm install --save-dev vitest @testing-library/react` — if none detected

## Security Domain

Not applicable — Phase 2 is UI/performance only, no authentication, authorization, or data validation changes.

## Sources

### Primary (HIGH confidence)
- src/stores/uiStore.ts — Zustand persist pattern with localStorage error handling
- src/lib/supabase.ts — Canonical Photo type definition (lines 50-67)
- src/components/ui/OptimizedImage.tsx — Existing blur placeholder implementation
- src/components/photo-viewer/PhotoLightbox.tsx — Lightbox architecture
- src/pages/Gallery.tsx — Gallery state management, Photo type duplication

### Secondary (MEDIUM confidence)
- [zustand persist docs] — sessionStorage middleware behavior
- [blurhash npm] — 2.0.5, MIT license, 14 versions

### Tertiary (LOW confidence)
- sessionStorage quota limits — varies by browser, not verified

---

**Confidence breakdown:**
- Standard stack: MEDIUM-HIGH — existing patterns verified, blurhash library confirmed
- Architecture: MEDIUM — UI-SPEC contract clear, implementation detail needs planning
- Pitfalls: MEDIUM — common patterns identified, sessionStorage edge cases need verification

**Research date:** 2026-04-24
**Valid until:** 2026-05-24 (30 days — stable domain)