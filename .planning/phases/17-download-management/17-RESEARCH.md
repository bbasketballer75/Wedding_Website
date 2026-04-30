# Phase 17: Download Management - Research

**Researched:** 2026-04-30
**Domain:** Multi-select gallery download with queue persistence, hybrid client/server batch zip generation
**Confidence:** HIGH

## Summary

Phase 17 implements multi-select photo download with queue management. The core challenge is integrating a new `downloadStore` (Zustand) with sessionStorage persistence, extending the existing `PhotoGrid` component with selection UI, and implementing a hybrid batch download strategy using JSZip (small batches) and Supabase Edge Function (large batches >20 photos).

**Primary recommendation:** Build a new `downloadStore` following the existing `galleryStore` sessionStorage pattern, extend `PhotoGrid` with the existing select overlay pattern already present in the component, and implement batch download with JSZip using `generateAsync` with progress callback.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DL-01 | Multi-Select Download Queue | PhotoGrid already has `selectMode`, `selectedIds`, `onToggleSelect` props - extend with long-press and checkbox column |
| DL-02 | Batch Download with Progress | JSZip 3.10.1 `generateAsync` with metadata callback, Edge Function for large batches |
| DL-03 | Download Queue Persistence | `downloadStore` with sessionStorage persist middleware per galleryStore pattern |

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Both activation methods — long-press on mobile, checkbox on desktop
- **D-02:** Long-press threshold: 500ms (reliable, not too fast)
- **D-03:** Checkbox column appears in gallery grid header (desktop only)
- **D-04:** Multi-select mode shows selected count in header
- **D-05:** Floating action button (FAB) positioned bottom-right
- **D-06:** FAB shows count badge when items are queued
- **D-07:** Whole pill is tappable to expand/collapse the queue panel
- **D-08:** Queue panel shows selected photos as thumbnails with remove option
- **D-09:** "Add to Download" button appears when photos are selected
- **D-10:** Hybrid approach: JSZip for small batches (<=20 photos), Edge Function for large batches (>20)
- **D-11:** Edge Function avoids client memory issues for large batches
- **D-12:** Progress indicator: "Preparing... X of Y photos"
- **D-13:** Files named descriptively in zip
- **D-14:** New `downloadStore` (Zustand) persists to sessionStorage
- **D-15:** On page reload, restore queue from sessionStorage
- **D-16:** Queue badge shows count of items
- **D-17:** Transitions: 300ms ease-out
- **D-18:** Micro-interactions: 150ms
- **D-19:** Gold accent: #d4af37
- **D-20:** Cream backgrounds: cream-50, cream-100
- **D-21:** Border radius: rounded-xl for cards, rounded-lg for buttons

### Out of Scope

None — discussion stayed within phase scope.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Multi-select UI (long-press, checkbox) | Browser/Client | — | Touch/click event handling, DOM state |
| Selection state management | Browser/Client | — | Zustand store, sessionStorage |
| Batch download orchestration | Browser/Client | Edge Function | JSZip for <=20, Edge for >20 |
| Signed URL generation | API/Backend | — | Supabase RPC `get_download_urls` (needs creation) |
| Download progress tracking | Browser/Client | — | JSZip `generateAsync` metadata callback |
| Queue panel UI | Browser/Client | — | Framer Motion animations, Zustand state |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| JSZip | 3.10.1 | Client-side zip generation | [VERIFIED: npm view jszip version] - Industry standard for client-side zip |
| Zustand | 5.0.11 | State management | [VERIFIED: npm ls zustand] - Already in project, lighter than Redux |
| Framer Motion | (installed) | Animations | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Supabase Edge Functions | — | Large batch zip generation | When batch >20 photos |

**Installation:**
```bash
# JSZip already installed - verify
npm ls jszip
# Should show: jszip@3.10.1
```

**Version verification:**
```bash
npm view jszip version  # 3.10.1 [VERIFIED: npm registry]
npm view zustand version # 5.0.11 [VERIFIED: npm registry]
```

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Browser/Client                                 │
│  ┌──────────────┐    ┌─────────────────┐    ┌────────────────────────┐  │
│  │  PhotoGrid   │───▶│  downloadStore  │───▶│  QueuePanel (FAB)      │  │
│  │  (selectMode)│    │  (Zustand)      │    │  + Progress UI         │  │
│  └──────────────┘    └────────┬────────┘    └────────────────────────┘  │
│        │                     │                        ▲                  │
│        │                     ▼                        │                  │
│        │            ┌────────────────┐                │                  │
│        │            │ sessionStorage │                │                  │
│        │            │  (persist)     │                │                  │
│        │            └────────────────┘                │                  │
│        │                     │                        │                  │
│        ▼                     │                        │                  │
│  ┌──────────────┐            │         ┌──────────────────────┐          │
│  │  Long-press  │            │         │  downloadWithProgress │          │
│  │  500ms timer │            │         │  (JSZip generateAsync)│          │
│  └──────────────┘            │         └──────────┬───────────┘          │
│                             │                    │                       │
└─────────────────────────────│────────────────────│───────────────────────┘
                              │                    │
                              │    ≤20 photos      │    >20 photos
                              ▼                    │         │
                    ┌──────────────────┐          │         ▼
                    │ Supabase RPC      │          │  ┌───────────────────┐
                    │ get_download_urls │          │  │ Edge Function     │
                    └──────────────────┘          │  │ (batch-download)  │
                                                  │  └───────────────────┘
                                                  │         │
                                                  └─────────┘
```

### Recommended Project Structure
```
src/
├── stores/
│   └── downloadStore.ts        # NEW: Zustand store for download queue
├── components/
│   ├── gallery/
│   │   ├── DownloadQueuePanel.tsx   # NEW: FAB + expandable queue panel
│   │   ├── GalleryHeader.tsx        # MODIFY: add checkbox column + select mode header
│   │   └── PhotoGrid.tsx            # ALREADY HAS: selectMode props
│   └── ui/
│       └── ProgressModal.tsx        # NEW: Download progress modal
├── utils/
│   └── download.ts                  # EXTEND: add batchDownload function
└── hooks/
    └── useLongPress.ts              # NEW: Long-press hook for mobile select
```

### Pattern 1: Zustand Store with sessionStorage Persistence

**What:** Following the `galleryStore` pattern for creating a Zustand store that persists to sessionStorage.

**When to use:** For the download queue state that needs to survive page reloads.

**Example:**
```typescript
// Based on: src/stores/galleryStore.ts (lines 6-27)
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

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
  removeItem: (name: string): void => {
    try {
      sessionStorage.removeItem(name)
    } catch {}
  },
}

interface DownloadState {
  queuedPhotos: Array<{ id: string; url: string; thumbnail: string; caption?: string }>
  isPanelOpen: boolean
  isDownloading: boolean
  downloadProgress: number
  addToQueue: (photo: Photo) => void
  removeFromQueue: (photoId: string) => void
  clearQueue: () => void
  togglePanel: () => void
  setDownloading: (downloading: boolean) => void
  setProgress: (progress: number) => void
}

// Uses persist middleware with sessionStorage per D-14, D-15
```

### Pattern 2: PhotoGrid Select Mode (Already Implemented)

**What:** `PhotoGrid` already has `selectMode`, `selectedIds`, and `onToggleSelect` props (lines 12-14 in PhotoGrid.tsx).

**When to use:** When implementing multi-select in the gallery.

**Example:**
```typescript
// From: src/components/gallery/PhotoGrid.tsx (lines 12-14, 47-68, 206-215)
interface PhotoGridProps {
  // ... existing props
  selectMode?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (photoId: string) => void
}

// SelectOverlay already implemented at lines 47-68
function SelectOverlay({ selected, onToggle }: { selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle() }}
      aria-label={selected ? 'Deselect photo' : 'Select photo'}
      className="absolute inset-0 z-20 flex items-start justify-end p-3"
    >
      <span className={cn(
        'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all',
        selected
          ? 'border-gold-500 bg-gold-500 text-white'
          : 'border-white/80 bg-black/30 text-transparent hover:border-gold-300'
      )}>
        <CheckCircle2 className="h-4 w-4" />
      </span>
      {selected && <span className="absolute inset-0 rounded-[inherit] ring-2 ring-gold-400 ring-offset-1" />}
    </button>
  )
}
```

### Pattern 3: Batch Download with JSZip

**What:** Using JSZip `generateAsync` with progress callback for client-side zip generation.

**When to use:** For batches of 20 or fewer photos.

**Example:**
```typescript
// Based on JSZip 3.x API [VERIFIED: GitHub Stuk/jszip]
import JSZip from 'jszip'

async function downloadBatchWithProgress(
  photos: Array<{ id: string; url: string }>,
  onProgress: (current: number, total: number) => void
): Promise<void> {
  const zip = new JSZip()

  // Fetch all images in parallel
  const total = photos.length
  const fetchedUrls = await Promise.all(
    photos.map(async (photo, index) => {
      onProgress(index + 1, total)
      const response = await fetch(photo.url)
      const blob = await response.blob()
      const ext = photo.url.split('.').pop() || 'jpg'
      zip.file(`${photo.id}.${ext}`, blob)
      return photo.id
    })
  )

  // Generate zip with progress
  const content = await zip.generateAsync(
    { type: 'blob', compress: true },
    (metadata) => {
      onProgress(total + Math.floor(metadata.percent), total + 100)
    }
  )

  // Trigger download
  const blobUrl = URL.createObjectURL(content)
  const link = document.createElement('a')
  link.href = blobUrl
  link.download = `photos-${Date.now()}.zip`
  link.click()
  URL.revokeObjectURL(blobUrl)
}
```

### Pattern 4: Long-Press Hook

**What:** 500ms press detection for mobile multi-select activation.

**When to use:** Mobile long-press to enter select mode.

**Example:**
```typescript
// Per D-02: Long-press threshold: 500ms
function useLongPress(
  onLongPress: () => void,
  onClick?: () => void,
  threshold = 500
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const targetRef = useRef<EventTarget>()

  return {
    onMouseDown: (e: React.MouseEvent) => {
      targetRef.current = e.currentTarget
      timeoutRef.current = setTimeout(() => {
        onLongPress()
      }, threshold)
    },
    onMouseUp: () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    },
    onMouseLeave: () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    },
  }
}
```

### Anti-Patterns to Avoid

- **Storing File/blob objects in sessionStorage:** sessionStorage only stores strings. Store photo metadata (id, url, thumbnail) only, not actual blob data.
- **Blocking main thread during zip generation:** Use `generateAsync` (async) not `generate` (sync) to avoid UI freeze.
- **No progress indication:** Large batches will take time. Always show progress to prevent user thinking it's stuck.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Zip file generation | Custom archive implementation | JSZip | Handles edge cases (encoding, compression, streaming), well-tested |
| sessionStorage wrapper | Ad-hoc try/catch everywhere | `safeSessionStorage` pattern from galleryStore | Consistent error handling, quota exceeded fallback |
| Long-press detection | setTimeout scattered in components | `useLongPress` hook | Reusable, handles edge cases (drag cancel, multi-touch) |

**Key insight:** JSZip `generateAsync` with metadata callback is the standard pattern for progress tracking. Building a custom zip implementation would need to handle compression levels, encoding, streaming for large files, and browser memory limits.

## Common Pitfalls

### Pitfall 1: sessionStorage Quota Exceeded
**What goes wrong:** Large download queues can exceed the 5MB sessionStorage limit, silently failing to persist.
**Why it happens:** Each photo's full URL + metadata adds up quickly with 50+ photos.
**How to avoid:** Use `safeSessionStorage` wrapper that catches quota errors and falls back to memory-only. Keep only essential fields in stored state.
**Warning signs:** Queue disappears after adding many photos.

### Pitfall 2: Memory Pressure with Large Batches
**What goes wrong:** JSZip buffering all images in memory before generating zip can crash the tab on low-end devices.
**Why it happens:** JSZip `generateAsync` needs all files in memory to create the zip.
**How to avoid:** Per D-10, use Edge Function for batches >20 photos. This offloads memory pressure to the server.
**Warning signs:** Browser tab crashes or becomes unresponsive during large batch download.

### Pitfall 3: Long-Press Conflicts with Photo Click
**What goes wrong:** Long-press triggers select mode but also opens lightbox on release.
**Why it happens:** Both events fire on the same element.
**How to avoid:** Use a flag that prevents click handler from firing when entering select mode via long-press. Set a 200ms debounce on the click handler in select mode.

### Pitfall 4: Signed URL Expiry
**What goes wrong:** User queues photos, waits, then download fails because signed URLs expired.
**Why it happens:** Signed URLs have a 1-hour expiry (per D-12 in requirements).
**How to avoid:** Generate signed URLs immediately before download, not when adding to queue. Show warning if queue is old.

## Code Examples

### Adding to Download Queue (DL-01)
```typescript
// From: src/components/gallery/PhotoGrid.tsx (line 101)
onClick={() => selectMode ? onToggleSelect?.(photo.id) : onPhotoClick?.(photo, index)}
```

```typescript
// Integration with downloadStore
const { addToQueue, queuedPhotos } = useDownloadStore()

// When user toggles selection:
const handleToggleSelect = (photoId: string) => {
  const photo = photos.find(p => p.id === photoId)
  if (photo) {
    addToQueue({ id: photo.id, url: photo.url, thumbnail: photo.thumbnail, caption: photo.caption })
  }
}
```

### Batch Download Flow (DL-02)
```typescript
// From: src/utils/download.ts (existing functions)
// New batchDownload function following existing patterns

export async function downloadBatch(
  photos: Array<{ id: string; url: string; caption?: string }>,
  onProgress?: (current: number, total: number, status: string) => void
): Promise<void> {
  if (photos.length === 0) return

  const total = photos.length
  const zip = new JSZip()

  onProgress?.(0, total, `Preparing ${total} photos...`)

  // Fetch all images
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i]
    const response = await fetch(photo.url)
    const blob = await response.blob()
    const ext = getExtensionFromUrl(photo.url) || 'jpg'
    const filename = photo.caption
      ? `${sanitizeFilename(photo.caption)}-${photo.id}.${ext}`
      : `${photo.id}.${ext}`
    zip.file(filename, blob)
    onProgress?.(i + 1, total, `Preparing ${i + 1} of ${total} photos...`)
  }

  onProgress?.(total, total, 'Generating zip file...')

  // Generate and download
  const content = await zip.generateAsync({ type: 'blob' })
  downloadBlob(content, `photos-${Date.now()}.zip`)
}
```

### GalleryHeader Extension (DL-01)
```typescript
// Modify: src/components/gallery/components/GalleryHeader.tsx
// Add selectMode state and checkbox column

interface GalleryHeaderProps {
  // ... existing props
  selectMode?: boolean
  onToggleSelectMode?: () => void
  selectedCount?: number
  onSelectAll?: () => void
  onClearSelection?: () => void
}

// In header, add checkbox column toggle button (desktop only)
{selectMode && (
  <div className="flex items-center gap-2">
    <span className="text-sm text-cream-200">{selectedCount} selected</span>
    <button onClick={onSelectAll}>Select All</button>
    <button onClick={onClearSelection}>Clear</button>
  </div>
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single photo download only | Multi-select batch download | Phase 17 | Major UX improvement for power users |
| localStorage for persistence | sessionStorage (per downloadStore) | Phase 17 | sessionStorage clears when tab closes - appropriate for downloads |
| Download via direct link | Signed URLs via RPC | Phase 17 | Security - URLs expire, better access control |

**Deprecated/outdated:**
- N/A for this phase

## Assumptions Log

> List all claims tagged `[ASSUMED]` in this research. The planner and discuss-phase use this section to identify decisions that need user confirmation before execution.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Photo `download_url` column exists or will be created | Standard Stack | If column doesn't exist, need to add migration |
| A2 | `get_download_urls` RPC doesn't exist yet and needs to be created | Architecture | If it exists, skip creation step |
| A3 | Edge Function for large batch download doesn't exist | Architecture | If pattern exists, reuse instead of create |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

## Open Questions

1. **Signed URL expiry handling**
   - What we know: Requirements specify 1-hour expiry for signed URLs
   - What's unclear: Should we warn users if their queue is older than 1 hour?
   - Recommendation: Show a subtle "refresh" option if queue is >30 minutes old

2. **Edge Function batch download details**
   - What we know: Large batches (>20) should use Edge Function per D-10
   - What's unclear: Should the Edge Function return a signed URL for a pre-generated zip, or stream the zip back?
   - Recommendation: Return signed URL for pre-generated zip (simpler, resumable)

3. **Queue size limit**
   - What we know: No explicit limit mentioned in requirements
   - What's unclear: Should we cap the queue at some reasonable limit (e.g., 50 photos)?
   - Recommendation: Set soft limit of 50 with warning, hard limit of 100

## Environment Availability

> Step 2.6: SKIPPED (no external dependencies beyond project code)

All dependencies for Phase 17 are already installed in the project:
- JSZip 3.10.1 [VERIFIED: npm ls jszip]
- Zustand 5.0.11 [VERIFIED: npm ls zustand]
- Framer Motion (already in project)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (existing project setup) |
| Config file | `vitest.config.ts` (existing) |
| Quick run command | `npm run test:run` |
| Full suite command | `npm run test:run -- --reporter=verbose` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DL-01 | Long-press activates select mode | Unit | `vitest run src/hooks/useLongPress.test.ts` | Need to create |
| DL-01 | Checkbox toggles selection | Unit | `vitest run src/components/gallery/PhotoGrid.test.tsx` | Extend existing |
| DL-01 | Queue stores selected photos | Unit | `vitest run src/stores/downloadStore.test.ts` | Need to create |
| DL-02 | Batch download generates zip | Integration | `vitest run src/utils/download.test.ts` | Extend existing |
| DL-02 | Progress indicator updates | Unit | `vitest run src/utils/download.test.ts` | Extend existing |
| DL-03 | Queue persists across reload | Integration | `vitest run src/stores/downloadStore.test.ts` | Need to create |

### Wave 0 Gaps
- [ ] `src/stores/downloadStore.test.ts` — tests for new download store
- [ ] `src/hooks/useLongPress.test.ts` — tests for long-press hook
- [ ] `src/utils/download.test.ts` — extend for batch download

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | Yes | Signed URLs with expiry — don't expose direct Storage URLs |
| V5 Input Validation | Yes | Validate photo_ids array in RPC — must be valid UUIDs |
| V10 Business Logic | Yes | Rate limit batch downloads per session |

### Known Threat Patterns for Download Feature

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Enumerate photo IDs via RPC | Information Disclosure | Signed URLs expire in 1 hour, don't reveal storage paths |
| Batch download DoS | Denial of Service | Edge Function timeout (30s), batch size limit (100 photos) |
| Malicious file names in zip | Tampering | Sanitize filenames before adding to zip |

## Sources

### Primary (HIGH confidence)
- `src/stores/galleryStore.ts` - Zustand persist with safeSessionStorage pattern [VERIFIED: source code]
- `src/components/gallery/PhotoGrid.tsx` - Existing selectMode implementation [VERIFIED: source code]
- `src/utils/download.ts` - Existing download utilities [VERIFIED: source code]
- `npm view jszip version` - JSZip 3.10.1 [VERIFIED: npm registry]
- `npm view zustand version` - Zustand 5.0.11 [VERIFIED: npm registry]
- GitHub Stuk/jszip - JSZip API examples [VERIFIED: WebFetch]

### Secondary (MEDIUM confidence)
- `.planning/phases/17-download-management/17-CONTEXT.md` - User decisions
- `.planning/REQUIREMENTS.md` - DL-01, DL-02, DL-03 requirements

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all versions verified via npm
- Architecture: HIGH - based on existing patterns in codebase
- Pitfalls: MEDIUM - based on general web development experience

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (30 days - stable domain)
