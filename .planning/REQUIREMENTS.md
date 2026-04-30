# Requirements: v3.0 Guest Experience Enhancements

**Milestone:** v3.0
**Created:** 2026-04-30
**Total Requirements:** 13
**Phases:** 5 (15-19, continuing from v2.0 phase 14)

## Categories

| Category | Description | Requirements |
|----------|-------------|--------------|
| SOC | Social Features (Activity Feed) | SOC-01, SOC-02, SOC-03 |
| LB | Lightbox Enhancement | LB-01, LB-02, LB-03, LB-04 |
| DL | Download Management | DL-01, DL-02, DL-03 |
| SC | Self-Service (Claiming & Sharing) | SC-01, SC-02, SC-03 |
| PR | Print Ordering | PR-01 |

---

## Category: Social Features (SOC)

### SOC-01: Activity Feed Page

**User can:** View a chronological feed of recent activity on the site — new guest photo uploads (when approved), guestbook messages, and featured moments.

**Implementation:**
- New `/activity` route with `ActivityFeedPage` lazy-loaded
- Feed aggregates from `guest_uploads` (status='approved'), `guestbook_messages`, `site_editorial_features`
- Chronological order by `created_at` DESC, paginated (20 items per page)
- Infinite scroll with "Load more" button
- Each entry shows: type icon, contributor name, thumbnail (for photos), timestamp
- Feed types: `photo_upload`, `guestbook_entry`, `featured_moment`
- Empty state: friendly "No activity yet" message

**Success criteria:**
- [ ] Activity feed page renders at `/activity`
- [ ] Shows approved guest uploads in chronological order
- [ ] Shows guestbook messages in chronological order
- [ ] Pagination works (load more shows next 20)
- [ ] Empty state displays when no activity exists

---

### SOC-02: Activity Feed Realtime Updates

**User can:** See new activity appear in the feed without refreshing the page.

**Implementation:**
- Supabase Realtime subscription on `activity_log` table
- New activity prepends to top of feed with "New activity" banner
- Banner click loads new items without scrolling
- Unsubscribe on page unmount

**Success criteria:**
- [ ] New guest upload appears in feed within 5 seconds of approval
- [ ] "New activity" banner appears when new items arrive
- [ ] No duplicate entries or memory leaks on unmount

---

### SOC-03: Activity Feed Filtering

**User can:** Filter the activity feed to show only specific types of activity.

**Implementation:**
- Filter toggle buttons: All | Photos | Guestbook | Moments
- Active filter persists during session
- Filter is client-side (no additional fetch needed — feed loaded fully)

**Success criteria:**
- [ ] Filter buttons render above feed
- [ ] "Photos" filter shows only photo uploads
- [ ] "Guestbook" filter shows only guestbook entries
- [ ] "All" shows everything
- [ ] Active filter visually indicated

---

## Category: Lightbox Enhancement (LB)

### LB-01: Pinch-to-Zoom on Mobile

**User can:** Pinch to zoom on photos in the lightbox on touch devices.

**Implementation:**
- Wire existing `useTouchGestures` hook `onPinch` callback to PhotoLightbox `setZoom` state
- On pinch: `setZoom(z => Math.min(Math.max(z * scale, 1), 3))`
- Zoom range: 1x to 3x
- Smooth animation on zoom change via Framer Motion
- Double-tap to toggle between 1x and 2x

**Success criteria:**
- [ ] Pinch gesture on mobile zooms photo in lightbox
- [ ] Zoom range is 1x to 3x
- [ ] Double-tap toggles between 1x and 2x
- [ ] Zoom persists when swiping to next/previous photo (resets to 1x)

---

### LB-02: Swipe Navigation Refinement

**User can:** Swipe left/right to navigate photos in the lightbox with improved threshold handling.

**Implementation:**
- Horizontal drag with velocity detection (already exists, threshold may need tuning)
- Threshold: ~50px offset + velocity check
- When zoomed > 1x: Disable swipe navigation (use pan instead)
- Visual feedback during drag (slight parallax effect)

**Success criteria:**
- [ ] Swipe left navigates to next photo
- [ ] Swipe right navigates to previous photo
- [ ] At first/last photo, swipe in that direction does nothing
- [ ] When zoomed > 1x, swipe pans instead of navigating

---

### LB-03: EXIF Display in Lightbox

**User can:** View photo metadata (date, time, camera info) in the lightbox info panel.

**Implementation:**
- Extract EXIF using `exifr` (already installed) on photo load
- Display in info panel: Date taken, Camera model (if available)
- Fallback to photo `time`/`date` fields if EXIF unavailable
- New `photo_metadata` JSONB column on photos table (populate on upload)

**Success criteria:**
- [ ] Info panel shows "Date taken" from EXIF or fallback
- [ ] Info panel shows "Camera" if metadata available
- [ ] Graceful fallback when EXIF is unavailable

---

### LB-04: Download Button in Lightbox

**User can:** Download the currently viewing photo directly from the lightbox.

**Implementation:**
- Add download button to lightbox toolbar (already has share button)
- Single photo download via signed URL (no zip)
- Filename: `{photo-id}.{extension}`

**Success criteria:**
- [ ] Download button visible in lightbox toolbar
- [ ] Clicking downloads current photo at high quality
- [ ] Filename is descriptive (photo ID + extension)

---

## Category: Download Management (DL)

### DL-01: Multi-Select Download Queue

**User can:** Select multiple photos in the gallery and add them to a download queue.

**Implementation:**
- Gallery multi-select mode: toggle via long-press or checkbox toggle in gallery header
- Selected photos stored in new `downloadStore` (Zustand)
- "Add to Download" button appears when photos selected
- Queue panel shows selected photos with remove option
- "Download All" button triggers batch download

**Success criteria:**
- [ ] Long-press or checkbox selects multiple photos
- [ ] Selected count shown in header
- [ ] "Add to Download" button appears with selection
- [ ] Queue panel accessible and shows selected items
- [ ] Can remove individual items from queue

---

### DL-02: Batch Download with Progress

**User can:** Download multiple photos as a zip file with progress indicator.

**Implementation:**
- RPC `get_download_urls({ photo_ids: string[] })` generates batch signed URLs
- Client-side JSZip (already installed) combines images
- Progress indicator: "Preparing... 3 of 12 photos"
- Trigger browser download with zip file
- Signed URL expiry: 1 hour

**Edge cases:**
- Large batch (>20 photos): Use Edge Function for zip generation to avoid client memory issues
- Network failure: Retry button per item

**Success criteria:**
- [ ] "Download All" generates zip file
- [ ] Progress indicator shows during preparation
- [ ] Browser download triggers with correct zip file
- [ ] Files named descriptively in zip

---

### DL-03: Download Queue Persistence

**User can:** Return to the gallery and find their download queue intact.

**Implementation:**
- `downloadStore` persists to sessionStorage (not localStorage — no File objects)
- On page reload, restore queue from sessionStorage
- Queue shows count badge if items exist

**Success criteria:**
- [ ] Page reload preserves download queue
- [ ] Queue badge shows count of items
- [ ] Can continue adding to queue after reload

---

## Category: Self-Service (SC)

### SC-01: Photo Claiming via Email

**User can:** Claim photos they uploaded by verifying their email address.

**Implementation:**
- "Claim My Photos" entry point on Guest Uploads page
- Guest enters email used during upload
- System queries `guest_uploads` by `guest_email`
- If matches found, show claimable photos
- Claim creates `guest_identity` record + links via `photo_claims` table
- Email verification via Supabase Magic Link before claim is finalized

**Database:**
```sql
CREATE TABLE guest_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  session_id TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE photo_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id TEXT NOT NULL,
  guest_identity_id UUID REFERENCES guest_identities(id),
  claimed_at TIMESTAMPTZ DEFAULT now()
);
```

**Success criteria:**
- [ ] "Claim My Photos" button visible on Guest Uploads page
- [ ] Email entry shows matching uploads (if any)
- [ ] Magic Link email sent for verification
- [ ] After verification, photos linked to guest identity
- [ ] Guest can view "Photos of me" collection

---

### SC-02: Photo Claiming via Face Clusters

**User can:** Claim photos they're in by confirming from face clusters in the People gallery.

**Implementation:**
- People gallery shows face clusters with "Is this you?" prompt
- Guest enters name or email to claim
- Admin moderation: claim requests appear in MediaReviewPanel
- Approved claims link `guest_uploads` to `photo_faces` via `guest_identity`
- Claimed photos surface across the gallery with guest name

**Success criteria:**
- [ ] Face cluster shows "Claim these photos" option
- [ ] Claim request appears in admin moderation
- [ ] Admin approves/rejects claim
- [ ] Approved claim links guest to face cluster
- [ ] Guest name appears on tagged photos

---

### SC-03: Shared Album Links

**User can:** Share a link to view all of their contributions (uploads + guestbook messages).

**Implementation:**
- Generate unique share token per guest on first upload
- Store in `guest_share_tokens` table: `guest_email`, `token`, `created_at`
- New `/guest/:token` route renders shared album view
- Filter `guest_uploads` and `guestbook_messages` by email where token matches
- Public view (no login required)

**Database:**
```sql
CREATE TABLE guest_share_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Success criteria:**
- [ ] Share button generates unique link
- [ ] `/guest/:token` page renders guest's uploads and guestbook entries
- [ ] Page is public (no login required)
- [ ] Invalid/expired token shows friendly error

---

## Category: Print Ordering (PR)

### PR-01: Print Ordering Redirect

**User can:** Order prints or a photo book of photos from the gallery.

**Implementation:**
- "Order Prints" button in lightbox and/or gallery header
- Opens new tab to Shutterfly or Artifact Uprising with selected photos
- No internal payment/fulfillment — external provider handles everything
- Vendor preference (Shutterfly vs Artifact Uprising) configured via environment variable or config

**Success criteria:**
- [ ] "Order Prints" button visible in lightbox
- [ ] Clicking opens print provider in new tab
- [ ] No internal order tracking needed
- [ ] Graceful degradation if no vendor configured

---

## Out of Scope

Explicitly excluded from v3.0:

| Excluded | Reason |
|----------|--------|
| Push notifications | Email on approval is sufficient |
| Real-time reactions | Optimistic updates preferred over realtime complexity |
| Photo comments/tagging | People gallery with face tags already exists |
| In-app payment processing | External redirect avoids PCI compliance |
| Unlimited download original quality | Provide optimized high-quality, set expectations |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SOC-01 | 15 | — |
| SOC-02 | 15 | — |
| SOC-03 | 15 | — |
| LB-01 | 16 | — |
| LB-02 | 16 | — |
| LB-03 | 16 | — |
| LB-04 | 16 | — |
| DL-01 | 17 | — |
| DL-02 | 17 | — |
| DL-03 | 17 | — |
| SC-01 | 18 | — |
| SC-02 | 18 | — |
| SC-03 | 19 | — |
| PR-01 | 19 | — |

---
*Requirements for: v3.0 Guest Experience Enhancements*
*Created: 2026-04-30*