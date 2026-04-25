# Architecture Research

**Domain:** Wedding Archive Website (React 19 SPA + Supabase)
**Researched:** 2026-04-24
**Confidence:** HIGH

## Executive Summary

The v1.1 feature expansion adds seven new capabilities to an existing wedding archive: gallery virtualization, guest reactions, featured spotlight, social sharing with OG tags, upload resume, upload status feedback, and PWA offline support. These integrate with the existing React + Supabase + Zustand stack requiring new components, store additions, database schema changes, and configuration work.

**Key findings:**
- Gallery virtualization replaces PhotoGrid rendering with @tanstack/react-virtual
- Guest reactions require JSONB column + atomic RPC functions
- Featured spotlight already has data infrastructure (site_editorial_features table)
- Upload resume needs a new Zustand store with localStorage persistence
- PWA offline already configured via VitePWA, needs workbox tuning
- Social sharing already exists in Upload.tsx, needs per-photo OG enhancement

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Pages (Lazy Routes)                  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │  Home   │  │ Gallery │  │ Upload  │  │Guestbook│        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
│       │            │            │            │              │
├───────┴────────────┴────────────┴────────────┴──────────────┤
│              Components (ui, layout, gallery, sections)      │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  auth   │  │  gallery │  │   ui     │  │ upload   │    │
│  │  store  │  │  store   │  │  store   │  │  queue   │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
├─────────────────────────────────────────────────────────────┤
│                     Supabase Client                          │
│         (Auth, Database, Storage, Edge Functions)            │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| galleryStore | Gallery images, filters, pagination, selection, modal state | Zustand with sessionStorage (exists) |
| uploadQueueStore | Upload queue with localStorage persistence (NEW) | Zustand with persist middleware |
| authStore | Authentication state | Zustand (exists) |
| supabase.ts | Typed DB functions, RPC calls | Singleton client with typed wrappers (extends) |
| SEOHead | Dynamic OG tags per page/photo | Existing component (extends) |
| VitePWA | PWA registration, service worker | vite-plugin-pwa (configured, needs tuning) |

## New Components

| Component | File | Purpose |
|-----------|------|---------|
| VirtualizedPhotoGrid | components/gallery/VirtualizedPhotoGrid.tsx | Renders only visible photos using @tanstack/react-virtual |
| useUploadQueueStore | stores/uploadQueueStore.ts | Zustand store for upload queue with localStorage |
| useGuestReactions | hooks/useGuestReactions.ts | Hook for optimistic reaction updates |
| FeaturedSpotlight | components/sections/FeaturedSpotlight.tsx | Displays featured content on Home |
| ShareButtons | components/gallery/ShareButtons.tsx | Social share button group |
| UploadStatusScreen | components/upload/UploadStatusScreen.tsx | "Your photo is being reviewed" feedback |
| OfflineGalleryProvider | hooks/useOfflineGallery.ts | PWA offline support hook |

## Recommended Project Structure

```
src/
├── components/gallery/
│   ├── PhotoGrid.tsx              # EXISTING: standard grid
│   ├── VirtualizedPhotoGrid.tsx   # NEW: virtualization wrapper
│   ├── ShareButtons.tsx           # NEW: social share component
│   └── components/
│       ├── MasonryGrid.tsx        # EXISTING: masonry layout
│       └── PhotoItem.tsx          # EXISTING: individual photo
├── components/sections/
│   └── FeaturedSpotlight.tsx     # NEW: featured content display
├── stores/
│   ├── galleryStore.ts            # EXISTING: extends for virtualization
│   └── uploadQueueStore.ts        # NEW: upload queue with localStorage
├── hooks/
│   ├── useGuestReactions.ts       # NEW: guest reactions hook
│   └── useOfflineGallery.ts       # NEW: PWA offline hook
└── lib/
    └── supabase.ts                # EXISTING: extends with reaction RPCs
```

### Structure Rationale

- **`components/gallery/VirtualizedPhotoGrid.tsx`**: Centralizes virtualization logic, wraps existing PhotoGrid pattern
- **`stores/uploadQueueStore.ts`**: Persists upload queue to localStorage, restores on mount
- **`hooks/useGuestReactions.ts`**: Encapsulates reaction optimistic updates + Supabase sync
- **`components/sections/FeaturedSpotlight.tsx`**: Reusable featured content display for Home page

## Architectural Patterns

### Pattern 1: Virtualized Rendering with @tanstack/react-virtual

**What:** Render only visible items in a large list instead of all items
**When to use:** Gallery with 200+ photos
**Trade-offs:** + Handles thousands of images, - Slight complexity for masonry layout

**Implementation approach:**
```typescript
// For masonry, virtualizer tracks row-based indices
// Masonry columns determined by CSS, virtualizer handles vertical scroll
// Only photos in visible vertical range render
// Adjacent photo prefetch preserved from existing code
```

### Pattern 2: Optimistic Updates with Rollback

**What:** Update UI immediately, sync to server async, rollback on failure
**When to use:** Reactions, likes, comments
**Trade-offs:** + Instant UX, - Requires careful error handling

**Implementation:**
```typescript
const [localReactions, setLocalReactions] = useState(initial)
const addReaction = async (key) => {
  setLocalReactions(prev => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }))
  try {
    await supabase.rpc('add_guestbook_reaction', { message_id, reaction_key: key })
  } catch {
    setLocalReactions(prev => ({ ...prev, [key]: prev[key] - 1 }))
  }
}
```

### Pattern 3: localStorage Persistence with Safe Wrapper

**What:** Persist state to localStorage with error handling for quota exceeded
**When to use:** Upload queue, UI preferences
**Trade-offs:** + Survives refresh, - Can fail (quota, private browsing)

**Implementation (reusing existing safeSessionStorage pattern):**
```typescript
const safeLocalStorage = {
  getItem: (name) => { try { return localStorage.getItem(name) } catch { return null } },
  setItem: (name, value) => { try { localStorage.setItem(name, value) } catch {} },
}

// Zustand persist with safeLocalStorage
export const useUploadQueueStore = create(
  persist(
    (set, get) => ({
      files: [],
      addFiles: (newFiles) => set(state => ({ files: [...state.files, ...newFiles] })),
      removeFile: (id) => set(state => ({ files: state.files.filter(f => f.id !== id) })),
    }),
    { name: 'upload-queue', storage: createJSONStorage(() => safeLocalStorage) }
  )
)
```

### Pattern 4: Dynamic OG Image URL

**What:** Generate share URLs with photo-specific OG images
**When to use:** Photo share, gallery share
**Trade-offs:** + Rich social previews, - Requires image processing infrastructure

**Implementation:**
```typescript
// Option A: Query parameter approach
const shareUrl = `${location.origin}/gallery?photo=${photoId}&share=1`
// OG image URL: /_og?photo=${photoId} (processed server-side or via CDN)

// Option B: Pre-generated OG images per photo
// Storage path: /og-photos/{photoId}.jpg
const ogImageUrl = supabase.storage.getPublicUrl('og-photos', `${photoId}.jpg`)
```

## Data Flow

### Gallery Virtualization Flow

```
User scrolls
    ↓
Virtualizer calculates visible vertical range
    ↓
Only photos in range render (PhotoItem components)
    ↓
IntersectionObserver triggers prefetch for adjacent
    ↓
Next range becomes visible (smooth)
```

### Upload Queue with Resume Flow

```
User selects files
    ↓
Files added to uploadQueueStore (persisted to localStorage)
    ↓
uploadFileToR2 processes each file
    ↓
On success: status = 'complete'
On failure: status = 'error', retry available
    ↓
On page reload: store restored from localStorage
    ↓
User can retry failed or remove them
```

### Guest Reaction Flow

```
User clicks "Add a reaction"
    ↓
Reaction picker appears (existing emoji grid)
    ↓
User selects emoji
    ↓
Optimistic update: localReactions[messageId][emojiKey]++
    ↓
Supabase RPC: add_guestbook_reaction(message_id, emoji_key)
    ↓
On error: rollback optimistic update
```

### Featured Spotlight Flow

```
Admin sets featured content (FeaturedContentManager - exists)
    ↓
site_editorial_features table updated
    ↓
Home page fetches active features via fetchSiteEditorialFeatures()
    ↓
FeaturedSpotlightSection renders featured slots
    ↓
Users see highlighted content on home page
```

### Social Share Flow

```
User clicks share on a photo
    ↓
ShareButtons component opens share dialog
    ↓
URL generated with photo context: /gallery?photo={id}&share=1
    ↓
Platform-specific URL (Facebook, Twitter, etc.)
    ↓
Meta tags updated via SEOHead (dynamic OG image)
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users | Current architecture sufficient |
| 1k-10k users | Gallery virtualization, image CDN |
| 10k-100k users | Edge caching, aggressive asset optimization |

### Scaling Priorities

1. **First bottleneck:** Gallery rendering at 200+ photos
   - Fix: @tanstack/react-virtual
2. **Second bottleneck:** Image load times
   - Fix: LQIP, prefetch, CDN (already partially implemented)

## Anti-Patterns

### Anti-Pattern 1: Rendering All Gallery Items

**What happens:** Map over all photos, render every one
**Why wrong:** DOM grows with photo count, causing lag on scroll, high memory
**Do this instead:** Use @tanstack/react-virtual to render only visible items

### Anti-Pattern 2: Upload Queue in Component State Only

**What happens:** `const [files, setFiles] = useState([])`
**Why wrong:** Page refresh loses all progress
**Do this instead:** Persist to localStorage via Zustand with persist middleware

### Anti-Pattern 3: No Per-Photo OG Image

**What happens:** Single default OG image for all shares
**Why wrong:** Shared links look generic
**Do this instead:** Dynamic OG image URLs with photo-specific images

### Anti-Pattern 4: Blocking UI on Network Requests

**What happens:** `await addReaction()` then update UI
**Why wrong:** User feels lag on every interaction
**Do this instead:** Optimistic updates, sync in background

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase | Single client in src/lib/supabase.ts | Auth, Database, Storage |
| VitePWA | vite-plugin-pwa in vite.config.js | Already configured, needs workbox tuning |
| Social Platforms | Share URLs (Facebook, Twitter, SMS, email) | Already implemented in Upload.tsx |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Gallery ↔ Supabase | galleryStore subscribes, supabase.ts functions | State-driven |
| Upload ↔ Supabase | uploadQueueStore + Upload.tsx | localStorage persistence |
| Guestbook ↔ Supabase | Direct Supabase calls | Reactions need new RPC |
| FeaturedContent ↔ Home | fetchSiteEditorialFeatures() | Already exists in supabase.ts |

## Database Schema Changes

### guestbook_messages reactions column

```sql
ALTER TABLE guestbook_messages
ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}';
```

### New RPC for atomic reaction updates

```sql
CREATE OR REPLACE FUNCTION add_guestbook_reaction(
  p_message_id UUID,
  p_reaction_key TEXT
) RETURNS JSONB AS $$
  UPDATE guestbook_messages
  SET reactions = jsonb_set(
    COALESCE(reactions, '{}'),
    ARRAY[p_reaction_key],
    to_jsonb(COALESCE((reactions->>p_reaction_key)::int, 0) + 1)
  )
  WHERE id = p_message_id
  RETURNING reactions
$$ LANGUAGE SQL SECURITY DEFINER;
```

## Build Order (Considering Dependencies)

### Phase 1: Social Sharing & Upload Resume (No Dependencies)

1. **ShareButtons component** -- Simple, no backend changes
2. **Social OG tag enhancement** -- Extend SEOHead for dynamic per-photo images
3. **uploadQueueStore** -- localStorage persistence for upload queue

### Phase 2: Guest Reactions (DB Schema Changes)

4. **Add reactions column to guestbook_messages** -- Migration
5. **Supabase RPC for reactions** -- Atomic update of reactions JSONB
6. **useGuestReactions hook** -- Optimistic updates with rollback

### Phase 3: Gallery Virtualization (Core Performance)

7. **@tanstack/react-virtual integration** -- Replace PhotoGrid rendering
8. **Masonry virtualizer** -- Handle masonry layout with virtualization
9. **Prefetch integration** -- Keep adjacent image prefetch working

### Phase 4: Featured Spotlight (Home Page Changes)

10. **FeaturedSpotlight component** -- Display site_editorial_features
11. **Home.tsx integration** -- Fetch and render featured content
12. **Admin FeaturedContentManager** -- Already exists, verify coverage

### Phase 5: PWA Offline (Configuration Work)

13. **Workbox tuning** -- Cache Supabase storage images
14. **Offline fallback page** -- public/offline.html already exists
15. **Service worker customization** -- Runtime caching for photos

## Existing Architecture Compatibility

**What to modify:**
- `src/components/gallery/PhotoGrid.tsx` -- Add VirtualizedPhotoGrid variant
- `src/stores/galleryStore.ts` -- Add virtualization-related state if needed
- `src/components/seo/SEOHead.tsx` -- Add dynamic OG image per photo
- `vite.config.js` -- Workbox runtime caching configuration
- `src/lib/supabase.ts` -- Add reaction RPC functions

**What to add (new files):**
- `src/stores/uploadQueueStore.ts`
- `src/hooks/useGuestReactions.ts`
- `src/hooks/useOfflineGallery.ts`
- `src/components/gallery/VirtualizedPhotoGrid.tsx`
- `src/components/gallery/ShareButtons.tsx`
- `src/components/sections/FeaturedSpotlight.tsx`

## Sources

- [@tanstack/react-virtual documentation](https://tanstack.com/virtual/latest)
- [Vite PWA Plugin documentation](https://vite-pwa.dev/)
- [Supabase JSONB operations](https://supabase.com/docs/guides/database/json)
- [Workbox runtime caching](https://developer.chrome.com/docs/workbox/)
- Existing codebase: src/stores/, src/components/gallery/, src/pages/

---
*Architecture research for: Wedding Archive v1.1 Feature Expansion*
*Researched: 2026-04-24*