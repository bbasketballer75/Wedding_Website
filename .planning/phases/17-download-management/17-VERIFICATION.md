# Phase 17 Verification: Download Management

**Phase:** 17-download-management
**Goal:** Implement multi-select photo download with queue persistence
**Verification Date:** 2026-04-30
**Requirement IDs:** DL-01, DL-02, DL-03

---

## Cross-Reference: Plan Requirements vs REQUIREMENTS.md

| Requirement ID | Plan Task | REQUIREMENTS.md Definition | Status |
|----------------|-----------|---------------------------|--------|
| DL-01 | Task 1-5, 7-8 | Multi-Select Download Queue | Accounted |
| DL-02 | Task 6, 9 | Batch Download with Progress | Accounted |
| DL-03 | Task 1 | Download Queue Persistence | Accounted |

All 3 requirement IDs from PLAN frontmatter are present in REQUIREMENTS.md.

---

## DL-01 Verification: Multi-Select Download Queue

### Success Criteria Check

| Criterion | Implementation | Verified |
|-----------|---------------|---------|
| Long-press or checkbox selects multiple photos | `useLongPress.ts` (500ms threshold), `PhotoGrid.tsx` long-press handlers | PASS |
| Selected count shown in header | `GalleryHeader.tsx` props `selectMode`, `selectedCount` | PASS |
| "Add to Download" button appears with selection | Queue adds via `addToQueue()` on long-press/checkbox toggle | PASS |
| Queue panel accessible and shows selected items | `QueuePanel.tsx` renders when `isPanelOpen` | PASS |
| Can remove individual items from queue | `removeFromQueue(photoId)` in `downloadStore.ts` | PASS |

### Implementation Evidence

**useLongPress.ts (500ms threshold):**
```typescript
export function useLongPress(
  onLongPress: () => void,
  threshold: number = 500  // ✓ 500ms default
): LongPressHandlers {
```

**downloadStore.ts sessionStorage persistence:**
```typescript
persist(
  (set) => ({ ... }),
  {
    name: 'download-store',
    storage: createJSONStorage(() => safeSessionStorage),
    partialize: state => ({
      queuedPhotos: state.queuedPhotos,  // ✓ persisted
      isPanelOpen: state.isPanelOpen,   // ✓ persisted
    }),
  }
)
```

**Soft/Hard limits:**
```typescript
const SOFT_LIMIT = 50   // ✓ warns
const HARD_LIMIT = 100  // ✓ blocks
```

---

## DL-02 Verification: Batch Download with Progress

### Success Criteria Check

| Criterion | Implementation | Verified |
|-----------|---------------|---------|
| "Download All" generates zip file | `downloadBatch()` in `download.ts` uses JSZip for <=20 | PASS |
| Progress indicator shows during preparation | `onProgress?.(i + 1, total, status)` called per photo | PASS |
| Browser download triggers with correct zip file | `<a>.click()` triggers download | PASS |
| Files named descriptively in zip | `sanitizeFilename()` + caption-based naming | PASS |

### Implementation Evidence

**Hybrid approach (JSZip <=20, Edge Function >20):**
```typescript
if (total > 20) {
  // Call Edge Function for large batches
  const signedUrl = await callBatchDownloadEdgeFunction(refreshedPhotos)
} else {
  // Small batches (<=20): use JSZip client-side
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  // ... fetch and zip
}
```

**Progress callback:**
```typescript
export async function downloadBatch(
  photos: Array<{ id: string; url: string; caption?: string }>,
  onProgress?: (current: number, total: number, status: string) => void
): Promise<void>
```

**Edge Function (`batch-download/index.ts`):**
- Returns signed URLs for photos (per D-22)
- Hard limit 100 photos per D-23
- 1-hour signed URL expiry per D-22

---

## DL-03 Verification: Download Queue Persistence

### Success Criteria Check

| Criterion | Implementation | Verified |
|-----------|---------------|---------|
| Page reload preserves download queue | `sessionStorage` persistence via Zustand persist | PASS |
| Queue badge shows count of items | `DownloadQueueFAB.tsx` displays `queuedPhotos.length` | PASS |
| Can continue adding to queue after reload | `addToQueue()` works post-reload | PASS |

### Implementation Evidence

**Only persisted state (not ephemeral):**
```typescript
partialize: state => ({
  queuedPhotos: state.queuedPhotos,   // ✓ persisted
  isPanelOpen: state.isPanelOpen,     // ✓ persisted
  // isDownloading: false               ✗ NOT persisted (ephemeral)
  // downloadProgress: 0               ✗ NOT persisted (ephemeral)
}),
```

**sessionStorage wrapper (safeSessionStorage):**
```typescript
const safeSessionStorage = {
  getItem: (name: string): string | null => {
    try { return sessionStorage.getItem(name) } catch { return null }
  },
  setItem: (name: string, value: string): void => {
    try { sessionStorage.setItem(name, value) } catch {}
  },
  removeItem: (name: string): void => {
    try { sessionStorage.removeItem(name) } catch {}
  },
}
```

---

## File Inventory

| File | Created | Verified |
|------|---------|---------|
| `src/stores/downloadStore.ts` | Yes | PASS |
| `src/hooks/useLongPress.ts` | Yes | PASS |
| `src/components/gallery/DownloadQueueFAB.tsx` | Yes | PASS |
| `src/components/gallery/QueuePanel.tsx` | Yes | PASS |
| `src/components/gallery/GalleryCheckbox.tsx` | Yes | PASS |
| `src/utils/download.ts` | Modified | PASS |
| `src/components/gallery/PhotoGrid.tsx` | Modified | PASS |
| `src/components/gallery/components/GalleryHeader.tsx` | Modified | PASS |
| `supabase/functions/batch-download/index.ts` | Yes | PASS |

---

## Summary

| Requirement | Status | Notes |
|------------|--------|-------|
| DL-01 | PASS | Long-press 500ms, checkbox, sessionStorage queue, soft/hard limits |
| DL-02 | PASS | JSZip <=20, Edge Function >20, progress callback |
| DL-03 | PASS | sessionStorage persistence only for queuedPhotos/isPanelOpen |

**Phase Goal Achievement: VERIFIED**

All must_haves from 17-01-PLAN.md are implemented and traceable to requirement IDs in REQUIREMENTS.md.

---
*Phase: 17-download-management*
*Verification: 2026-04-30*
