# Phase 2: Gallery Performance & UX - Pattern Map

**Mapped:** 2026-04-24
**Files analyzed:** 11
**Analogs found:** 9 / 11

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/stores/galleryStore.ts` | store | CRUD + cache | `src/stores/uiStore.ts` | exact |
| `src/pages/Gallery.tsx` | page | request-response | `src/pages/Gallery.tsx` (self) | exact (type refactor) |
| `src/components/gallery/PhotoGrid.tsx` | component | CRUD | `src/components/gallery/PhotoGrid.tsx` (self) | exact (enhancement) |
| `src/components/gallery/components/PhotoItem.tsx` | component | CRUD | `src/components/gallery/components/PhotoItem.tsx` (self) | exact (enhancement) |
| `src/components/photo-viewer/PhotoLightbox.tsx` | component | request-response | `src/components/photo-viewer/PhotoLightbox.tsx` (self) | exact (state refactor) |
| `src/hooks/useBlurHash.ts` | hook | transform | none | no-analog |
| `src/components/gallery/ProgressiveImage.tsx` | component | CRUD | `src/components/ui/OptimizedImage.tsx` | role-match |
| `src/stores/galleryStore.test.ts` | test | unit | `src/utils/storage.test.ts` | partial |
| `src/hooks/useBlurHash.test.ts` | test | unit | none | no-analog |
| `src/components/gallery/ProgressiveImage.test.tsx` | test | unit | none | no-analog |
| `src/components/photo-viewer/PhotoLightbox.test.tsx` | test | unit | none | no-analog |

## Pattern Assignments

### `src/stores/galleryStore.ts` (store, CRUD + sessionStorage cache)

**Analog:** `src/stores/uiStore.ts` (lines 44-113)

**Imports pattern** (lines 1-3):
```typescript
import { create } from 'zustand'
import { devtools, subscribeWithSelector } from 'zustand/middleware'
import { persist, createJSONStorage } from 'zustand/middleware'
```

**Persist middleware pattern** (lines 45-113 in uiStore):
```typescript
export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      // ... state and actions
    }),
    {
      name: 'ui-store',
      partialize: state => ({
        currentTheme: state.currentTheme,
        preferences: state.preferences,
      }),
    }
  )
)
```

**sessionStorage safe wrapper** (from RESEARCH.md lines 334-354):
```typescript
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
      // Quota exceeded - clear oldest entries or skip
    }
  },
  removeItem: (name: string): void => {
    try {
      sessionStorage.removeItem(name)
    } catch {}
  },
}
```

**Key enhancements needed:**
1. Add `persist` + `createJSONStorage(() => safeSessionStorage)` middleware
2. Add lightbox state (`selectedImageIndex`, `isModalOpen`) to store
3. Add `partialize` to only cache serializable slices (images, pagination, filters, lightbox state)
4. Add cache invalidation on fetch actions

---

### `src/pages/Gallery.tsx` (page, request-response)

**Analog:** `src/pages/Gallery.tsx` (self - type refactor only)

**Type consolidation pattern** (D-04 decision):
- Current: Local `Photo` interface at lines 44-79 duplicates `Photo` from `src/lib/supabase.ts`
- Target: Import `Photo` from `src/lib/supabase.ts` (line 22 already imports `Photo as SupabasePhoto`)

**Photo type from supabase.ts** (lines 50-67):
```typescript
export interface Photo {
  id: string
  url: string
  thumbnail: string
  download_url?: string | null
  album?: string
  album_sort_order?: number | null
  caption?: string
  category?: string
  location?: string
  date?: string
  likes: number
  photographer?: string
  is_professional: boolean
  tags: string[]
  faces: PhotoFace[]
  created_at: string
}
```

**Current duplicate in Gallery.tsx** (lines 44-79):
```typescript
interface Photo {
  id: string
  url: string
  thumbnail: string
  downloadUrl?: string
  album?: string
  albumSortOrder?: number
  caption?: string
  category: string
  likes: number
  aspectRatio: number
  time?: string
  photographer?: string
  faces?: Array<{...}>
  tags?: string[]
  location?: string
  date?: string
  comments?: Array<...>
  commentCount?: number
  createdAt?: string
  liked?: boolean
  likeCount?: number
  source: 'professional' | 'guest'
  collection: 'Proposal' | 'Bach+ette' | 'Wedding Photos' | 'Guest Photos'
}
```

**Refactor approach:**
1. Keep local `Photo` interface for display-only extensions (aspectRatio, source, collection, comments)
2. Extend `SupabasePhoto` at display boundary rather than duplicating

```typescript
// New display wrapper type
interface GalleryPhoto extends SupabasePhoto {
  aspectRatio: number
  source: 'professional' | 'guest'
  collection: CollectionTab
  comments?: Comment[]
  liked?: boolean
  likeCount?: number
}
```

---

### `src/components/gallery/PhotoGrid.tsx` (component, CRUD)

**Analog:** `src/components/gallery/PhotoGrid.tsx` (self - enhancement)

**Current image rendering** (lines 127-134):
```typescript
<motion.img
  src={photo.thumbnail || photo.url}
  alt={photo.caption || 'Wedding photo'}
  className="w-full h-auto object-cover"
  loading="lazy"
  whileHover={{ scale: 1.08 }}
  transition={{ duration: 0.6, ease: 'easeOut' }}
/>
```

**LQIP enhancement pattern** from `src/components/ui/OptimizedImage.tsx` (lines 120-138):
```typescript
const placeholderStyle = useMemo(() => {
  if (placeholder === 'blur' && blurDataURL) {
    return {
      backgroundImage: `url(${blurDataURL})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      filter: 'blur(20px)',
      transform: 'scale(1.1)',
    }
  }
  if (placeholder === 'color') {
    return { backgroundColor: colors.cream[200] }
  }
  return {}
}, [placeholder, blurDataURL])
```

**UI-SPEC contract** (from 02-UI-SPEC.md):
- Blur effect: 20px blur with `scale(1.1)` to hide blur edges
- Transition: 300ms opacity fade from placeholder to full image
- Base placeholder: `bg-charcoal-200` for images without blurDataURL

**Implementation approach:**
1. Replace `motion.img` with `ProgressiveImage` component (new file using OptimizedImage)
2. Apply blur placeholder via `placeholder='blur'` + `blurDataURL` prop
3. Staggered entry: delay = min(index * 0.04, 0.5) per item

---

### `src/components/gallery/components/PhotoItem.tsx` (component, CRUD)

**Analog:** `src/components/gallery/components/PhotoItem.tsx` (self - enhancement)

**Current image rendering** (lines 51-58):
```typescript
<img
  src={viewMode === 'masonry' ? photo.thumbnail : photo.url}
  alt={photo.caption || ''}
  className={`w-full ${
    viewMode === 'masonry'
      ? 'rounded-lg shadow-md group-hover:shadow-xl'
      : 'h-full object-cover'
  } transition-all duration-300`}
/>
```

**Enhancement approach:**
1. Replace `img` with `OptimizedImage` or `ProgressiveImage`
2. Pass `blurDataURL` prop if blur hash available from photo data
3. Apply same stagger animation as PhotoGrid (index * 0.05 delay)

---

### `src/components/photo-viewer/PhotoLightbox.tsx` (component, request-response + prefetch)

**Analog:** `src/components/photo-viewer/PhotoLightbox.tsx` (self - state refactor)

**Controlled component pattern** (current lines 67-80):
```typescript
interface PhotoLightboxProps {
  photos: Photo[]
  currentIndex: number
  isOpen: boolean
  onClose: () => void
  onNavigate: (index: number) => void
  onLike?: (photoId: string) => void
  // ...
}
```

**Shared Zustand state pattern** (target architecture):
```typescript
// In galleryStore - add these state slices:
selectedImageIndex: number | null
isModalOpen: boolean
openImageModal: (index: number) => void
closeImageModal: () => void

// PhotoLightbox becomes uncontrolled, reads from store:
const selectedImageIndex = useGalleryStore(s => s.selectedImageIndex)
const isModalOpen = useGalleryStore(s => s.isModalOpen)
const photos = useGalleryStore(s => s.images)
```

**Prefetch pattern** (from RESEARCH.md lines 383-406):
```typescript
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
  })
}
```

**Key enhancements needed:**
1. Add `useEffect` to call `prefetchAdjacentImages(currentIndex, photos)` when lightbox opens or index changes
2. Add `useEffect` to subscribe to galleryStore for lightbox state instead of props
3. Handle hydration gracefully (check `isHydrated` before reading store)

---

### `src/hooks/useBlurHash.ts` (hook, transform)

**No close analog in codebase.**

**Reference pattern** from RESEARCH.md (lines 287-323):
```typescript
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

**Key implementation details:**
- Decode blur hash string to pixel array using `blurhash` library
- Create 32x32 canvas for placeholder (UI-SPEC: 20px blur)
- Convert to data URL for use as CSS background-image
- Handle invalid hash gracefully (return null)
- Memoize to avoid re-decoding same hash

---

### `src/components/gallery/ProgressiveImage.tsx` (component, CRUD)

**Analog:** `src/components/ui/OptimizedImage.tsx`

**Inherits from OptimizedImage** (lines 22-186):
```typescript
export const ProgressiveImage: React.FC<OptimizedImageProps> = ({ src, alt, ...props }) => {
  const [imgSrc, setImgSrc] = useState<string | null>(null)

  useEffect(() => {
    const img = new Image()
    img.src = src
    img.onload = () => {
      setImgSrc(src)
    }
  }, [src])

  return (
    <OptimizedImage
      src={imgSrc || src}
      alt={alt}
      placeholder='blur'
      blurDataURL={`data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8A`}
      {...props}
    />
  )
}
```

**UI-SPEC contract for ProgressiveImage:**
- `placeholder='blur'` with `blurDataURL` from useBlurHash hook
- 300ms opacity transition (already in OptimizedImage line 161-163)
- Fallback to `bg-charcoal-200` if no blurDataURL available

---

## Shared Patterns

### Authentication / State Persistence

**Source:** `src/stores/uiStore.ts` (lines 45-113)
**Apply to:** `src/stores/galleryStore.ts` (enhancement)

```typescript
export const useGalleryStore = create<GalleryState>()(
  devtools(
    subscribeWithSelector(
      persist(
        (set, get) => ({
          // ... existing state
        }),
        {
          name: 'gallery-store',
          storage: createJSONStorage(() => safeSessionStorage),
          partialize: state => ({
            images: state.images,
            pagination: state.pagination,
            filters: state.filters,
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

### Hydration Safety

**Source:** `src/stores/uiStore.ts` (pattern - no explicit hydration hook, relies on persist default)
**Apply to:** All store consumers

```typescript
// Note: zustand persist handles hydration automatically
// Components should handle loading state during hydration
// Gallery.tsx already has isLoading state that serves this purpose
```

### Error Handling (sessionStorage quota)

**Source:** RESEARCH.md lines 334-354
**Apply to:** `src/stores/galleryStore.ts`

```typescript
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
      // Quota exceeded - fallback to memory-only
    }
  },
  // ...
}
```

### Blur Placeholder Style

**Source:** `src/components/ui/OptimizedImage.tsx` (lines 120-128)
**Apply to:** `src/components/gallery/ProgressiveImage.tsx`, `src/components/gallery/PhotoGrid.tsx`

```typescript
const placeholderStyle = {
  backgroundImage: `url(${blurDataURL})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  filter: 'blur(20px)',
  transform: 'scale(1.1)',
}
```

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/hooks/useBlurHash.ts` | hook | transform | No existing blur hash decode hook |
| `src/hooks/useBlurHash.test.ts` | test | unit | No testing infrastructure for blur hash |
| `src/components/gallery/ProgressiveImage.test.tsx` | test | unit | No existing test for progressive image |
| `src/components/photo-viewer/PhotoLightbox.test.tsx` | test | unit | No existing test for lightbox prefetch |
| `src/stores/galleryStore.test.ts` | test | unit | No existing test for gallery store caching |

## Type Fragmentation Summary

| Location | Type | Status | Action |
|----------|------|--------|--------|
| `src/lib/supabase.ts:50` | `Photo` | Canonical DB type | Keep as source |
| `src/types/index.ts:15` | `GalleryImage` | Display wrapper | Verify usage - not used in Gallery.tsx |
| `src/pages/Gallery.tsx:44` | `Photo` | Local duplicate | Refactor to extend SupabasePhoto |
| `src/components/gallery/PhotoGrid.tsx:6` | `Photo` | Local interface | Refactor to extend SupabasePhoto |
| `src/components/gallery/components/PhotoItem.tsx:4` | `photo` prop | Local interface | Refactor to extend SupabasePhoto |
| `src/components/photo-viewer/PhotoLightbox.tsx:35` | `Photo` | Local interface | Refactor to extend SupabasePhoto |

## Metadata

**Analog search scope:** `src/stores/`, `src/lib/`, `src/types/`, `src/components/`, `src/pages/`, `src/hooks/`
**Files scanned:** 47 TypeScript files
**Pattern extraction date:** 2026-04-24

---

## Pattern Mapping Complete

**Phase:** 2 - Gallery Performance & UX
**Files classified:** 11
**Analogs found:** 9 / 11

### Coverage
- Files with exact analog: 5 (galleryStore, Gallery.tsx type, PhotoGrid, PhotoItem, PhotoLightbox self-enhancement)
- Files with role-match analog: 1 (ProgressiveImage from OptimizedImage)
- Files with no analog: 5 (useBlurHash hook + 4 test files)

### Key Patterns Identified
- **Zustand persist pattern**: uiStore.ts lines 45-113 as template for galleryStore sessionStorage caching
- **Blur placeholder style**: OptimizedImage.tsx lines 120-138 for 20px blur with scale(1.1)
- **Type consolidation**: supabase.ts Photo canonical, extend at display boundary
- **Lightbox state refactor**: Move from controlled props to shared Zustand state
- **Prefetch strategy**: link rel=prefetch for adjacent images in PhotoLightbox

### Files Created
`.planning/phases/02-gallery-performance/02-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can now reference analog patterns in PLAN.md files.