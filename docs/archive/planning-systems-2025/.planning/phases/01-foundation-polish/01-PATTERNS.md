# Phase 1: Foundation & Polish - Pattern Map

**Mapped:** 2026-04-23
**Files analyzed:** 8
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/stores/authStore.ts` | store | request-response | `src/stores/authStore.ts` (self) | exact |
| `src/utils/security.ts` | utility | request-response | `src/utils/security.ts` (self) | exact |
| `src/components/admin/BatchList.tsx` | component | CRUD | `src/components/admin/MediaReviewPanel.tsx` | role-match |
| `src/components/admin/FaceReviewGrid.tsx` | component | CRUD | `src/components/admin/MediaReviewPanel.tsx` | role-match |
| `src/components/admin/ClusterMergeModal.tsx` | component | request-response | `src/components/photo-viewer/PhotoLightbox.tsx` | role-match |
| `src/components/admin/FaceTaggingConfirmation.tsx` | component | form | `src/components/ui/Input` + `src/components/ui/Button` | role-match |
| `src/components/admin/ReviewImportManifest.tsx` | component | CRUD | `src/lib/supabase.ts` (utility functions) | role-match |
| `src/pages/admin/AdminLayout.tsx` | component | request-response | `src/components/error/ErrorBoundary.tsx` | role-match |

## Pattern Assignments

### `src/stores/authStore.ts` (store, request-response)

**Modifications:** Add auth operation queue to prevent race conditions between `initializeAuth` and `refreshSession`

**Import pattern** (lines 1-2):
```typescript
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
```

**State interface pattern** (lines 6-32):
```typescript
export interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  // ... other actions
  initializeAuth: () => Promise<void>
  refreshSession: () => Promise<void>
}
```

**Solution pattern for queue (from RESEARCH.md lines 325-346):**
```typescript
// Add at module level before store definition
let authOperationQueue: Promise<void> = Promise.resolve()

const queueAuthOperation = async <T>(fn: () => Promise<T>): Promise<T> => {
  return authOperationQueue.then(fn).catch((error) => {
    console.error('Auth operation failed:', error)
    return undefined as T
  })
}

// Wrap initializeAuth (lines 93-111):
initializeAuth: async () => {
  return queueAuthOperation(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        set({ user: session.user, isAuthenticated: true })
        await get().checkAdminStatus()
      } else {
        set({ user: null, isAuthenticated: false, isAdmin: false })
      }
    } catch (error) {
      console.error('Auth initialization error:', error)
      set({ user: null, isAuthenticated: false, isAdmin: false })
    } finally {
      set({ isLoading: false })
    }
  })
},

// Wrap refreshSession (lines 113-129):
refreshSession: async () => {
  return queueAuthOperation(async () => {
    try {
      const { data: { session } } = await supabase.auth.refreshSession()
      if (session?.user) {
        set({ user: session.user, isAuthenticated: true })
        await get().checkAdminStatus()
      } else {
        set({ user: null, isAuthenticated: false, isAdmin: false })
      }
    } catch (error) {
      console.error('Session refresh error:', error)
      set({ user: null, isAuthenticated: false, isAdmin: false })
    }
  })
},
```

---

### `src/utils/security.ts` (utility, request-response)

**Modifications:** Remove duplicate Supabase client creation, import from `src/lib/supabase.ts`

**Current problem** (lines 1-17):
```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
// ... creates duplicate client
export const supabase = createClient(supabaseUrl, supabaseKey, {...})
```

**Solution pattern** (lines 1-2, 96-138):
```typescript
// Replace lines 1-17 with:
import { supabase } from '@/lib/supabase'

// Keep rateLimitMap and other utilities - they don't need the client at module level
// Remove rateLimitMap (lines 20-39) - module-level mutable state has potential issues
// Move rate limiting into functions or use a service

// Remove local supabaseUrl, supabaseKey variables (only used for duplicate client)

// Keep auditLog function but change supabase reference (line 102):
// Already uses supabase from '@/lib/supabase' via import
// But security.ts line 102 has: await supabase.from('audit_logs').insert
// This is the duplicate - needs to import from lib/supabase

// sessionManager (lines 116-138) already imports supabase - keep as-is
export const sessionManager = {
  async extendSession() {
    const { data: { session } } = await supabase.auth.getSession()
    // ...
  }
}
```

---

### `src/components/admin/BatchList.tsx` (component, CRUD)

**New file** - extracted from `MediaReviewPanel.tsx` lines 997-1114

**Imports pattern** (from MediaReviewPanel lines 1-36):
```typescript
import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ComponentErrorBoundary } from '@/components/error/ErrorBoundary'
import { useToast } from '@/context/ToastContext'
import {
  fetchMediaReviewBatches,
  updateMediaReviewBatchStatus,
  type MediaReviewBatch,
  type MediaReviewBatchStatus,
} from '@/lib/supabase'
import { RefreshCw, Eye, Tags, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
```

**Component structure** (from MediaReviewPanel lines 1000-1113):
```typescript
export function BatchList({
  selectedBatchId,
  onSelectBatch,
  onRefresh,
}: {
  selectedBatchId: string | null
  onSelectBatch: (id: string) => void
  onRefresh: () => void
}) {
  const [batches, setBatches] = useState<MediaReviewBatch[]>([])
  const [syncingBatchId, setSyncingBatchId] = useState<string | null>(null)
  const { addToast } = useToast()

  // Load batches pattern (MediaReviewPanel lines 555-574)
  const loadBatches = useCallback(async () => {
    const { data, error } = await fetchMediaReviewBatches()
    if (error) {
      addToast('Could not load review batches.', 'error')
      return
    }
    const guestBatches = (data || []).filter(b =>
      b.batch_key.startsWith('guest-review-batch-') ||
      b.notes === 'Guest upload face review batch'
    )
    setBatches(guestBatches)
  }, [addToast])

  // Advanced tools pattern (MediaReviewPanel lines 1082-1113):
  // Sync Metadata button → handleSyncManifestMetadata
  // Apply Confirmed Faces button → handleApplyConfirmedFaces
  // Both show loading state via syncingBatchId

  return (
    <section className="rounded-[1.4rem] border border-gold-100 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
        {/* Batch picker select */}
        {/* Status stats grid */}
        {/* Advanced tools in <details> */}
      </div>
    </section>
  )
}
```

---

### `src/components/admin/FaceReviewGrid.tsx` (component, CRUD)

**New file** - extracted from `MediaReviewPanel.tsx` lines 1125-1462

**Imports:**
```typescript
import { useState, useMemo, useDeferredValue } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { cn } from '@/lib/utils'
import { FolderOpen, Save, RefreshCw } from 'lucide-react'
import {
  type MediaReviewFace,
  type MediaReviewFaceStatus,
  updateMediaReviewFace,
  fetchKnownPeopleNames,
} from '@/lib/supabase'
import { getMediaPath } from '@/utils/media'
```

**State structure** (from MediaReviewPanel lines 420-438):
```typescript
interface FaceDraft {
  reviewStatus: MediaReviewFaceStatus
  confirmedName: string
  personKey: string
  notes: string
}

export function FaceReviewGrid({
  faces,
  faceDrafts,
  onUpdateDraft,
  onSaveFaces,
  onResetFaces,
  selectedGroupKey,
  selectedGroupFaceId,
  onSelectGroup,
  onSelectFace,
}: {
  faces: MediaReviewFace[]
  faceDrafts: Record<string, FaceDraft>
  // ...
}) {
  const [personSearch, setPersonSearch] = useState('')
  const deferredPersonSearch = useDeferredValue(personSearch)

  // Person groups pattern (MediaReviewPanel lines 306-363):
  // buildPersonGroups(faces) → PersonGroup[]
  // filteredGroups based on search

  // Sample faces display pattern (MediaReviewPanel lines 1324-1373):
  // grid of face cards with crop preview
  // status badge classes (MediaReviewPanel lines 365-374)
}
```

---

### `src/components/admin/ClusterMergeModal.tsx` (component, request-response)

**New file** - extracted from `MediaReviewPanel.tsx` lines 1464-1696

**Imports:**
```typescript
import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { cn } from '@/lib/utils'
import { Save, X } from 'lucide-react'
import { type MediaReviewFace, type ReviewPhotoRecord } from './MediaReviewPanel'
import { createMediaReviewArtifactSignedUrl } from '@/lib/supabase'
import { getMediaPath } from '@/utils/media'
```

**Modal structure pattern** (from MediaReviewPanel lines 1465-1696):
```typescript
export function ClusterMergeModal({
  isOpen,
  onClose,
  selectedPhoto,
  selectedFace,
  selectedFaceDraft,
  onUpdateDraft,
  onSaveFaces,
  onResetFaces,
  cropPreviewUrls,
  onSelectFace,
  onNavigateFace,
}: {
  isOpen: boolean
  onClose: () => void
  selectedPhoto: ReviewPhotoRecord | null
  selectedFace: MediaReviewFace | null
  selectedFaceDraft: FaceDraft | null
  // ...
}) {
  if (!isOpen || !selectedPhoto) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-950/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-[1.6rem] border border-gold-100 bg-white shadow-2xl">
        {/* Header with close button */}
        {/* Photo grid with face overlays (lines 1480-1515) */}
        {/* Face selector grid (lines 1544-1575) */}
        {/* Face detail panel (lines 1580-1691) */}
      </div>
    </div>
  )
}
```

---

### `src/components/admin/FaceTaggingConfirmation.tsx` (component, form)

**New file** - extracted from `MediaReviewPanel.tsx` lines 1598-1691

**Imports:**
```typescript
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
```

**Form pattern** (from MediaReviewPanel lines 1598-1656):
```typescript
interface FaceTaggingConfirmationProps {
  face: MediaReviewFace
  draft: FaceDraft
  knownPeople: string[]
  onUpdateDraft: (faceId: string, patch: Partial<FaceDraft>) => void
  onSave: (faceIds: string[]) => void
  onReset: (faceIds: string[]) => void
  isSaving: boolean
  hasChanges: boolean
}

export function FaceTaggingConfirmation({
  face,
  draft,
  knownPeople,
  onUpdateDraft,
  onSave,
  onReset,
  isSaving,
  hasChanges,
}: FaceTaggingConfirmationProps) {
  // Person name input with datalist (lines 1602-1616)
  // Status buttons: Pending/Confirm/Ignore (lines 1618-1638)
  // Save/Reset buttons (lines 1640-1657)
  // Details section with person key and notes (lines 1659-1689)
}
```

---

### `src/components/admin/ReviewImportManifest.tsx` (component, CRUD)

**New file** - extracted from `MediaReviewPanel.tsx` lines 833-980

**Functions to extract:**
```typescript
// handleSyncManifestMetadata (lines 833-872)
// handleApplyConfirmedFaces (lines 874-980)

// Helper functions needed:
import { supabase } from '@/lib/supabase'
import { fetchPhotosForReview } from '@/lib/supabase'
import { toSiteMediaPath } from './MediaReviewPanel' // or extract utility
import { persistPhotoUpdates } from './MediaReviewPanel' // or extract
```

**Pattern (from MediaReviewPanel lines 833-872):
```typescript
export async function handleSyncManifestMetadata(
  batch: MediaReviewBatch,
  importRows: ReviewImportManifestRow[],
  onSuccess: (message: string) => void,
  onError: (message: string) => void,
) {
  setSyncingBatchId(batch.id)
  const urls = importRows.map(row => toSiteMediaPath(row.photoRowDraft.url))
  const { data: photos, error } = await fetchPhotosForReview(urls)
  if (error) {
    onError('Could not load the published photos for this batch.')
    setSyncingBatchId(null)
    return
  }
  const updates = (photos || []).flatMap(photo => {
    const row = importRows.find(item => toSiteMediaPath(item.photoRowDraft.url) === photo.url)
    if (!row) return []
    return [{ id: photo.id, thumbnail: toSiteMediaPath(row.photoRowDraft.thumbnail), ... }]
  })
  if (updates.length > 0) {
    const { error: updateError } = await persistPhotoUpdates(updates)
    if (updateError) {
      onError('Could not sync the manifest metadata back into photos.')
      setSyncingBatchId(null)
      return
    }
  }
  await updateMediaReviewBatchStatus(batch.id, 'in_review')
  onSuccess('Manifest category and tag suggestions were synced to the live photos.')
  setSyncingBatchId(null)
}
```

---

### `src/pages/admin/AdminLayout.tsx` (component, request-response)

**Modifications:** Wrap admin routes with `ComponentErrorBoundary`

**Error boundary pattern** (from `ErrorBoundary.tsx` lines 133-157):
```typescript
import { ComponentErrorBoundary } from '@/components/error/ErrorBoundary'

// Add to AdminLayout.tsx routes (around line 108-120):
<Suspense fallback={<AdminPageSkeleton />}>
  <Routes>
    <Route path="review" element={
      <ComponentErrorBoundary componentName="Media Review Panel">
        <MediaReviewPanel />
      </ComponentErrorBoundary>
    } />
    {/* Other routes similarly wrapped */}
  </Routes>
</Suspense>
```

**Analog:** `src/components/error/ErrorBoundary.tsx` lines 133-157 — `ComponentErrorBoundary` with `componentName` prop

---

## Shared Patterns

### Authentication
**Source:** `src/stores/authStore.ts`
**Apply to:** All auth operations (initializeAuth, refreshSession)
```typescript
let authOperationQueue: Promise<void> = Promise.resolve()

const queueAuthOperation = async <T>(fn: () => Promise<T>): Promise<T> => {
  return authOperationQueue.then(fn).catch((error) => {
    console.error('Auth operation failed:', error)
    return undefined as T
  })
}
```

### Error Boundary with Recovery
**Source:** `src/components/error/ErrorBoundary.tsx` lines 133-157
**Apply to:** All admin route components
```typescript
<ComponentErrorBoundary componentName="[Descriptive Name]">
  <TargetComponent />
</ComponentErrorBoundary>
```

### Supabase Client Import
**Source:** `src/lib/supabase.ts` (single export line 23)
**Apply to:** All files that need Supabase client — import from `@/lib/supabase`, never create new client

**security.ts consolidation pattern:**
```typescript
// BEFORE (security.ts lines 1-6):
import { createClient } from '@supabase/supabase-js'
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabase = createClient(...)

// AFTER:
import { supabase } from '@/lib/supabase'
// Remove local supabaseUrl, supabaseKey variables
```

### Face Review State Management
**Source:** `src/components/admin/MediaReviewPanel.tsx` lines 420-438
**Apply to:** New face review components (FaceReviewGrid, FaceTaggingConfirmation)

```typescript
interface FaceDraft {
  reviewStatus: MediaReviewFaceStatus
  confirmedName: string
  personKey: string
  notes: string
}

// Normalize existing face to draft (line 161-169):
function normalizeFaceDraft(face: MediaReviewFace): FaceDraft {
  const confirmedName = face.confirmed_name || ''
  return {
    reviewStatus: face.review_status,
    confirmedName,
    personKey: face.person_key || (confirmedName ? slugifyPerson(confirmedName) : ''),
    notes: face.notes || '',
  }
}

// Check if draft changed from original (lines 171-179):
function draftChanged(face: MediaReviewFace, draft: FaceDraft) {
  const normalized = normalizeFaceDraft(face)
  return (
    normalized.reviewStatus !== draft.reviewStatus ||
    normalized.confirmedName !== draft.confirmedName ||
    normalized.personKey !== draft.personKey ||
    normalized.notes !== draft.notes
  )
}
```

### Status Badge Classes
**Source:** `src/components/admin/MediaReviewPanel.tsx` lines 365-374
**Apply to:** Face review components
```typescript
function getStatusBadgeClasses(status: MediaReviewFaceStatus) {
  switch (status) {
    case 'confirmed':
      return 'border-green-200 bg-green-50 text-green-700'
    case 'ignored':
      return 'border-charcoal-200 bg-charcoal-50 text-charcoal-600'
    default:
      return 'border-gold-200 bg-gold-50 text-gold-700'
  }
}
```

### Vite Console Drop Verification
**Source:** `vite.config.js` line 242 (already configured)
**Apply to:** Build verification only — no code changes needed

```bash
# Verification command (no code changes):
npm run build && grep -r "console\." dist/assets/*.js | wc -l
# Should return 0
```

---

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/stores/authStore.ts` (queue modification) | store | request-response | Modifying existing store — queue pattern from RESEARCH.md |
| N/A | All other files have analogs | | |

---

## Metadata

**Analog search scope:** `src/stores/`, `src/components/`, `src/lib/`, `src/utils/`, `src/pages/admin/`
**Files scanned:** 12
**Pattern extraction date:** 2026-04-23

## Notes

1. **MediaReviewPanel decomposition priority:** The 1716-line component naturally splits at lines 997 (BatchList section start), 1125 (FaceReviewGrid start), 1464 (ClusterMergeModal start). FaceTaggingConfirmation is embedded within ClusterMergeModal's right panel (lines 1580-1691).

2. **State lifting before extraction:** Before extracting sub-components, MediaReviewPanel state (faces, faceDrafts, selectedBatch, etc.) should be lifted to a Zustand store or React Context to avoid prop drilling with 10+ props. The research suggests using Zustand.

3. **security.ts rateLimitMap:** The module-level `rateLimitMap` (security.ts line 20) is mutable state that could cause issues. Consider moving to a service or removing if unused.

4. **security.ts auditLog:** Line 102 already imports supabase via the duplicate client — needs to be changed to import from `@/lib/supabase`.

5. **Auth queue error handling:** The queue pattern catches errors silently (`catch(() => {})`) to prevent one failed operation from breaking the queue. This is intentional — auth state stays consistent.

6. **Console.* verification:** Vite esbuild drop is configured but only applies in production mode. Development builds retain console.* for debugging. Verify with production build grep.