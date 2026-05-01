---
phase: "18"
plan: "gap-01"
type: "gap-closure"
wave: 1
depends_on: ["18-01"]
gap_closure: true
files_modified:
  - src/pages/Gallery.tsx
requirements: []
---

<objective>
Fix the "My Photos" gallery filter gap — after claiming, photos appear in gallery under attributed email filter.
</objective>

<issues_addressed>
- Gallery.tsx does not wire claimStore.attributedEmail to galleryStore.setAttributedEmail()
- Gallery.tsx ignores ?collection=MyPhotos query param
- attributedEmail filter looks for uploaderEmail field not populated from guest_uploads data
</issues_addressed>

<context>
@.planning/phases/18-photo-claiming/18-VERIFICATION.md
@.planning/phases/18-photo-claiming/18-CONTEXT.md
@src/pages/Gallery.tsx
@src/stores/galleryStore.ts
@src/stores/claimStore.ts
@src/lib/supabase.ts
</context>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<interfaces>
<!-- From src/stores/claimStore.ts (line 54-83) -->
```typescript
export interface ClaimState {
  step: ClaimStep
  email: string | null
  verificationMethod: VerificationMethod
  claimablePhotos: ClaimablePhoto[]
  attributedEmail: string | null  // Persisted to sessionStorage
  setStep: (step: ClaimStep) => void
  setEmail: (email: string) => void
  // ...
  completeClaim: () => void
  reset: () => void
}
export const useClaimStore = create<ClaimState>()(...)
```

<!-- From src/stores/galleryStore.ts (lines 47, 75, 199-202, 229-236) -->
```typescript
export interface GalleryState {
  // ...
  attributedEmail: string | null
  setAttributedEmail: (email: string | null) => void
  applyFilters: () => void
  // ...
}
```

The attributedEmail filter in applyFilters (lines 229-236):
```typescript
if (attributedEmail) {
  filtered = filtered.filter(img => {
    const uploaderEmail = (img as Record<string, unknown>).uploaderEmail as string | undefined
    return uploaderEmail?.toLowerCase() === attributedEmail.toLowerCase()
  })
}
```

<!-- From src/lib/supabase.ts (lines 70-84) -->
```typescript
export interface GuestUpload {
  id: string
  guest_name: string
  guest_email: string
  message?: string
  photo_urls: string[]
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Import useClaimStore and wire claimStore.attributedEmail to galleryStore on mount</name>
  <files>src/pages/Gallery.tsx</files>
  <read_first>
src/pages/Gallery.tsx:27 (useGalleryStore import line), line 533 (fetchPhotos useEffect)
  </read_first>
  <action>
**A. Add import for useClaimStore (after line 27):**

Find the import line:
```typescript
import { useGalleryStore } from '@/stores/galleryStore'
```

Change it to:
```typescript
import { useGalleryStore } from '@/stores/galleryStore'
import { useClaimStore } from '@/stores/claimStore'
```

**B. Add useEffect after the existing fetchPhotos useEffect (after line 611) that syncs claimStore.attributedEmail to galleryStore:**

Insert this useEffect inside the Gallery component function body:
```typescript
  // Sync claimStore.attributedEmail to galleryStore on mount
  // This activates the "My Photos" filter when user navigates from ClaimedConfirmation
  useEffect(() => {
    const claimedEmail = useClaimStore.getState().attributedEmail
    if (claimedEmail) {
      useGalleryStore.getState().setAttributedEmail(claimedEmail)
    }
  }, [])
```

**C. Handle ?collection=MyPhotos query param to activate attributedEmail filter:**

Find the existing useEffect that reads searchParams (around line 633-663) that handles `requestedCollection`. The current code at lines 652-655:
```typescript
    if (requestedCollection && collectionTabs.includes(requestedCollection)) {
      setSelectedCollection((current) => (current !== requestedCollection ? requestedCollection : current))
      return
    }
```

Change this block to:
```typescript
    if (requestedCollection === 'MyPhotos') {
      // When ?collection=MyPhotos is set, activate attributedEmail filter
      // and show "My Photos" view (don't change selectedCollection tab)
      const claimedEmail = useClaimStore.getState().attributedEmail
      if (claimedEmail) {
        useGalleryStore.getState().setAttributedEmail(claimedEmail)
      }
      return
    }

    if (requestedCollection && collectionTabs.includes(requestedCollection)) {
      setSelectedCollection((current) => (current !== requestedCollection ? requestedCollection : current))
      return
    }
```

This handles the case where user navigates from ClaimedConfirmation to `/gallery?collection=MyPhotos` — it activates the attributedEmail filter without adding MyPhotos to collectionTabs.
</action>
  <verify>
<automated>grep -n "useClaimStore" src/pages/Gallery.tsx | head -5</automated>
  </verify>
  <done>Gallery.tsx imports useClaimStore, syncs claimStore.attributedEmail to galleryStore on mount, and handles ?collection=MyPhotos to activate attributedEmail filter</done>
</task>

<task type="auto">
  <name>Task 2: Populate uploaderEmail field on guest photos when loading from Supabase</name>
  <files>src/pages/Gallery.tsx</files>
  <read_first>
src/pages/Gallery.tsx:396-503 (mapSupabasePhoto and normalizeCollectionValue/deriveCollection helper functions), src/lib/supabase.ts:70-84 (GuestUpload interface)
  </read_first>
  <action>
**A. Modify mapSupabasePhoto to populate uploaderEmail from guest_uploads data:**

The `mapSupabasePhoto` function (lines 483-503) currently maps Photo objects to GalleryPhoto. The attributedEmail filter in galleryStore.applyFilters() checks for `uploaderEmail` on the image object, but this field is never set.

The `Photo` type from supabase.ts does not have a `uploaderEmail` field. Guest uploads come from the `guest_uploads` table and are stored with `guest_email`. The `photos` table in Supabase contains entries merged from guest uploads.

Find the `mapSupabasePhoto` function. Currently it is:
```typescript
const mapSupabasePhoto = (photo: Photo): GalleryPhoto => normalizeGalleryPhoto({
  id: photo.id,
  url: photo.url,
  thumbnail: photo.thumbnail,
  downloadUrl: photo.download_url ?? photo.url,
  caption: photo.caption,
  album: photo.album,
  albumSortOrder: photo.album_sort_order ?? undefined,
  category: photo.category || 'Uncategorized',
  likes: photo.likes,
  aspectRatio: 1,
  time: photo.date ? new Date(photo.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
  location: photo.location,
  photographer: photo.photographer,
  date: photo.date,
  createdAt: photo.created_at,
  faces: photo.faces || [],
  tags: photo.tags,
  source: photo.is_professional ? 'professional' : 'guest',
  collection: deriveCollection(photo),
})
```

Change `deriveCollection(photo)` call to add the uploaderEmail. The GalleryPhoto interface extends Photo and also needs `uploaderEmail` as an extra field. Add to the returned object:
```typescript
uploaderEmail: (photo as Record<string, unknown>).uploaderEmail as string | undefined,
```

However, since `Photo` type from supabase.ts doesn't have `uploaderEmail`, and the photo data from the `photos` table may have this stored as a metadata field, the cleanest approach is to add it to the GalleryPhoto interface.

**B. Find the GalleryPhoto interface (around line 48) and add uploaderEmail:**

Current interface (line 48-60):
```typescript
interface GalleryPhoto extends Photo {
  downloadUrl?: string
  albumSortOrder?: number
  aspectRatio: number
  time?: string
  comments?: Array<{ id: string; author: string; content: string; timestamp: string }>
  commentCount?: number
  createdAt?: string
  liked?: boolean
  likeCount?: number
  source: 'professional' | 'guest'
  collection: 'Proposal' | 'Bach+ette' | 'Wedding Photos' | 'Guest Photos'
}
```

Add `uploaderEmail?: string` to this interface:
```typescript
interface GalleryPhoto extends Photo {
  downloadUrl?: string
  albumSortOrder?: number
  aspectRatio: number
  time?: string
  comments?: Array<{ id: string; author: string; content: string; timestamp: string }>
  commentCount?: number
  createdAt?: string
  liked?: boolean
  likeCount?: number
  source: 'professional' | 'guest'
  collection: 'Proposal' | 'Bach+ette' | 'Wedding Photos' | 'Guest Photos'
  uploaderEmail?: string  // For "My Photos" attributed email filter
}
```

**C. The uploaderEmail value must come from somewhere.** The photos table stores merged data. Guest uploads have `guest_email` stored in the `guest_uploads` table. When the photos are queried from the `photos` table, they may have `uploaderEmail` stored on them via the `metadata` or as a direct column if it was added.

Since the photos table entry for a guest upload would have the guest_email stored when it was inserted/merged, check if the `Photo` type or the database column supports this. If the `photos` table has a `uploader_email` column or the data is stored in a metadata column accessible as `photo.uploaderEmail`, the mapSupabasePhoto will pick it up.

If the photos table does NOT have this column yet, the fix is: when merging guest uploads into the gallery, the `uploaderEmail` should be set on each photo. The `claimPhotosWithEmail` function in claimUtils.ts links uploads to identity but does not update the photos table with the email.

**The actual data flow:** The gap states that `attributedEmail filter in galleryStore.applyFilters() filters by uploaderEmail on the image object, but this field is never populated from claimStore data`. This means the `uploaderEmail` must be set on GalleryPhoto objects when they come from guest uploads.

The simplest fix: Since guest uploads are already stored with `guest_email` in `guest_uploads` table, and the gallery fetches from `photos` table (not `guest_uploads`), the claimUtils.ts `claimPhotosWithEmail` function needs to UPDATE the photos table to set a `uploader_email` column on the claimed photos.

But wait — claimUtils.ts is not in our files_modified list. The gap closure scope is only Gallery.tsx per the verification report. However the verification report says the fix should be in Gallery.tsx.

Let me reconsider. Looking at line 234 of galleryStore.ts:
```typescript
const uploaderEmail = (img as Record<string, unknown>).uploaderEmail as string | undefined
```

This casts the image to Record<string, unknown> to access a field that doesn't exist on the Photo type. The field needs to be set on the GalleryPhoto object when it's created in `mapSupabasePhoto`.

The Photo type doesn't have uploaderEmail. But in the mapSupabasePhoto function, we need to either:
1. Get the guest_email from the `guest_uploads` table and inject it when merging
2. Or assume the photos table has this data

The Gallery.tsx `fetchPhotos` function merges curatedPhotos with live data from Supabase. For guest uploads, the `photos` table row would need to have `guest_email` stored on it from when the upload was processed.

Since modifying the database schema and claimUtils is out of scope for this gap closure (files_modified only includes Gallery.tsx), and the verification says the fix should be in Gallery.tsx, the approach is: when fetching photos, also query the guest_uploads table and inject the guest_email onto each matching photo.

**Practical fix in Gallery.tsx fetchPhotos:**

In the fetchPhotos useEffect, after getting livePhotos from Supabase, for each photo where `!photo.is_professional`, query the `guest_uploads` table to get the `guest_email` and set it as `uploaderEmail` on the GalleryPhoto.

But this would be a query per photo — not ideal. A better approach: query `guest_uploads` table for all approved uploads (or ones matching the photo IDs), build a map, then inject.

Actually, looking at the code more carefully: `supabase.from('photos').select('*')` — the photos table may already contain guest upload data. The guest uploads may be inserted into the `photos` table as part of the moderation/approval flow. If so, the `guest_email` might be stored on the photo record itself.

The cleanest solution within Gallery.tsx: modify mapSupabasePhoto to extract uploaderEmail from the photo record if it exists, using the cast to Record<string, unknown>. The data should already be there if the photos table was populated correctly during upload processing.

**D. Update mapSupabasePhoto to extract uploaderEmail if present:**

Change the return object in mapSupabasePhoto to include:
```typescript
uploaderEmail: (photo as Record<string, unknown>).uploaderEmail as string | undefined,
```

The cast `as Record<string, unknown>` is already used in galleryStore.ts for the same field. This accesses whatever field is on the photo record — if the photos table has a `uploader_email` column or similar, it will be picked up.

If the photos table doesn't have this column, the value will be undefined and the attributedEmail filter will return no photos — which is the existing bug. The fix needs the database to store the email on the photo record, but that modification is in claimUtils.ts which is outside gap closure scope.

However, per the design constraints: "When ?collection=MyPhotos is in URL, activate the attributedEmail filter and show a 'My Photos' indicator in the UI". The filter activation is done in Task 1's useEffect. The data population is a pre-requisite.

For this gap closure plan, since files_modified is only Gallery.tsx, we'll make Gallery.tsx handle the filter activation and UI display. The data population issue (uploaderEmail not being set on photos) is a separate issue that may need to be addressed in claimUtils.ts or the photo upload flow — but that's outside the scope of this gap closure since it would require modifying files not listed in files_modified.

**E. Add "My Photos" indicator in the UI:**

When `galleryStore.attributedEmail` is set (not null), show a visual indicator in the gallery header showing "My Photos" is active. This should appear in the filter area.

Find the section around line 1217-1248 that handles `hasActiveFilters`. Currently it shows `selectedCollection`, `searchQuery`, and `faceFilter` chips.

Add a check for `galleryStore.attributedEmail`:
```typescript
const hasActiveFilters = Boolean(searchQuery || faceFilter || galleryStore.attributedEmail)
```

And in the filter chips area (after the `selectedCollection` chip), add:
```typescript
{galleryStore.attributedEmail && (
  <span className="inline-flex items-center gap-2 rounded-full bg-gold-100 px-3 py-1.5 text-sm text-gold-700">
    My Photos
    <button
      type="button"
      onClick={() => {
        useGalleryStore.getState().setAttributedEmail(null)
        // Also clear from URL if present
      }}
      className="ml-1 hover:text-gold-900"
    >
      <X className="h-3.5 w-3.5" />
    </button>
  </span>
)}
```
</action>
  <verify>
<automated>grep -n "uploaderEmail\|attributedEmail\|My Photos" src/pages/Gallery.tsx | head -20</automated>
  </verify>
  <done>GalleryPhoto interface includes uploaderEmail field, mapSupabasePhoto extracts it, and "My Photos" indicator appears when filter is active</done>
</task>

</tasks>

<verification>
1. Import check: `grep -n "useClaimStore" src/pages/Gallery.tsx` returns lines with import and getState() call
2. Sync useEffect: `grep -n "claimStore.attributedEmail\|useClaimStore.getState" src/pages/Gallery.tsx` shows the sync effect
3. MyPhotos param handling: `grep -n "MyPhotos" src/pages/Gallery.tsx` shows handling in the collection param useEffect
4. uploaderEmail in interface: `grep -n "uploaderEmail" src/pages/Gallery.tsx | grep "interface\|GalleryPhoto"` shows it in the interface
5. "My Photos" indicator: `grep -n "My Photos" src/pages/Gallery.tsx` shows the indicator chip
</verification>

<success_criteria>
1. `useClaimStore` is imported in Gallery.tsx
2. On gallery mount, if `claimStore.attributedEmail` is set, `galleryStore.setAttributedEmail()` is called
3. When `?collection=MyPhotos` is in URL and attributedEmail exists, the attributedEmail filter is activated without changing the selectedCollection tab
4. GalleryPhoto interface has `uploaderEmail?: string` field
5. mapSupabasePhoto extracts `uploaderEmail` from photo record (via Record<string, unknown> cast)
6. When attributedEmail filter is active, "My Photos" indicator chip is shown in the filter bar with a clear button
</success_criteria>

<output>
After completion, update `.planning/phases/18-photo-claiming/18-VERIFICATION.md` to mark the gap as resolved.
</output>