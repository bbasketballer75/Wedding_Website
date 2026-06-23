# Stack Research

**Domain:** Wedding Memory Archive - v3.0 Guest Experience Enhancements
**Researched:** 2026-04-29
**Confidence:** MEDIUM-HIGH (Context7 unavailable for some libraries, using npm/official docs)

## Summary

The v3.0 features require **4 new packages** and **significant Supabase schema changes**. No framework changes needed -- existing React 19 + Supabase + Zustand + Framer Motion stack handles all requirements. JSZip 3.10.1 is already installed for download generation. Main gaps: activity feed infrastructure, guest identity assertion, lightbox zoom gesture handling, and print order integration.

## Recommended Stack

### Core Technologies (No Changes -- Already in Use)

| Technology | Current Version | Status | Notes |
|------------|----------------|--------|-------|
| React | 19.2.4 | Verified | React 19 concurrent features work with all v3.0 features |
| Supabase | 2.99.0 | Verified | PostgreSQL, Auth, Storage, Edge Functions all in use |
| Zustand | 5.0.11 | Verified | activity feed state, claim state, upload queue all fit in existing stores |
| Framer Motion | 12.35.2 | Verified | Lightbox animations, panel transitions already working |
| Tailwind CSS | 4.1.18 | Verified | Via @tailwindcss/vite plugin |
| Vite | 7.3.2 | Verified | Build tool with PWA plugin |
| @tanstack/react-virtual | 3.13.24 | Verified | Gallery virtualization already installed |
| JSZip | 3.10.1 | Verified | Already in dependencies -- download generation covered |
| exifr | 7.1.3 | Verified | Already installed -- EXIF parsing for lightbox display covered |

### NEW Library Additions

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| react-zoom-pan-pinch | 3.1.10 | Lightbox zoom/swipe gestures | Lightweight (~15KB), React 19 compatible, touch gesture support built-in. Replaces manual CSS zoom/drag implementation in PhotoLightbox. |

**Alternative considered:** Implement custom zoom with Framer Motion drag gestures (current approach has limited pinch-zoom). react-zoom-pan-pinch is purpose-built for this use case.

**Installation:** `npm install react-zoom-pan-pinch`

### Print/Photo Book Ordering

| Option | API | Product | Verdict |
|--------|-----|---------|---------|
| Printful | developers.printful.com | No photo books via API | NOT SUITABLE -- jewelry only via API, no print products |
| None (external link) | N/A | Link to Shutterfly/Artifact Uprising | RECOMMENDED -- No API integration complexity; link out to professional services |

**Recommendation:** External link strategy. Create a "Order Prints" button that opens Shutterfly or Artifact Uprising in a new tab with the gallery photos (or a link code). Avoids print fulfillment complexity, PCI compliance, and shipping logistics.

**Why not self-fulfill:** Budget/timeline constraint; print-on-demand has thin margins and complex logistics.

## Feature Stack Breakdown

### Activity Feed (SOCIAL-01, SOCIAL-02)

**Implementation:** Supabase schema + Realtime subscriptions + new Zustand store

**Database schema changes:**
```sql
-- Activity feed entries
CREATE TABLE activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, -- 'upload', 'guestbook', 'reaction', 'comment', 'claim'
  actor_name TEXT NOT NULL, -- display name of person who triggered
  actor_email TEXT, -- for guest identity (not displayed publicly)
  target_type TEXT NOT NULL, -- 'photo', 'guestbook_message', 'comment'
  target_id UUID NOT NULL,
  photo_url TEXT, -- thumbnail for feed display
  metadata JSONB DEFAULT '{}', -- extra context (e.g., claimed photo count)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: Public read for approved activity, authenticated insert for system
ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON activity_feed
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert" ON activity_feed
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
```

**Supabase Realtime subscription:**
```typescript
// In activity feed page component
const channel = supabase
  .channel('activity-feed')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'activity_feed'
  }, (payload) => {
    useActivityStore.getState().prependActivity(payload.new)
  })
  .subscribe()
```

**State management:** New `activityStore.ts` with:
- `activities: Activity[]` -- feed items
- `prependActivity(item)` -- for realtime insertions
- `fetchInitial()` -- paginated load on mount
- `loadMore()` -- pagination for infinite scroll

**No new library needed** -- Supabase Realtime already part of @supabase/supabase-js.

---

### Guest Photo Claiming (SELF-SERVICE-01, SELF-SERVICE-02)

**Implementation:** Email-based identity assertion + upload linking

**Database schema changes:**
```sql
-- Link guest uploads to claimed identity
ALTER TABLE guest_uploads ADD COLUMN claim_token TEXT UNIQUE;
ALTER TABLE guest_uploads ADD COLUMN claim_email TEXT;
ALTER TABLE guest_uploads ADD COLUMN claimed_at TIMESTAMPTZ;

-- Pre-generated claim tokens (admin generates during moderation approval)
-- Token format: 8-char alphanumeric
```

**Identity assertion flow:**
1. Guest provides email on upload form
2. On photo approval, system generates unique claim token
3. Email sent to guest with claim link: `/claim/{token}`
4. Guest visits claim page, verifies email ownership (OTP or magic link)
5. Photo record updated with `claim_email`, `claimed_at`
6. Guest can now download their own photos

**Supabase Auth for claim verification:**
- Use Supabase Magic Link (passwordless email) -- no new library, uses existing auth
- After email verification, query guest_uploads by email to show claimable photos

**New pages/components:**
- `/claim/[token]` -- Claim confirmation page
- `/my-photos` -- Guest's claimed uploads (email-verified view)

**No new library needed** -- Supabase Auth handles identity.

---

### Download Generation (SELF-SERVICE-03)

**Implementation:** JSZip (already installed) + Supabase Storage presigned URLs

**Current state:** PhotoLightbox.tsx has Download button with onDownload prop; JSZip 3.10.1 already in package.json.

**What's needed:**
1. RPC function for batch presigned URL generation (avoids client-side Storage API calls)
2. New `downloadStore.ts` for queue management
3. Client-side zip generation with progress indicator

**Supabase Edge Function for batch URLs:**
```typescript
// supabase/functions/get-download-urls/index.ts
// Input: { photoIds: string[] }
// Output: { urls: { id: string, url: string, filename: string }[] }
// Generates presigned URLs valid for 1 hour
```

**Download flow:**
```typescript
const handleBatchDownload = async (photoIds: string[]) => {
  // 1. Fetch presigned URLs from Edge Function
  const { data } = await supabase.rpc('get_download_urls', { photo_ids: photoIds })

  // 2. Create JSZip instance
  const zip = new JSZip()

  // 3. Fetch each image and add to zip (with progress)
  for (const { id, url, filename } of data.urls) {
    const response = await fetch(url)
    const blob = await response.blob()
    zip.file(filename, blob)
    updateProgress(percent) // report to Zustand store
  }

  // 4. Generate zip blob and trigger download
  const content = await zip.generateAsync({ type: 'blob' })
  saveAs(content, 'wedding-photos.zip')
}
```

**No new library needed** -- JSZip already installed, saveAs from file-saver or use URL.createObjectURL.

**Alternative:** Use client-side only approach (no Edge Function) -- each photo download uses direct Storage URL with RLS-permitted access. Batch download becomes sequential fetch-add-zip.

---

### Lightbox Zoom/Swipe Enhancement (LIGHTBOX-01)

**Library:** react-zoom-pan-pinch 3.1.10

**Current state:** PhotoLightbox.tsx has manual zoom via setZoom state (1-3x) and Framer Motion drag gesture for swipe navigation. Basic but functional.

**Limitation:** No pinch-to-zoom on touch devices; zoom is buttons-only.

**react-zoom-pan-pinch integration:**
```typescript
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'

<TransformWrapper
  initialScale={1}
  minScale={1}
  maxScale={3}
  limitToBounds={false}
  centerOnInit
>
  <TransformComponent>
    <img src={currentPhoto.url} alt={currentPhoto.caption} />
  </TransformComponent>
</TransformWrapper>
```

**Why this library:**
- React 19 compatible (peerDeps: react >=16.8.0 || ^17 || ^18 || ^19)
- Touch gesture support: pinch-zoom, two-finger pan
- Keyboard support built-in
- Customizable toolbar (or hide for minimal UI)
- Does NOT conflict with Framer Motion -- TransformComponent replaces motion.img

**Migration path:**
1. Install react-zoom-pan-pinch
2. Replace `<motion.img>` with `<TransformComponent>` wrapper
3. Keep existing navigation arrows and keyboard handlers
4. Remove manual zoom state (TransformWrapper handles scale internally)
5. Keep face tag overlay positioned relative to transformed image

---

### Print/Photo Book Ordering (SELF-SERVICE-04)

**Recommendation:** External link, no API integration.

**Implementation:**
1. Add "Order Prints" button to lightbox and/or gallery header
2. Link opens new tab to Shutterfly/Artifact Uprising with referral or promo code
3. No deep integration -- guests handle ordering on external site

**Database considerations:** None -- no order data stored locally.

**Alternative considered (NOT recommended for v3.0):**
- Self-built print API integration via Printful -- Printful does not offer photo books via API
- Shutterfly API -- not publicly available for third-party integration

**Deferred for future:** If print sales become a revenue stream, consider:
- SmugMug (has API for print orders)
- Pixieset (wedding-focused, has client gallery + print shop)

---

## Installation

```bash
# Only new dependency
npm install react-zoom-pan-pinch

# No other new packages required
# JSZip 3.10.1 already in package.json
# Supabase features use existing @supabase/supabase-js
```

## Supabase Schema Summary

New tables/columns for v3.0:

| Change | Type | Purpose |
|--------|------|---------|
| `activity_feed` table | NEW | Social activity persistence |
| `guest_uploads.claim_token` | NEW COLUMN | Email claim verification |
| `guest_uploads.claim_email` | NEW COLUMN | Linked identity |
| `guest_uploads.claimed_at` | NEW COLUMN | Claim timestamp |
| `get_download_urls` RPC | NEW FUNCTION | Batch presigned URL generation |
| `log_activity` RPC | NEW FUNCTION | Standardized activity logging |

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|------------------------|
| react-zoom-pan-pinch | Framer Motion drag gestures only | If package size is critical constraint |
| External print links | Printful/API integration | If selling physical products is core business |
| Email-based identity | SMS-based identity | If guests lack email access (not typical for weddings) |
| JSZip client-side | Server-side zip generation | If photos are large (network cost concern) -- serverless zip via Edge Function |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| react-zoom-pan-pinch < 3.0 | Older versions have React 18 dependency only | react-zoom-pan-pinch 3.1.10 (React 19 compatible) |
| any吻 major library for activity feed | Over-engineered for simple feed | Supabase + Zustand (already in stack) |
| Custom drag implementation for zoom | Edge cases (touch, pinch, keyboard) are hard | react-zoom-pan-pinch handles all |
| Printful for photo books | No photo book API | External link to Shutterfly/Artifact Uprising |
| Firebase for activity feed | Extra backend, not needed | Supabase (already in stack) |
| Pusher/Ably for realtime | Extra service subscription | Supabase Realtime (already in stack) |

## Integration Points

### Activity Feed Integration
```
src/stores/activityStore.ts (NEW)
  └── Zustand store with realtime subscription
src/pages/ActivityFeed.tsx (NEW)
  └── Uses useVirtualizer for infinite scroll
supabase/migrations/ (NEW)
  └── activity_feed table + RLS policies
```

### Photo Claiming Integration
```
src/stores/claimStore.ts (NEW)
  └── Manages claim token verification state
src/pages/Claim/[token].tsx (NEW)
  └── Magic link verification flow
src/pages/MyPhotos.tsx (NEW)
  └── Email-verified view of claimed uploads
supabase/functions/ (NEW)
  └── generate-claim-token on upload approval
```

### Download Integration
```
src/stores/downloadStore.ts (NEW)
  └── Queue management, progress tracking
src/hooks/useBatchDownload.ts (NEW)
  └── JSZip orchestration with progress
src/components/gallery/PhotoLightbox.tsx (MODIFY)
  └── Wire onDownload to batch download
supabase/functions/get-download-urls (NEW)
  └── Batch presigned URL generation
```

### Lightbox Enhancement Integration
```
src/components/photo-viewer/PhotoLightbox.tsx (MODIFY)
  └── Replace motion.img with TransformComponent
  └── Keep face tag overlay working
npm install react-zoom-pan-pinch
```

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| React 19.2.x | react-zoom-pan-pinch 3.1.10 | peerDeps: react >=16.8.0 || ^17 || ^18 || ^19, **HIGH confidence** |
| React 19.2.x | JSZip 3.10.1 | Already verified in codebase |
| React 19.2.x | @tanstack/react-virtual 3.13.24 | Already verified in codebase |
| React 19.2.x | Framer Motion 12.35.2 | Already verified in codebase |
| Supabase JS 2.99.x | React 19 | Official Supabase client supports React 19 |
| vite-plugin-pwa 1.2.0 | workbox-window 7.x | peerDeps specify workbox ^7.4.0 |
| Tailwind CSS 4.x | Vite 7.x | Via @tailwindcss/vite plugin |

## Sources

- [react-zoom-pan-pinch npm](https://www.npmjs.com/package/react-zoom-pan-pinch) -- Current version 3.1.10, peerDeps show React 19 support, **HIGH confidence**
- [Printful API documentation](http://developers.printful.com/docs/) -- No photo books via API, only jewelry products supported, **HIGH confidence**
- [JSZip npm](https://www.npmjs.com/package/jszip) -- Current version 3.10.1, already in project, **HIGH confidence**
- [package.json dependencies](file://C:/Users/bbask/Coding_Projects/Wedding_Website_Clean/package.json) -- Current installed versions, **HIGH confidence**
- [PhotoLightbox.tsx](file://C:/Users/bbask/Coding_Projects/Wedding_Website_Clean/src/components/photo-viewer/PhotoLightbox.tsx) -- Current zoom/drag implementation, **HIGH confidence**
- [galleryStore.ts](file://C:/Users/bbask/Coding_Projects/Wedding_Website_Clean/src/stores/galleryStore.ts) -- Existing state management patterns, **HIGH confidence**
- [Supabase schema migrations](file://C:/Users/bbask/Coding_Projects/Wedding_Website_Clean/supabase/migrations/) -- Database structure, **HIGH confidence**
- [Supabase Realtime docs](https://supabase.com/docs/guides/realtime) -- Live activity feed subscriptions, **HIGH confidence**

---
*Stack research for: Wedding Memory Archive v3.0 Guest Experience Enhancements*
*Researched: 2026-04-29*