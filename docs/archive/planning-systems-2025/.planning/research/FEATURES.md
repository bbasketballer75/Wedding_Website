# Feature Research

**Domain:** Wedding Photo Archive - Guest Experience Enhancements (v3.0)
**Researched:** 2026-04-29
**Confidence:** MEDIUM

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Activity Feed** | Guests want to see what others have contributed — new uploads, guestbook entries, featured moments | MEDIUM | Existing guest uploads + guestbook exist; need feed aggregation + UI |
| **Download Photos** | Users expect to save favorite photos, especially their own guest uploads | MEDIUM | Download button exists in lightbox; needs batch/multi-select + queue management |
| **Lightbox Zoom** | Mobile photo viewing standard — pinch to zoom on phone | LOW | Zoom buttons exist; pinch-to-zoom not wired to `useTouchGestures` hook |
| **Lightbox Swipe Navigation** | Mobile photo browsing convention — swipe left/right to navigate | LOW | Framer Motion drag exists for swipe-to-navigate but threshold behavior could be improved |
| **Photo Info Display** | EXIF, date, location — contextual photo metadata | LOW | Time/date display exists in lightbox; EXIF extraction not implemented |
| **Guest Upload Status** | After uploading, guests want to see if/when their photos appear | LOW | Status check exists via email lookup; could be more discoverable |
| **Social Proof** | "12 guests contributed photos" — shows community participation | LOW | Could surface upload count from `guest_uploads` stats |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Photo Claiming** | Guests can claim photos they're in — "That's me!" engagement | MEDIUM | Requires face-data-to-upload linking; face tagging infrastructure exists (media_review_faces, photo_faces) |
| **Shared Album Links** | Guests share their contribution collection — "Look at all my photos from the day!" | MEDIUM | Needs per-uploader view, unique shareable link generation |
| **Download Management** | Queue, progress, zip for multiple photos — premium feel | MEDIUM | No existing infrastructure; needs S3 signed URL generation + client-side zip |
| **Print/Photo Book Ordering** | Direct ordering removes friction — "Order a print" from lightbox | HIGH | Third-party integration required (Artifact, Printful, or white-label); payment + fulfillment complexity |
| **Activity Feed Filtering** | "Show only photos" or "Show only guestbook" — personalized feed | LOW | Depends on activity feed implementation |
| **Comment Threading** | Nested replies on photo comments — conversational feel | LOW | Single-level comments exist; threading requires schema + UI changes |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Real-time Activity Feed** | "I want to see uploads appear instantly" | Supabase Realtime at scale costs money, complexity, and creates notification fatigue | Poll-based feed with refresh button; "New activity" banner when updates exist |
| **Download Original Quality** | "I want the full-res photo" | Storage costs, bandwidth, no quality control, guests sharing originals defeats archive purpose | Provide optimized high-quality (4K) but not raw original; set expectations upfront |
| **Auto Face Recognition** | "Automatically tag everyone in photos" | Requires ML infrastructure, accuracy issues, privacy concerns | Keep manual face tagging as admin workflow; guests claim from confirmed faces |
| **Unlimited Downloads** | "Download whatever I want" | Bandwidth costs, no sense of scarcity/value, potential abuse | Implement reasonable limits (e.g., 50 downloads) or album-based limits |
| **Public Comment Moderation** | "Let guests moderate comments" | Complexity, abuse potential, inconsistent experience | Keep admin-only moderation; guests can report via existing system |

## Feature Dependencies

```
[Activity Feed]
    └──requires──> [Guest Uploads] (already exists)
                       └──requires──> [Guest Upload Moderation] (already exists)
    └──requires──> [Guestbook Messages] (already exists)
    └──requires──> [Site Editorial Features] (already exists)

[Photo Claiming]
    └──requires──> [Face-tagged People Gallery] (already exists)
    └──enhances──> [Face Recognition Infrastructure] (already exists in admin)

[Download Management]
    └──requires──> [Photo Selection] (already exists via galleryStore)
    └──requires──> [Signed URL Generation] (RPC function)

[Lightbox Enhancement]
    └──enhances──> [Existing PhotoLightbox] (already exists)
    └──uses──────> [useTouchGestures] (already exists, not fully wired)

[Print/Photo Book Ordering]
    └──conflicts──> [Download Original Quality] (both give away full asset)
    └──requires──> [Third-party Integration] (external service)
```

### Dependency Notes

- **Activity Feed requires Guest Uploads + Guestbook Messages:** Feed aggregates existing data; no new infrastructure needed beyond aggregation + display
- **Photo Claiming enhances Face Recognition:** Guests select from confirmed face clusters; claim creates association between guest identity and face cluster
- **Download Management requires Photo Selection:** Multi-select already exists in galleryStore; extend to download queue
- **Lightbox Enhancement uses existing infrastructure:** useTouchGestures has pinch zoom but not wired to PhotoLightbox zoom state
- **Print/Photo Book conflicts with unlimited downloads:** Both give away asset access; print ordering provides business model to offset storage costs

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [ ] **Activity Feed** — Aggregate recent uploads, guestbook entries, featured moments into chronological feed. Simple infinite scroll, refresh button.
- [ ] **Lightbox Pinch-to-Zoom** — Wire existing `useTouchGestures` hook to PhotoLightbox zoom state. Mobile-optimized.
- [ ] **Download Queue** — Multi-select photos in gallery, add to download queue, batch generate signed URLs, progress indicator.
- [ ] **Guest Upload Status Page Enhancement** — Make status check more visible; link from upload confirmation screen.

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] **Photo Claiming** — Guest identifies themselves from face clusters; claim links guest_upload to photo_faces. Moderate before surfacing.
- [ ] **Shared Album Links** — Per-guest view of their contributions with shareable link.
- [ ] **Photo Info/EXIF Display** — Extract and display date, time, camera from photo metadata.
- [ ] **Activity Feed Filtering** — Toggle between All/Photos/Guestbook/Moments.

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Print/Photo Book Ordering** — Third-party integration (Artifact, Printful). Requires payment, fulfillment, customer service.
- [ ] **Comment Threading** — Nested replies. Schema change + UI complexity.
- [ ] **Social Sharing Notifications** — "Your photo was shared 5 times" — notification infrastructure.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Activity Feed | HIGH | MEDIUM | P1 |
| Lightbox Pinch-to-Zoom | MEDIUM | LOW | P1 |
| Download Queue | MEDIUM | MEDIUM | P1 |
| Guest Upload Status Enhancement | MEDIUM | LOW | P2 |
| Photo Claiming | HIGH | MEDIUM | P2 |
| Shared Album Links | MEDIUM | MEDIUM | P2 |
| Photo Info/EXIF Display | LOW | LOW | P2 |
| Activity Feed Filtering | LOW | LOW | P2 |
| Print/Photo Book Ordering | MEDIUM | HIGH | P3 |
| Comment Threading | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Detailed Feature Behavior

### Activity Feed

**Expected behavior:**
- Chronological feed of recent activity: new guest uploads, guestbook messages, featured moments
- Each entry shows: type icon, contributor name, thumbnail (for photos), timestamp, content preview
- Infinite scroll or "Load more" pagination
- Refresh button to check for new activity
- Optional: "New activity" banner appears when new items exist (click to load)

**Implementation approach:**
- New `activity_feed_entries` view or RPC that aggregates from `guest_uploads` (approved), `guestbook_messages`, `site_editorial_features`
- Order by `created_at` descending, limit 20 per page
- Feed component with card-style entries
- Types: photo_upload, guestbook_entry, featured_moment, anniversary_note

**Edge cases:**
- Empty feed: Show friendly "No activity yet" state
- Feed with only one type: Graceful handling when no uploads exist yet
- Guest uploads pending: Don't show until approved (moderation gate)

**Existing infrastructure:**
- `fetchApprovedGuestUploads()` returns `GuestUpload[]` with `photo_urls`, `guest_name`, `created_at`
- `guestbook_messages` table exists with `name`, `content`, `created_at`
- `site_editorial_features` has slots for featured content

### Lightbox Pinch-to-Zoom

**Expected behavior:**
- On mobile: Two-finger pinch gesture zooms in/out on photo
- Zoom level persists during session (swiping to next photo resets to 1x)
- Double-tap to toggle between 1x and 2x zoom
- Zoom range: 1x to 3x, in 0.25 increments
- Smooth animation on zoom change

**Current state:**
- PhotoLightbox has zoom state (`useState(1)`) and +/- buttons
- `useTouchGestures` hook has `onPinch` callback with scale factor
- NOT connected: PhotoLightbox doesn't wire `onPinch` to `setZoom`

**Implementation:**
- Wire `onPinch={(scale, e) => setZoom(z => Math.min(Math.max(z * scale, 1), 3))}` in PhotoLightbox
- Consider debouncing to prevent jittery zoom
- On double-tap: toggle between 1x and 2x

### Lightbox Swipe Navigation

**Expected behavior:**
- Swipe left: Go to next photo
- Swipe right: Go to previous photo
- Horizontal drag with velocity detection (fast swipe = navigate)
- Threshold: ~50px offset + velocity check (already in PhotoLightbox lines 249-252)
- Visual feedback during drag (slight parallax effect)

**Current state:**
- Framer Motion `drag="x"` with `dragConstraints`, `dragElastic`
- `onDragEnd` checks offset.x thresholds and velocity
- Logic: `if (info.offset.x < -50 && info.velocity.x < -80) handleNext()`

**Edge cases:**
- At first photo: swipe right does nothing (disabled state)
- At last photo: swipe left does nothing (disabled state)
- Zoom > 1x: Disable swipe navigation (use pan instead for zoomed view)

### Download Queue

**Expected behavior:**
- In gallery: Select multiple photos via long-press or checkbox mode
- "Add to Download" button appears when photos selected
- Queue panel shows selected photos with remove option
- "Download All" generates signed URLs, zips, triggers browser download
- Progress indicator during zip generation + download
- Manage queue: clear all, remove individual items

**Implementation:**
- New Zustand store slice for download queue: `downloadQueue: string[]` (photo IDs)
- Multi-select mode in gallery: toggle via long-press or dedicated checkbox toggle
- Download flow:
  1. Call RPC to batch-generate signed URLs for selected photos
  2. Client-side JSZip combines images
  3. Trigger download with zip filename
- Signed URL expiry: 1 hour (use `createSignedUrl`)

**Edge cases:**
- Large queue (20+ photos): Show warning about download size/time
- Network failure during download: Retry button per item
- Download of deleted/removed photo: Graceful error message

**Known challenges:**
- JSZip memory usage for large batches; consider Web Workers
- Browser download size limits (varies by browser)

### Photo Claiming

**Expected behavior:**
- Guest visits "People" gallery or clicks face tag in lightbox
- Sees face cluster with "Is this you?" prompt
- Confirms identity (name entry or email verification)
- Admin receives claim request, approves/rejects
- Approved claim links guest_upload to photo_faces
- Guest can then see "Photos of me" collection

**Implementation:**
- New `guest_claimed_faces` table: `guest_upload_id`, `face_id`, `status: pending|approved|rejected`, `claimed_by_email`
- Claiming flow UI: Face cluster detail → "Claim these photos" → email/guest name entry
- Admin moderation: See claim requests in MediaReviewPanel
- Approved claims surface guest's face tag across photos

**Existing infrastructure:**
- `media_review_faces` table has `confirmed_name`, `person_key`
- `photo_faces` in Photo type has `id`, `name`, `x`, `y`, `box`
- `guest_uploads` links to guest identity (email, name)

**Edge cases:**
- Multiple guests claim same face: Admin resolves conflict
- Face already has confirmed name: Still allow claim but link to existing name

### Guest Upload Status Enhancement

**Expected behavior:**
- After upload: Confirmation screen with clear "What's next" messaging
- "Check your status" input prominently placed
- Status shows: pending review → approved (with link to gallery) or rejected (with reason)
- Email notification when status changes (already exists conceptually)

**Current state:**
- `fetchGuestUploadStatus(email)` exists in supabase.ts
- Shows "pending review" on success screen

**Enhancement:**
- Make status check input more prominent (Upload page, success screen)
- Show status history: "Submitted on X, reviewed on Y"
- If rejected: Show reason + option to resubmit

### Shared Album Links

**Expected behavior:**
- Guest can view all their contributions (uploads, guestbook entries)
- Get shareable link: `theporadas.com/guest/{unique_token}`
- Link shows: Guest name, photo grid of their uploads, guestbook messages
- Public view (no login required)

**Implementation:**
- Generate unique token per guest on first upload (hash of email + secret)
- Store in `guest_share_tokens` table: `guest_email`, `token`, `created_at`
- New `/guest/:token` route renders shared album view
- Filter `guest_uploads` by email where token matches

**Edge cases:**
- Guest with no approved uploads: Show "No photos yet" state
- Token expired or revoked: Show "Link no longer valid" page

### Photo Info/EXIF Display

**Expected behavior:**
- In lightbox info panel: Show date, time, camera model (if available)
- EXIF data extracted from photo metadata on upload
- Fallback: Date from photo filename or upload timestamp

**Current state:**
- PhotoLightbox shows `currentPhoto.time` and `currentPhoto.date` (lines 436-448)
- `Site` column in photos table may have location data

**Implementation:**
- On photo upload: Extract EXIF using exifr or similar library
- Store in `photo_metadata` JSONB column or individual columns
- Display in info panel: Camera, Lens, ISO, Aperture, Shutter Speed, Location

### Activity Feed Filtering

**Expected behavior:**
- Toggle buttons: All | Photos | Guestbook | Moments
- Filter updates feed without page reload
- Selection persists during session

**Implementation:**
- Add `filter: 'all' | 'photos' | 'guestbook' | 'moments'` state
- RPC query filters based on type
- Instant UI update (optimistic)

## Existing Infrastructure Analysis

### Already Implemented (v1/v2)

From codebase audit:

- **Gallery Store** (`src/stores/galleryStore.ts`): Pagination, filtering, selection state, sessionStorage persistence, lightbox modal state, image navigation
- **PhotoLightbox** (`src/components/photo-viewer/PhotoLightbox.tsx`): Zoom buttons (0.5 increments, 0.5-3 range), face tags, comments, likes, share, download button, info panel with tabs, Framer Motion drag swipe navigation, keyboard navigation
- **useTouchGestures** (`src/hooks/useTouchGestures.ts`): Pinch zoom + swipe callbacks already implemented but not connected to PhotoLightbox
- **Supabase Schema**: `guest_uploads` (status, guest_name, email), `photos` (faces, likes, comments), `site_editorial_features` (editorial slots), `moderation_audit_log`
- **Photo Types** (`src/lib/supabase.ts`): `Photo`, `GuestUpload`, `PhotoFace`, `PhotoCommentRecord` all defined

### Gaps to Fill

| Gap | What's Needed |
|-----|---------------|
| Activity Feed | New `activity_feed_entries` table + RPC to aggregate + new page component |
| Pinch-to-Zoom | Connect `onPinch` from `useTouchGestures` to `setZoom` in PhotoLightbox |
| Download Queue | `download_queue` table or client state + batch signed URL RPC + JSZip integration |
| Photo Claiming | Link guest_upload to face cluster via new `guest_claimed_photos` table + claiming flow UI |
| Shared Album Links | Generate unique token per guest + filter guest_uploads by email/token |

## Competitor Feature Analysis

| Feature | Google Photos | Apple Photos | Our Approach |
|---------|---------------|--------------|---------------|
| Activity Feed | "Assistant" tab with automatic creations | Memories + Shared albums | Simple chronological aggregation by type (photos, guestbook, moments) |
| Download Management | "Save to device" per photo or bulk | Export original or optimized | Multi-select + queue + signed URL batch; optimized (not original) quality |
| Photo Claiming | Face clustering auto-tags | People album with manual confirm | Guests claim from confirmed face clusters; admin approves before surfacing |
| Print Ordering | "Print Store" partnership | "Order Prints" integration | Defer; high complexity, requires payment infrastructure |
| Lightbox Gestures | Pinch zoom + swipe navigation | Pinch zoom + swipe navigation | Wire existing useTouchGestures to PhotoLightbox |

## Sources

- Existing PhotoLightbox.tsx with zoom implementation (lines 58, 193-207)
- Existing useTouchGestures.ts with pinch zoom (lines 88-97)
- Existing galleryStore.ts with selection + modal state
- Existing supabase.ts types: Photo, GuestUpload, PhotoFace
- Industry standard: Google Photos, Apple Photos gesture patterns
- Wedding platforms: WithJoy feature analysis
- Print ordering: Artifact, Printful integration patterns

---
*Feature research for: v3.0 Guest Experience Enhancements*
*Researched: 2026-04-29*