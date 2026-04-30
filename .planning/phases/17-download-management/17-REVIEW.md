---
status: reviewed
files_reviewed:
  - src/stores/downloadStore.ts
  - src/hooks/useLongPress.ts
  - src/components/gallery/DownloadQueueFAB.tsx
  - src/components/gallery/QueuePanel.tsx
  - src/components/gallery/GalleryCheckbox.tsx
  - src/components/gallery/PhotoGrid.tsx
  - src/components/gallery/components/GalleryHeader.tsx
  - src/utils/download.ts
  - supabase/functions/batch-download/index.ts
critical: 2
warning: 4
info: 5
total: 11
---

# Phase 17 Code Review: Download Management

## Critical

### 1. XSS in QueuePanel.tsx — Unsanitized Caption Rendering
**File:** `src/components/gallery/QueuePanel.tsx`
**Lines:** 68, 71

```tsx
<img
  src={photo.thumbnail || photo.url}
  alt={photo.caption || 'Photo'}  // LINE 68 - XSS
  ...
/>
<span className="flex-1 truncate text-sm text-charcoal-700">
  {photo.caption || photo.id}     // LINE 71 - XSS
</span>
```

**Issue:** `photo.caption` is rendered directly into `alt` attribute and text content without sanitization. A malicious caption containing `<script>` tags or event handlers (e.g., `onload`, `onerror`) would be executed.

**Fix:** Sanitize caption before rendering:
```tsx
import DOMPurify from 'dompurify'
const safeCaption = DOMPurify.sanitize(photo.caption || '', { ALLOWED_TAGS: [] })
```

---

### 2. Edge Function Missing UUID Validation on photo_ids
**File:** `supabase/functions/batch-download/index.ts`
**Lines:** 35-37, 53-57

```typescript
if (!Array.isArray(photo_ids) || photo_ids.length === 0) {
  return jsonResponse({ error: 'photo_ids array required' }, 400)
}
// No UUID format validation here
...
.in('id', photo_ids)  // LINE 56 - passes unvalidated array directly
```

**Issue:** `photo_ids` array is not validated for UUID format before being passed to the Supabase query. Malicious actors could pass non-UUID strings, potentially causing unexpected behavior or bypassing rate limits.

**Fix:** Validate UUID format:
```typescript
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
if (!photo_ids.every(id => uuidRegex.test(id))) {
  return jsonResponse({ error: 'Invalid photo_ids format' }, 400)
}
```

---

## Warning

### 3. Fragile URL Path Extraction in Edge Function
**File:** `supabase/functions/batch-download/index.ts`
**Line:** 68

```typescript
const urlPath = photo.url.split('/storage/v1/object/public/photos/')[1] || photo.url
```

**Issue:** Assumes a specific URL format. If the URL structure changes, extraction will fail silently, potentially extracting wrong paths or falling back to the full URL.

**Fix:** Use URL parsing for robustness:
```typescript
const urlObj = new URL(photo.url)
const urlPath = urlObj.pathname.split('/').pop() || photo.url
```

---

### 4. Missing Authorization Check in Edge Function
**File:** `supabase/functions/batch-download/index.ts`
**Lines:** 27-30, 50

```typescript
const authHeader = request.headers.get('Authorization') ?? ''
if (!authHeader) {
  return jsonResponse({ error: 'Missing Authorization' }, 401)
}
// Only checks header presence, not user permissions for specific photos
const adminClient = createClient(supabaseUrl, serviceRoleKey)
```

**Issue:** The function checks for Authorization header but never validates that the authenticated user has permission to download the specific photos. Uses service role key which bypasses RLS, so any authenticated user can download any photo.

**Fix:** After fetching photos, verify user ownership or access rights before returning signed URLs.

---

### 5. XSS in aria-label Attributes (PhotoGrid.tsx)
**File:** `src/components/gallery/PhotoGrid.tsx`
**Line:** 136

```tsx
aria-label={selectMode
  ? (isSelected ? `Deselect ${photo.caption || 'photo'}` : `Select ${photo.caption || 'photo'}`)
  : (photo.caption ? `Open photo: ${photo.caption}` : 'Open photo')}
```

**Issue:** `photo.caption` interpolated directly into aria-label. While screen readers don't execute JavaScript, these values are still DOM text and could be problematic.

**Fix:** Sanitize caption before use in aria-label (same as QueuePanel fix).

---

### 6. useLongPress Memory Leak — target.current Never Cleared
**File:** `src/hooks/useLongPress.ts`
**Lines:** 20, 30-35

```typescript
const startTimer = useCallback(
  (e: React.MouseEvent | React.TouchEvent) => {
    target.current = e.currentTarget  // Set here
    ...
  },
  [...]
)

const clearTimer = useCallback(() => {
  if (timeout.current) {
    clearTimeout(timeout.current)
    timeout.current = null
    // target.current is NOT cleared here
  }
}, [])
```

**Issue:** `target.current` is set when starting the timer but never cleared. This creates a reference cycle that prevents garbage collection of the DOM element.

**Fix:** Clear target in clearTimer:
```typescript
const clearTimer = useCallback(() => {
  if (timeout.current) {
    clearTimeout(timeout.current)
    timeout.current = null
    target.current = null
  }
}, [])
```

---

## Info

### 7. Weak Filename Sanitization
**File:** `src/utils/download.ts`
**Line:** 95-97

```typescript
function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 50)
}
```

**Issue:** Replaces problematic characters with underscores but doesn't account for path traversal attempts (e.g., `../../etc/passwd`). Also truncates to 50 chars which may cut off legitimate filenames.

**Note:** Currently acceptable since filenames are used within a zip, not written directly to disk. But if implementation changes, this could become a path traversal vector.

---

### 8. Missing Content-Type Validation in downloadFile
**File:** `src/utils/download.ts`
**Lines:** 6-10

```typescript
const response = await fetch(url)
const blob = await response.blob()
// No validation that blob is actually an image
```

**Issue:** No validation that the downloaded content is a valid image type. Could download and execute malicious content if server returns unexpected content-type.

**Note:** Browser security provides some protection, but explicit validation would be safer.

---

### 9. selectMode Handler Missing preventDefault on Enter/Space
**File:** `src/components/gallery/PhotoGrid.tsx`
**Line:** 128-130

```tsx
onKeyDown={(event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()  // preventDefault is called
    selectMode ? onToggleSelect?.(photo.id) : onPhotoClick?.(photo, index)
  }
}}
```

**Note:** Actually has `event.preventDefault()` - no issue here. Ignore this item.

---

### 10. Hardcoded Expiry Time Not Configurable
**File:** `supabase/functions/batch-download/index.ts`
**Lines:** 71, 87

```typescript
.createSignedUrl(urlPath, 3600) // 1 hour expiry
// ...
expires_in: 3600
```

**Issue:** Expiry time (3600 seconds) is hardcoded in two places. If security requirements change, both locations must be updated.

**Note:** Info-level since the hardcoding is consistent across both return locations.

---

### 11. GalleryHeader Tag Rendering — Potential HTML Breakage
**File:** `src/components/gallery/components/GalleryHeader.tsx`
**Lines:** 93-95

```tsx
<option value={tag} className="bg-dark-900">
  {tag}
</option>
```

**Issue:** If a tag contains quote characters (`"`, `'`) or angle brackets, it could break the HTML attribute rendering. Tags from user input should be sanitized.

**Note:** Info-level since tags are likely controlled server-side, but worth validating.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 2 |
| Warning | 4 |
| Info | 5 |

**Most Urgent:** Fix the XSS vulnerability in QueuePanel.tsx (item 1) and add UUID validation to the Edge Function (item 2). Both are exploitable in production.

**Storage Persistence:** The `downloadStore.ts` correctly uses `safeSessionStorage` and properly configures `partialize` to exclude ephemeral state. No issues found there.

**useLongPress:** Timer cleanup is mostly correct, but `target.current` memory leak (item 6) should be fixed.
