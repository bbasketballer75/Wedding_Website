# Architecture Research

**Domain:** Wedding Archive Website (theporadas.com)
**Researched:** 2026-04-23
**Confidence:** HIGH (based on existing codebase analysis + patterns)

## Executive Summary

Wedding archive systems are content-heavy read-heavy applications requiring strong gallery performance, admin moderation workflows, and reliable upload handling. This architecture extends the existing React + Supabase stack with focus on gallery virtualization, admin panel decomposition, and upload reliability patterns.

**Key architectural decisions:**
- Virtualize gallery for smooth scrolling at scale
- Decompose MediaReviewPanel (900+ lines) into focused components
- Implement upload progress persistence with retry queue
- Add admin error boundaries on all admin pages
- Cache gallery data to avoid repeated Supabase calls

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        UI Layer (React)                       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ Gallery │  │ Upload  │  │  Admin  │  │ Guest   │        │
│  │  Page   │  │  Page   │  │ Layout  │  │ Book    │        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
│       │            │            │            │              │
├───────┴────────────┴────────────┴────────────┴──────────────┤
│                    State Layer (Zustand)                     │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  auth    │  │ gallery  │  │   ui     │  │ upload   │   │
│  │  store   │  │  store   │  │  store   │  │  store   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
├─────────────────────────────────────────────────────────────┤
│                    Service Layer                              │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ galleryService│ │ uploadService │ │ moderation   │     │
│  │              │  │              │  │   Service    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
├─────────────────────────────────────────────────────────────┤
│                    Data Layer (Supabase)                      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ Postgres│  │ Storage │  │  Auth   │  │ Edge Fn  │        │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| GalleryStore | Gallery state, filters, pagination, selection | Zustand with subscribeWithSelector |
| UploadStore | Upload queue, progress, retry state | Zustand (new) |
| AuthStore | User session, admin status, sign in/out | Zustand with devtools |
| galleryService | Photo fetching, caching, deduplication | Service layer |
| uploadService | File processing, upload orchestration | Service layer |
| supabase.ts | Database queries, storage operations | Data access layer |

## Recommended Project Structure

```
src/
├── components/
│   ├── admin/              # Admin-specific components
│   │   ├── AlbumOrganizer.tsx
│   │   ├── MediaReviewPanel.tsx    # Decompose into sub-components
│   │   ├── BatchList.tsx           # NEW: batch listing
│   │   ├── FaceReviewGrid.tsx      # NEW: face review UI
│   │   └── ReviewImportManifest.tsx # NEW: import preview
│   ├── gallery/
│   │   ├── MasonryGrid.tsx         # Virtualized grid
│   │   ├── PhotoItem.tsx           # Lazy-loaded image
│   │   └── Lightbox.tsx            # Full-screen viewer
│   ├── upload/
│   │   ├── UploadDropzone.tsx      # File selection
│   │   ├── UploadPreview.tsx       # Preview grid
│   │   └── UploadProgress.tsx      # Progress indicator
│   └── error/
│       ├── ErrorBoundary.tsx       # General boundary
│       └── AdminErrorBoundary.tsx   # NEW: admin-specific
├── stores/
│   ├── authStore.ts
│   ├── galleryStore.ts
│   ├── uiStore.ts
│   └── uploadStore.ts              # NEW: upload state
├── services/
│   ├── galleryService.ts           # NEW: caching layer
│   ├── uploadService.ts            # NEW: upload orchestration
│   └── moderationService.ts        # NEW: review operations
├── hooks/
│   ├── useGalleryCache.ts          # NEW: cache hook
│   ├── useUploadQueue.ts           # NEW: upload queue hook
│   └── useInfiniteScroll.ts
├── workers/
│   ├── image.worker.ts             # Image processing
│   ├── search.worker.ts
│   └── sync.worker.ts
└── lib/
    └── supabase.ts                 # Supabase client + queries
```

### Structure Rationale

- **components/admin/**: Admin-specific UI isolated from public-facing components
- **components/gallery/**: Gallery components co-located for easier imports
- **components/upload/**: Upload flow isolated for cohesive state management
- **services/**: Business logic separated from UI for testability
- **hooks/**: Reusable logic extracted from components

## Architectural Patterns

### Pattern 1: Virtualized Gallery

**What:** Masonry grid with virtualized rendering for large photo collections
**When to use:** Gallery with 100+ images that need smooth scrolling
**Trade-offs:** + Handles thousands of images, - Slight complexity increase for layout

```typescript
// Pattern: Use react-window for virtualization with masonry layout
// Existing MasonryGrid.tsx should be enhanced with virtualization

interface VirtualizedMasonryProps {
  images: GalleryImage[]
  columnCount: number
  onImageClick: (index: number) => void
}

// Key optimization: Only render visible rows + buffer
// Use IntersectionObserver for lazy loading images
```

**Build implications:** MasonryGrid.tsx decomposition should happen first before other gallery work.

### Pattern 2: Upload Queue with Retry

**What:** Centralized upload queue with progress tracking, pause/resume, and retry
**When to use:** Guest uploads where interruptions are common (mobile users)
**Trade-offs:** + Reliable uploads, + Offline resilience, - Complex state management

```typescript
// Pattern: Upload store manages queue state
interface UploadItem {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'complete' | 'error'
  progress: number
  retryCount: number
  error?: string
  abortController?: AbortController
}

interface UploadStore {
  queue: UploadItem[]
  addToQueue: (files: File[]) => void
  retryUpload: (id: string) => void
  cancelUpload: (id: string) => void
  pauseAll: () => void
  resumeAll: () => void
}
```

**Build implications:** UploadStore provides foundation for Upload.tsx improvements.

### Pattern 3: Admin Panel Decomposition

**What:** Break 900+ line MediaReviewPanel into focused, single-responsibility components
**When to use:** Components that have grown beyond single responsibility
**Trade-offs:** + Maintainable, + Testable, - More files to manage

```typescript
// Decomposition plan for MediaReviewPanel.tsx:
// Before: 900+ lines, handles batches, faces, clusters, UI, state
// After:
src/components/admin/
├── MediaReviewPanel.tsx      # Orchestrator, ~150 lines
├── BatchList.tsx            # Batch selection sidebar, ~100 lines
├── FaceReviewGrid.tsx       # Face review main area, ~200 lines
├── ClusterMergeModal.tsx    # Cluster merge dialog, ~80 lines
├── FaceTaggingConfirmation.tsx # Name confirmation, ~80 lines
├── ReviewImportManifest.tsx # Import preview, ~100 lines
└── types.ts                  # Shared review types
```

**Build implications:** This is the highest-impact refactoring. Phase 1 priority.

### Pattern 4: Gallery Caching Layer

**What:** Service layer with in-memory cache for Supabase responses
**When to use:** When gallery makes repeated calls without caching
**Trade-offs:** + Reduces API calls, + Faster navigation, - Cache invalidation complexity

```typescript
// Pattern: Gallery service with cache
class GalleryCache {
  private cache = new Map<string, { data: any; timestamp: number }>()
  private TTL = 5 * 60 * 1000 // 5 minutes

  get(key: string): any | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(key)
      return null
    }
    return entry.data
  }

  set(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() })
  }

  invalidate(pattern?: string): void {
    // Clear matching keys
  }
}
```

**Build implications:** galleryService.ts with caching built before admin work.

### Pattern 5: Error Boundary Per Admin Route

**What:** Each admin page wrapped in ComponentErrorBoundary
**When to use:** Admin pages that load external data and can fail
**Trade-offs:** + Graceful degradation, + User feedback, - Some repetition

```typescript
// Pattern: Wrap lazy-loaded admin routes
<Suspense fallback={<AdminPageSkeleton />}>
  <ErrorBoundary
    fallback={
      <div className="p-8 text-center">
        <h3>Page Failed to Load</h3>
        <Button onClick={() => window.location.reload()}>Refresh</Button>
      </div>
    }
  >
    <Routes>
      <Route path="photos" element={<PhotoModeration />} />
      <Route path="review" element={<MediaReviewPanel />} />
      // ... other routes
    </Routes>
  </ErrorBoundary>
</Suspense>
```

**Build implications:** Apply to all admin routes before admin feature work.

## Data Flow

### Gallery Data Flow (Current vs Recommended)

**Current (problematic):**
```
Gallery.tsx → useState → supabase.from('photos').select()
           → parallel calls with no caching
           → setState directly
```

**Recommended:**
```
Gallery.tsx → galleryStore.fetchAlbum(album)
           → galleryService.getCached OR supabase call
           → cache result
           → store updates
           → components re-render
```

### Upload Flow

```
[User selects files]
    ↓
[UploadDropzone validates files]
    ↓
[uploadStore.addToQueue(files)]
    ↓
[uploadService.processQueue()]
    ↓ (parallel)
[File Fingerprint] → [Compression] → [Upload to Supabase Storage]
    ↓                      ↓                    ↓
[Generate preview]  [Worker thread]    [Track progress]
    ↓                      ↓                    ↓
[Dispatch progress update to store]
    ↓
[On complete: create guest_upload record in DB]
    ↓
[Dispatch success/error to UI]
```

### Admin Moderation Flow

```
[Admin selects batch]
    ↓
[fetchMediaReviewBatches() → BatchList UI]
    ↓
[Admin selects batch → fetchMediaReviewFaces(batchId)]
    ↓
[Faces displayed in FaceReviewGrid]
    ↓
[Admin confirms face → updateMediaReviewFace(faceId, { confirmedName })]
    ↓
[Audit log recorded via recordModerationAudit()]
    ↓
[State updates → UI reflects change]
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users | Current architecture sufficient. Add caching layer. |
| 1k-10k users | Virtualize gallery, add pagination to admin queries |
| 10k+ users | Consider CDN for images, edge caching, database indexing |

### Scaling Priorities

1. **First bottleneck:** Gallery scrolling performance at 200+ images
   - Fix: Virtualize MasonryGrid with react-window
2. **Second bottleneck:** Admin batch loading
   - Fix: Paginate batch queries, lazy-load faces
3. **Third bottleneck:** Upload reliability on mobile
   - Fix: Implement upload queue with retry

## Anti-Patterns

### Anti-Pattern 1: Parallel Uncached Supabase Calls

**What happens:** Gallery page makes multiple concurrent Supabase queries without caching
**Why wrong:** Each navigation triggers API calls, causes UI freeze on slow connections
**Do this instead:**
```typescript
// In galleryService.ts
async getAlbumPhotos(album: PhotoAlbum) {
  const cacheKey = `album:${album}`
  const cached = this.cache.get(cacheKey)
  if (cached) return cached

  const data = await fetchAlbumPhotos(album)
  this.cache.set(cacheKey, data)
  return data
}
```

### Anti-Pattern 2: Monolithic Admin Components

**What happens:** Single component handles multiple concerns (batches, faces, clusters, UI)
**Why wrong:** Hard to test, reason about, or modify safely
**Do this instead:** Decompose into single-responsibility components with clear interfaces

### Anti-Pattern 3: No Upload Progress Persistence

**What happens:** Upload progress lost on page refresh/navigation
**Why wrong:** Users lose uploads already in progress, must restart
**Do this instead:**
```typescript
// Use sessionStorage or IndexedDB for upload queue persistence
// On page load, restore pending uploads from storage
// Provide resume/cancel UI for restored uploads
```

### Anti-Pattern 4: Missing Admin Error Boundaries

**What happens:** Admin page errors crash entire admin view
**Why wrong:** No graceful degradation, bad UX for admin users
**Do this instead:** Wrap each admin route in ComponentErrorBoundary with recovery UI

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase Storage | Direct SDK calls via supabase.storage | For guest uploads, batch artifacts |
| Supabase Database | RPC calls for complex operations | Album org, photo likes, moderation |
| Sentry | Browser SDK for error tracking | Via ErrorLoggingService |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Gallery ↔ Supabase | galleryService.ts | Cache as intermediary |
| Upload ↔ Supabase | uploadService.ts | Queue management |
| Admin ↔ Supabase | Direct supabase calls | Per-review operations |
| Auth ↔ All | authStore.ts | Auth header injection via Supabase client |

## Build Order Implications

The architecture suggests this phase ordering:

**Phase 1: Foundation (Critical path dependencies)**
1. Decompose MediaReviewPanel.tsx into sub-components
   - Enables parallel work on admin features
   - Reduces risk of breaking existing functionality
2. Add GalleryStore caching layer (galleryService.ts)
   - Dependency for gallery improvements later
   - Reduces API load immediately

**Phase 2: Gallery Performance**
3. Virtualize MasonryGrid with react-window
   - Depends on: GalleryStore with caching working
4. Add UploadStore with queue persistence
   - Enables reliable uploads

**Phase 3: Admin Polish**
5. Add error boundaries to all admin routes
   - Depends on: MediaReviewPanel decomposed
6. Build Upload UI improvements (progress, validation, feedback)

**Phase 4: Integration & Polish**
7. Connect upload queue to admin moderation
8. Add lightbox performance improvements
9. Final error handling pass

## Sources

- Existing codebase analysis: src/stores/, src/components/admin/, src/pages/admin/
- React virtualized rendering patterns: https://react.dev/learn/passing-data-deeply-with-context (context patterns)
- Zustand middleware documentation: https://docs.pmnd.rs/zustand/middleware (subscribeWithSelector, devtools)
- Supabase React patterns: https://supabase.com/docs (client usage)

---
*Architecture research for: Wedding Archive Website*
*Researched: 2026-04-23*