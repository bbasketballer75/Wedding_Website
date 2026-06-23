# Phase 5: Social Sharing & Upload Resume - Pattern Map

**Mapped:** 2026-04-25
**Files analyzed:** 6
**Analogs found:** 5 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/share/ShareModal.tsx` | component | request-response | `src/components/share/ShareModal.tsx` (self) | exact |
| `src/components/photo-viewer/PhotoLightbox.tsx` | component | request-response | `src/components/photo-viewer/PhotoLightbox.tsx` (self) | exact |
| `src/components/seo/SEOHead.tsx` | component | request-response | `src/components/seo/SEOHead.tsx` (self) | exact |
| `src/pages/Gallery.tsx` | page | request-response | `src/pages/Gallery.tsx` (self) | exact |
| `src/pages/Upload.tsx` | page | CRUD | `src/pages/Upload.tsx` (self) | exact |
| `src/utils/storage.ts` | utility | request-response | `src/utils/storage.ts` (self) | exact |

## Pattern Assignments

### `src/components/share/ShareModal.tsx` (component, request-response)

**Status:** Already fully implemented with photo-specific props.

**Interface** (lines 8-15):
```typescript
interface ShareModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  description?: string
  url?: string
  imageUrl?: string
}
```

**Usage from PhotoLightbox** (PhotoLightbox.tsx lines 518-524):
```typescript
<ShareModal
  isOpen={shareModalOpen}
  onClose={() => setShareModalOpen(false)}
  title={currentPhoto?.caption || "Wedding Photo"}
  description="Check out this beautiful moment from Austin & Jordyn's wedding!"
  imageUrl={currentPhoto?.url}
/>
```

**Copy Link pattern** (lines 51-55):
```typescript
onClick: async () => {
  await navigator.clipboard.writeText(url)
  setCopied(true)
  setTimeout(() => setCopied(false), 2000)
},
```

**Native Share API pattern** (lines 160-175):
```typescript
{typeof navigator !== 'undefined' && navigator.share && (
  <Button
    variant="secondary"
    className="w-full mt-4"
    onClick={() => {
      navigator.share({
        title,
        text: description,
        url,
      })
    }}
  >
    <Share2 className="w-4 h-4 mr-2" />
    More Options
  </Button>
)}
```

---

### `src/components/photo-viewer/PhotoLightbox.tsx` (component, request-response)

**Status:** Already wires ShareModal with photo-specific props.

**Share button in toolbar** (lines 342-353):
```typescript
<button
  onClick={(e) => {
    e.stopPropagation()
    onShare?.(currentPhoto.id)
    setShareModalOpen(true)
  }}
  type="button"
  aria-label="Share photo"
  className="flex min-h-11 items-center gap-2 px-3 py-2 bg-white/10 text-white/80 rounded-full hover:bg-white/20 transition-colors"
>
  <Share2 className="w-5 h-5" />
</button>
```

**ShareModal wiring** (lines 518-524):
```typescript
<ShareModal
  isOpen={shareModalOpen}
  onClose={() => setShareModalOpen(false)}
  title={currentPhoto?.caption || "Wedding Photo"}
  description="Check out this beautiful moment from Austin & Jordyn's wedding!"
  imageUrl={currentPhoto?.url}
/>
```

**Pattern to follow for adding `?shared=` URL**: When opening ShareModal, update URL with `?shared=` param using `window.history.pushState` so shared URL reflects the photo being viewed.

---

### `src/components/seo/SEOHead.tsx` (component, request-response)

**Status:** GallerySEO already accepts `shareImage` prop for dynamic OG tags.

**GallerySEO with shareImage** (lines 222-241):
```typescript
export function GallerySEO({ shareImage }: { shareImage?: string }) {
  return (
    <SEOHead
      title={shareImage ? "Shared Wedding Photos" : "Photo Gallery"}
      description={
        shareImage
          ? "Check out these wedding photos from Austin & Jordyn's special day."
          : "Browse our wedding photos and share your own. A collection of memories from our special day."
      }
      canonical="/gallery"
      image={shareImage ?? DEFAULT_SOCIAL_IMAGE}
      structuredData={{
        '@context': 'https://schema.org',
        '@type': 'ImageGallery',
        name: 'Wedding Photo Gallery',
        description: 'A collection of wedding portraits, candids, and guest photos from Austin and Jordyn's wedding.',
      }}
    />
  )
}
```

**Runtime meta tag update pattern** (useEffect lines 70-150):
```typescript
useEffect(() => {
  // Helper to update or create meta tag
  const updateMeta = (name: string, content: string, property = false) => {
    const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`
    let meta = document.querySelector(selector) as HTMLMetaElement

    if (!meta) {
      meta = document.createElement('meta')
      if (property) {
        meta.setAttribute('property', name)
      } else {
        meta.setAttribute('name', name)
      }
      document.head.appendChild(meta)
    }

    meta.content = content
  }

  updateMeta('og:image', fullImageUrl, true)
  // ...
}, [fullTitle, description, fullImageUrl, ...])
```

**Pattern for dynamic OG from ?shared=**: Add Supabase fetch in GallerySEO to resolve photo URL from `?shared=` param, then pass to `shareImage` prop.

---

### `src/pages/Gallery.tsx` (page, request-response)

**Status:** Already detects `?share=` param. Need to add `?shared=` detection for SOC-02.

**Current ?share= detection** (lines 997-1000):
```typescript
const shareParam = searchParams.get('share')
const shareImageUrl = shareParam
  ? photos.find((p) => p.id === shareParam.split(',')[0])?.thumbnail
  : undefined

return (
  <div className="min-h-screen bg-cream-50 pt-24 pb-20">
    <GallerySEO shareImage={shareImageUrl} />
```

**Pattern for ?shared= param detection** (add alongside existing share detection):
```typescript
// Add at line ~609 where requestedShare is read
const requestedShared = searchParams.get('shared')

// Add useState for shared photo metadata
const [sharedPhotoMeta, setSharedPhotoMeta] = useState<{ url: string; caption?: string } | null>(null)

// Add effect to fetch shared photo metadata
useEffect(() => {
  if (!requestedShared) return

  const fetchSharedPhoto = async () => {
    // Fetch photo by ID from Supabase
    const { data } = await supabase
      .from('photos')
      .select('url, caption')
      .eq('id', requestedShared)
      .single()

    if (data) {
      setSharedPhotoMeta({ url: data.url, caption: data.caption })
    }
  }

  fetchSharedPhoto()
}, [requestedShared])
```

**Pattern for auto-opening lightbox with shared photo** (add in existing lightbox effect around line 679):
```typescript
// Modify existing effect to handle ?shared= lightbox opening
useEffect(() => {
  const requestedPhotoId = searchParams.get('photo')
  const sharedParam = searchParams.get('shared')

  if (!isLoading) {
    // Handle ?shared= param
    if (sharedParam && photos.length > 0) {
      const photoIndex = photos.findIndex((photo) => photo.id === sharedParam)
      if (photoIndex >= 0 && lightboxIndex !== photoIndex) {
        setLightboxIndex(photoIndex)
        useGalleryStore.getState().openImageModal(photoIndex)
      }
    }
    // Handle ?photo= param
    else if (requestedPhotoId) {
      const photoIndex = filteredPhotos.findIndex((photo) => photo.id === requestedPhotoId)
      if (photoIndex >= 0 && lightboxIndex !== photoIndex) {
        setLightboxIndex(photoIndex)
      }
    }
  }
}, [isLoading, lightboxIndex, searchParams, photos])
```

---

### `src/pages/Upload.tsx` (page, CRUD)

**Status:** Already has `buildFileFingerprint` function. Need to add localStorage persistence layer.

**Existing fingerprint function** (lines 83-99):
```typescript
async function buildFileFingerprint(file: File) {
  const fallback = `fallback:${file.name}:${file.size}:${file.lastModified}`

  try {
    if (!crypto?.subtle) {
      return fallback
    }

    const buffer = await file.arrayBuffer()
    const digest = await crypto.subtle.digest('SHA-256', buffer)
    const bytes = Array.from(new Uint8Array(digest))
    const hex = bytes.map((value) => value.toString(16).padStart(2, '0')).join('')
    return `sha256:${hex}`
  } catch {
    return fallback
  }
}
```

**Existing UploadingFile interface** (lines 44-52):
```typescript
interface UploadingFile {
  id: string
  file: File
  status: 'uploading' | 'complete' | 'error'
  preview?: string
  publicUrl?: string
  errorMessage?: string
  progress?: number
}
```

**Pattern for localStorage persistence** (add new interface and functions):

```typescript
// New interface for stored metadata (without File object)
interface StoredUploadMetadata {
  id: string
  name: string
  type: string
  size: number
  fingerprint: string
  preview: string        // Base64 data URL
  status: 'uploading' | 'paused' | 'error'
  progress?: number
  createdAt: number
}

const UPLOAD_QUEUE_KEY = 'wedding-upload-queue'

// Save queue to localStorage (call after any files state change)
const saveUploadQueue = (files: UploadingFile[]) => {
  const toStore: StoredUploadMetadata[] = files
    .filter(f => f.status !== 'complete')  // Don't persist completed uploads
    .map(f => ({
      id: f.id,
      name: f.file.name,
      type: f.file.type,
      size: f.file.size,
      fingerprint: buildFileFingerprintSync(`${f.file.name}:${f.file.size}:${f.file.lastModified}`),
      preview: f.preview || '',
      status: f.status === 'uploading' ? 'paused' : f.status,
      progress: f.progress,
      createdAt: Date.now(),
    }))

  storage.setJSON(UPLOAD_QUEUE_KEY, toStore)
}

// Load queue from localStorage on mount
const loadUploadQueue = (): StoredUploadMetadata[] => {
  return storage.getJSON<UStoredUploadMetadata[]>(UPLOAD_QUEUE_KEY, []) || []
}

// Resume upload by fingerprint match
const findMatchingUpload = (fingerprint: string, storedQueue: StoredUploadMetadata[]): StoredUploadMetadata | null => {
  return storedQueue.find(u => u.fingerprint === fingerprint) || null
}
```

**Pattern for showing resumed uploads in queue UI** (UI-SPEC section 2.3):

```typescript
// In the file card rendering, check if it's a resumed upload
{file.status === 'paused' && (
  <div className="border-l-2 border-gold-400">
    <div className="inline-flex items-center gap-2 rounded-full border border-gold-400/40 bg-gold-500/10 px-3 py-1.5 text-xs font-medium text-gold-300">
      <RefreshCw className="h-3.5 w-3.5" />
      Resume to continue
    </div>
    <button
      type="button"
      onClick={() => resumeUpload(file.id)}
      className="inline-flex items-center gap-2 rounded-full border border-gold-400/40 bg-gold-500/10 px-3 py-1.5 text-xs font-medium text-gold-300 hover:bg-gold-500/20 transition-colors"
    >
      <RefreshCw className="h-3.5 w-3.5" />
      Resume
    </button>
  </div>
)}
```

**Pattern for deduplication on file re-selection** (add in addFiles function):

```typescript
const addFiles = useCallback((newFiles: File[]) => {
  // Load stored queue for fingerprint matching
  const storedQueue = loadUploadQueue()
  const storedFingerprints = new Set(storedQueue.map(u => u.fingerprint))

  const validFiles = newFiles.filter(async file => {
    const fingerprint = await buildFileFingerprint(file)

    // Check against current batch
    if (batchFingerprints.has(fingerprint)) {
      notices.push(`${file.name} was already in the queue, so the duplicate was skipped.`)
      return false
    }

    // Check against stored queue (for resume)
    if (storedFingerprints.has(fingerprint)) {
      notices.push(`${file.name} is already being uploaded — it will resume automatically.`)
      return false
    }

    batchFingerprints.add(fingerprint)
    return true
  })
  // ... rest of function
}, [files, uploadFileToR2])
```

---

### `src/utils/storage.ts` (utility, request-response)

**Status:** Already exists with all needed methods.

**Existing methods to use** (lines 72-91):
```typescript
// Get JSON object with fallback
getJSON<T = any>(key: string, defaultValue: T | null = null): T | null

// Set JSON object with fallback
setJSON<T = any>(key: string, value: T): boolean
```

**Usage pattern for Upload queue**:
```typescript
import storage from '@/utils/storage'

// Save
storage.setJSON('wedding-upload-queue', uploadMetadataArray)

// Load
const stored = storage.getJSON<StoredUploadMetadata[]>('wedding-upload-queue', [])
```

---

## Shared Patterns

### Runtime OG Tag Updates
**Source:** `src/components/seo/SEOHead.tsx` (useEffect lines 70-150)
**Apply to:** GallerySEO when handling `?shared=` param

```typescript
useEffect(() => {
  const updateMeta = (name: string, content: string, property = false) => {
    const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`
    let meta = document.querySelector(selector) as HTMLMetaElement

    if (!meta) {
      meta = document.createElement('meta')
      if (property) {
        meta.setAttribute('property', name)
      } else {
        meta.setAttribute('name', name)
      }
      document.head.appendChild(meta)
    }

    meta.content = content
  }

  // Update og:image, og:title, og:description dynamically
  updateMeta('og:image', shareImageUrl, true)
  updateMeta('og:title', 'Shared Wedding Photos', true)
}, [shareImageUrl])
```

### localStorage with Error Handling
**Source:** `src/utils/storage.ts` (lines 1-94)
**Apply to:** Upload queue persistence

```typescript
import storage from '@/utils/storage'

// Graceful degradation when localStorage unavailable
const saved = storage.getJSON<StoredUploadMetadata[]>('wedding-upload-queue', [])
if (saved === null) {
  // localStorage unavailable, continue without persistence
}
```

### Zustand Store State Updates
**Source:** `src/stores/galleryStore.ts` (lines 235-256)
**Apply to:** Lightbox openImageModal with shared photo index

```typescript
// Pattern for opening lightbox to specific photo
const openLightboxToPhoto = (photoId: string) => {
  const photoIndex = photos.findIndex(p => p.id === photoId)
  if (photoIndex >= 0) {
    useGalleryStore.getState().openImageModal(photoIndex)
  }
}
```

---

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/pages/Upload.tsx` (localStorage persistence) | page | CRUD | New feature — existing Upload.tsx has buildFileFingerprint but needs new persistence layer |

---

## Metadata

**Analog search scope:** `src/components/share/`, `src/components/photo-viewer/`, `src/components/seo/`, `src/pages/`, `src/utils/storage.ts`, `src/stores/`
**Files scanned:** 8
**Pattern extraction date:** 2026-04-25

## Key Findings

1. **ShareModal already fully implemented** with title, description, url, imageUrl props. PhotoLightbox already wires it correctly.

2. **GallerySEO already accepts shareImage prop** and updates OG tags dynamically. Gallery.tsx passes `shareImage` from `?share=` param.

3. **Main work needed for SOC-02**: Gallery.tsx needs to also detect `?shared=` param (different from `?share=`), fetch photo metadata from Supabase, and pass to GallerySEO's shareImage prop.

4. **Upload.tsx persistence**: Use storage.ts getJSON/setJSON. Store metadata without File object (preview as data URL). Key: `wedding-upload-queue`.

5. **Resume mechanism**: Fingerprint-based matching when guest re-selects file. Full file re-upload (server handles deduplication via fingerprint).