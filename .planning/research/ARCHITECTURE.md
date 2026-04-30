# Architecture Research

**Domain:** Wedding archive guest experience enhancements (activity feeds, photo claiming, download management, print ordering)
**Researched:** 2026-04-29
**Confidence:** MEDIUM

## Executive Summary

The existing React + Supabase architecture provides a solid foundation for v3.0 guest experience enhancements. Activity feeds build on existing Supabase Realtime subscriptions already configured. Photo claiming requires a new guest identity layer linking uploads to session-based or email-based identifiers. Download management leverages Supabase Storage signed URLs (already used in `createMediaReviewArtifactSignedUrl`). Print ordering is best handled by external fulfillment APIs, with the site acting as a curation and referral layer.

**Key findings:**
- Activity feed uses Supabase Realtime (already configured) + new `activity_log` table
- Photo claiming extends existing `GuestUpload` type with email-based identity linking
- Download uses existing signed URL pattern from `supabase.ts` line 772-779
- Print ordering is a redirect pattern to external providers (no PCI/logistics complexity)
- Lightbox enhancement wraps existing photo grid with zoom/swipe/EXIF layer

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        UI Layer (React)                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ActivityFeed│ │ClaimModal│ │DownloadBtn│ │PrintOrder│   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
│       │             │             │             │           │
├───────┴─────────────┴─────────────┴─────────────┴──────────┤
│                   State Management (Zustand)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │activityStore│ │claimStore│  │downloadStore│ │printStore│ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
└───────┴─────────────┴─────────────┴─────────────┴──────────┘
│                        Service Layer                          │
│  ┌─────────────────┐  ┌─────────────────────────────────┐   │
│  │supabase.ts      │  │PhotoService (download/print)    │   │
│  │(extended)       │  │ClaimService (identity linking)   │   │
│  └────────┬────────┘  └──────────────┬──────────────────┘   │
│           │                          │                        │
├───────────┴──────────────────────────┴──────────────────────┤
│                    Data Layer (Supabase)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │guest_uploads│ │photos    │  │activity_log│ │print_orders│ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Supabase Storage (R2/S3)                   │ │
│  │  wedding-gallery/  guest-uploads/  prints/             │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Integration with Existing Architecture

### What Reuses Existing Patterns

**Supabase Client (`src/lib/supabase.ts`):**
- Already configured with realtime enabled (`eventsPerSecond: 10`)
- `createMediaReviewArtifactSignedUrl` at line 772-779 shows signed URL pattern for storage
- Photo type already defined with `download_url?: string | null` field

**Zustand Stores:**
- Pattern: `create()` with `devtools`, `persist` middleware already established
- Session-based identity can use `safeSessionStorage` pattern from galleryStore

**Auth Store (`src/stores/authStore.ts`):**
- `authOperationQueue` serialization pattern can be reused for claim operations
- Session ID tracking for anonymous user identity

### What Is New

| Component | Type | Purpose | Location |
|-----------|------|---------|----------|
| `activityStore` | New Zustand store | Activity feed state, realtime subscriptions | `src/stores/` |
| `claimStore` | New Zustand store | Photo claiming, guest identity linking | `src/stores/` |
| `downloadStore` | New Zustand store | Download queue, progress tracking | `src/stores/` |
| `ActivityFeedPage` | New page | Social features round 2, new route | `src/pages/` |
| `PhotoClaimModal` | New component | Claim interface | `src/components/gallery/` |
| `DownloadManager` | New component | Batch download handling | `src/components/gallery/` |
| `PrintOrderPanel` | New component | Print/photo book ordering | `src/components/gallery/` |
| `LightboxEnhancement` | Modified component | Zoom, swipe, EXIF | `src/components/gallery/` |

## New Data Flows

### Activity Feed Data Flow

```
[Supabase Realtime Channel]
    │
    ├── Photos: INSERT on 'photos' table (after moderation approval)
    ├── Guest Uploads: INSERT on 'guest_uploads' (when status='approved')
    ├── Guestbook: INSERT on 'guestbook_messages'
    └── Photo Likes: INSERT on 'photo_likes'
    │
    ▼
[activityStore.subscribe()] ← Zustand subscribes to realtime channels
    │
    ▼
[UI Components] ← Store state drives ActivityFeed rendering
```

**Database table needed:**
```sql
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type TEXT NOT NULL, -- 'photo_uploaded', 'upload_approved', 'guestbook_message', 'photo_liked'
  entity_type TEXT NOT NULL, -- 'photo', 'guest_upload', 'guestbook_message'
  entity_id TEXT,
  actor_session_id TEXT, -- anonymous guests tracked by session
  actor_name TEXT, -- 'Austin & Jordyn's Wedding' for guests, or guest name
  metadata JSONB, -- {photo_url, thumbnail, album, etc.}
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX idx_activity_log_activity_type ON activity_log(activity_type);
```

**RPC function for activity logging:**
```sql
CREATE OR REPLACE FUNCTION log_activity(
  p_activity_type TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT DEFAULT NULL,
  p_actor_session_id TEXT DEFAULT NULL,
  p_actor_name TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO activity_log (activity_type, entity_type, entity_id, actor_session_id, actor_name, metadata)
  VALUES (p_activity_type, p_entity_type, p_entity_id, p_actor_session_id, p_actor_name, p_metadata)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Photo Claiming Data Flow

```
[Guest clicks "Claim Photos" on their upload]
    │
    ▼
[ClaimModal: Enter email used during upload]
    │
    ▼
[claimStore.verifyOwnership(email)] → Supabase query
    │
    ├── Matches found → Show claimable photos
    │   │
    │   ▼
    │   [Guest selects photos → Confirm claim]
    │       │
    │       ▼
    │   [Create guest_identity record if not exists]
    │       │
    │       ▼
    │   [Link selected guest_uploads to guest_identity]
    │       │
    │       ▼
    │   [Return success, update gallery UI]
    │       │
    └── No matches → Show "No uploads found for this email"
```

**Database tables needed:**
```sql
CREATE TABLE guest_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  session_id TEXT, -- links to photo_likes session_id for identity continuity
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE photo_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id TEXT NOT NULL, -- references photos.id
  guest_identity_id UUID REFERENCES guest_identities(id),
  claimed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_photo_claims_guest_identity ON photo_claims(guest_identity_id);
CREATE INDEX idx_guest_identities_email ON guest_identities(email);
CREATE INDEX idx_guest_identities_session ON guest_identities(session_id);
```

### Download Management Data Flow

```
[Guest clicks "Download" or "Download All" on photo(s)]
    │
    ▼
[downloadStore.queueDownload(photoIds)]
    │
    ▼
[DownloadButton shows progress overlay]
    │
    ├── Single download:
    │   └── supabase.storage.from('wedding-gallery').createSignedUrl(path, 60)
    │       └── Window.open(signedUrl)
    │
    └── Batch download:
        ├── Create temporary zip in edge function OR
        ├── Stream multiple signed URLs with client-side zip
        └── Show "Preparing download..." → "Downloading 3 of 12..."
```

**Signed URL generation (existing pattern in supabase.ts line 772-779):**
```typescript
export async function createPhotoDownloadUrl(photoKey: string, expiresInSeconds = 60) {
  return await supabase.storage
    .from('wedding-gallery')
    .createSignedUrl(photoKey, expiresInSeconds)
}
```

### Print Ordering Data Flow

```
[Guest clicks "Order Prints" on photo(s)]
    │
    ▼
[PrintOrderPanel: Shows available print products]
    │
    ├── Product selection (4x6, 8x10, canvas, photo book)
    ├── Quantity per product
    └── "Continue to Checkout" button
    │
    ▼
[Submit order → Create print_order record]
    │
    ▼
[Redirect to third-party print API with photo URLs]
    │
    └── Print provider handles payment, fulfillment, shipping
```

**Print ordering is fundamentally a redirect to external service.** The site should:
1. Generate a share link or cart with the selected photos
2. Open the print provider's site with photo URLs pre-loaded
3. Let the provider handle payment and fulfillment

## Recommended Project Structure

```
src/
├── stores/
│   ├── activityStore.ts    # NEW - Activity feed state + realtime
│   ├── claimStore.ts      # NEW - Photo claiming + guest identity
│   ├── downloadStore.ts   # NEW - Download queue + progress
│   └── printStore.ts      # NEW - Print order state
├── services/
│   ├── activityService.ts # NEW - Activity logging RPC calls
│   ├── claimService.ts    # NEW - Claim verification + linking
│   └── printService.ts   # NEW - Print provider API integration
├── pages/
│   └── ActivityFeed.tsx   # NEW - Activity feed page
├── components/
│   ├── activity/
│   │   ├── ActivityFeed.tsx
│   │   ├── ActivityFeedItem.tsx
│   │   └── ActivityFilters.tsx
│   ├── gallery/
│   │   ├── PhotoClaimModal.tsx   # NEW
│   │   ├── ClaimedPhotosGrid.tsx # Reuses PhotoGrid
│   │   ├── DownloadManager.tsx   # NEW
│   │   ├── DownloadButton.tsx    # Extends existing share/download
│   │   └── LightboxEnhancement.tsx # Wraps existing lightbox
│   └── print/
│       ├── PrintOrderPanel.tsx
│       └── PrintProductCard.tsx
```

## New Store Patterns

### activityStore

```typescript
interface ActivityItem {
  id: string
  type: 'photo_uploaded' | 'upload_approved' | 'guestbook_message' | 'photo_liked'
  entityId?: string
  actorName: string
  metadata: Record<string, unknown>
  createdAt: string
}

interface ActivityState {
  items: ActivityItem[]
  isLoading: boolean
  hasMore: boolean
  subscribeToRealtime: () => void
  unsubscribeFromRealtime: () => void
  fetchMore: () => Promise<void>
}
```

### claimStore

```typescript
interface ClaimState {
  identity: GuestIdentity | null
  claimedPhotos: Photo[]

  isModalOpen: boolean
  claimablePhotos: GuestUpload[]

  lookupByEmail: (email: string) => Promise<GuestUpload[]>
  claimPhotos: (uploadIds: string[]) => Promise<void>
  linkIdentity: (email: string, sessionId: string) => Promise<void>
}
```

### downloadStore

```typescript
interface DownloadItem {
  photoId: string
  url: string
  status: 'pending' | 'preparing' | 'downloading' | 'complete' | 'error'
  progress: number
  error?: string
}

interface DownloadState {
  queue: DownloadItem[]
  isPreparing: boolean

  addToQueue: (photoIds: string[]) => void
  removeFromQueue: (photoId: string) => void
  startDownload: () => Promise<void>
}
```

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `ActivityFeed` | Render activity stream | `activityStore` |
| `ActivityFeedItem` | Single activity entry | `activityStore`, `Photo` type |
| `PhotoClaimModal` | Email lookup + claim flow | `claimStore`, `guest_uploads` |
| `ClaimedPhotosGrid` | Display guest's claimed photos | `claimStore`, `PhotoGrid` |
| `DownloadButton` | Single/batch download trigger | `downloadStore` |
| `DownloadProgress` | Per-file and batch progress | `downloadStore` |
| `PrintOrderPanel` | Product selection + submit | External print API |
| `LightboxEnhancement` (wrapper) | Zoom, swipe, EXIF layer | Existing lightbox |

## Database Schema Changes

### New Tables

```sql
-- Activity log for social features
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  actor_session_id TEXT,
  actor_name TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Guest identity for claiming
CREATE TABLE guest_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  session_id TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Photo claims linking uploads to identity
CREATE TABLE photo_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id TEXT NOT NULL,
  guest_identity_id UUID REFERENCES guest_identities(id),
  claimed_at TIMESTAMPTZ DEFAULT now()
);

-- Print orders
CREATE TABLE print_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_identity_id UUID REFERENCES guest_identities(id),
  items JSONB NOT NULL,
  status TEXT DEFAULT 'pending',
  external_order_id TEXT,
  total_cost DECIMAL(10,2),
  shipping_address JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Existing Tables Extended

| Table | New Columns | Purpose |
|-------|-------------|---------|
| `guest_uploads` | Already has `guest_email` | Email lookup for claiming |
| `photos` | `download_url` (already exists) | Signed download URL generation |
| `site_editorial_features` | (already exists) | Activity could feature new uploads |

### RLS Policies

| Table | Public Read | Authenticated Write | Admin Write |
|-------|-------------|-------------------|------------|
| `activity_log` | Yes (recent items) | INSERT only | Full |
| `guest_identities` | No | Own record only | Full |
| `photo_claims` | SELECT for own identity | Own identity | Full |
| `print_orders` | No | Own record only | Full |

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing File Objects in localStorage for Resume

**What people do:** Attempting to persist `File` objects from upload queue to localStorage for resume capability.

**Why it's wrong:** `File` objects are not JSON-serializable. They'll throw errors or silently fail.

**Do this instead:** Store only metadata (filename, size, fingerprint) and prompt user to re-select files on page reload.

---

### Anti-Pattern 2: Polling for Activity Updates Instead of Realtime

**What people do:** Setting up `setInterval` to poll Supabase every 30 seconds for new activity.

**Why it's wrong:** Wastes bandwidth, increases Supabase usage costs, and delays updates by polling interval.

**Do this instead:** Use Supabase Realtime subscriptions (already configured in the client).

---

### Anti-Pattern 3: Blocking Download UI During Large Batch Preparation

**What people do:** Showing a spinner that never updates while generating a large zip.

**Why it's wrong:** User assumes it's frozen, no feedback on progress.

**Do this instead:** For large batches, generate zip asynchronously via Edge Function, provide job ID for status polling, and show "We'll email you when ready."

---

### Anti-Pattern 4: Implementing Full E-commerce for Print Ordering

**What people do:** Building full shopping cart, payment processing, inventory management, and shipping logistics.

**Why it's wrong:** Wedding photo print ordering is a small, infrequent transaction. E-commerce complexity dwarfs the value.

**Do this instead:** Redirect to third-party print provider. Pass photo URLs as share links. Let them handle everything else.

---

### Anti-Pattern 5: Storing Activity in Same Table as Photos

**What people do:** Adding an `activity_type` column to the photos table to track "new" status.

**Why it's wrong:** Activity feeds need timeline ordering across multiple entity types. Can't query "all recent activity" efficiently.

**Do this instead:** Separate `activity_log` table with `entity_type` for polymorphic activity.

## Scaling Considerations

| Scale | Activity Feed | Downloads | Print Ordering |
|-------|--------------|-----------|----------------|
| 0-1k users | Realtime subscriptions sufficient | Client-side JSZip fine | Redirect to external |
| 1k-10k users | Pagination needed, consider activity pruning | Edge Function for large zip | External provider |
| 10k+ users | Archive old activity to separate table | Pre-computed zip URLs | External provider |

### Scaling Priorities

1. **First bottleneck: Activity feed explosion** - Guests upload photos, each generates multiple activity entries. Prune activity older than 90 days.
2. **Second bottleneck: Large batch downloads** - Client-side zip hits memory limits at ~50 photos. Move to Edge Function at that threshold.
3. **Third bottleneck: Print ordering volume** - External provider absorbs this; no internal scaling needed.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Print provider (Printful, etc.) | REST API with OAuth | Redirect flow with photo URLs as parameters |
| Photo zoom library | npm package | `react-zoom-pinch-pan` or similar |

### Internal Boundaries

| Boundary | Communication | Notes |
|---------|---------------|-------|
| `activityStore` | `supabase.ts` RPC calls | Activity logging at data layer |
| `claimStore` | `guest_uploads` SELECT + UPSERT | Email lookup, identity linking |
| `downloadStore` | `supabase.storage` `createSignedUrl()` | Existing pattern, new callers |
| `PrintOrderPanel` | External API fetch redirect | No Supabase involvement after order creation |

## Build Order Recommendation

1. **Phase 1: Activity Feed foundation**
   - Create `activity_log` table + RLS
   - Create `activityStore` with realtime subscription
   - Create `ActivityFeedPage`
   - Wire `guest_uploads` approval to log activity

2. **Phase 2: Photo Claiming**
   - Create `guest_identities` and `photo_claims` tables + RLS
   - Create `claimStore`
   - Create `PhotoClaimModal`
   - Add "Claim My Photos" entry point on Guest Uploads page

3. **Phase 3: Download Management**
   - Extend `downloadStore` with batch download logic
   - Create `DownloadButton` with progress UI
   - For large batches: create Edge Function zip handler

4. **Phase 4: Lightbox Enhancement**
   - Extend existing lightbox with zoom/swipe/EXIF
   - Add download button to lightbox
   - Integrate with `downloadStore`

5. **Phase 5: Print Ordering** (lowest priority)
   - Create `print_orders` table
   - Create `printStore` and `PrintOrderPanel`
   - Integrate with print provider redirect

## Sources

- Existing codebase: `src/lib/supabase.ts`, `src/stores/galleryStore.ts`, `src/stores/authStore.ts`, `src/components/gallery/PhotoGrid.tsx`, `src/components/gallery/VirtualizedPhotoGrid.tsx`
- Supabase Storage signed URL pattern (line 772-779 in supabase.ts)
- Existing `photo_likes` and `photo_comments` schema (`20260315000200_photo_engagement.sql`)
- Existing `GuestUpload` type with `guest_name`, `guest_email`, `photo_urls`, `status` fields
- Zustand patterns from existing stores
- Project requirements: `.planning/REQUIREMENTS.md` v3.0 Guest Experience Enhancements

---
*Architecture research for: v3.0 guest experience enhancements*
*Researched: 2026-04-29*
