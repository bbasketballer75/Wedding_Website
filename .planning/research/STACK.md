# Stack Research

**Domain:** Wedding Memory Archive Website - v1.1 Feature Expansion
**Researched:** 2026-04-24
**Confidence:** HIGH

## Summary

This project already has a solid foundation: React 19, Supabase, Zustand, Framer Motion, and Tailwind CSS v4. The v1.1 features require **only ONE new library** (@tanstack/react-virtual for gallery virtualization). Everything else leverages existing infrastructure or can be implemented with Supabase schema changes.

## Recommended Stack

### Core Technologies (Already in Use - No Changes Needed)

| Technology | Current Version | Status | Notes |
|------------|----------------|--------|-------|
| React | 19.2.4 | Verified | React 19's concurrent features work well with virtualization |
| Supabase | 2.99.0 | Verified | PostgreSQL, Auth, Storage, Edge Functions all in use |
| Zustand | 5.0.11 | Verified | galleryStore already handles caching/sessionStorage |
| Framer Motion | 12.35.2 | Verified | Excellent for modal/lightbox animations |
| Tailwind CSS | 4.1.18 | Verified | Via @tailwindcss/vite plugin |
| Vite | 7.3.2 | Verified | Build tool with PWA plugin |
| vite-plugin-pwa | 1.2.0 | Verified | Already configured, just needs workbox enhancements |
| react-router-dom | 7.13.1 | Verified | Lazy-loaded routes working |

### NEW Library Addition

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| @tanstack/react-virtual | 3.13.24 | Gallery virtualization | Headless (works with any layout), React 19 compatible, only ~7KB, no masonry layout conflicts |

**Installation:** `npm install @tanstack/react-virtual`

## Feature Stack Breakdown

### Gallery Virtualization (GALLERY-05)

**Library:** @tanstack/react-virtual 3.13.24

**Recommendation:** Wrap existing `react-masonry-css` with `@tanstack/react-virtual` for columns-based virtualization. Use `useVirtualizer` with column approach for masonry effect.

**Why @tanstack/react-virtual:**
- Headless (works with any layout, not opinionated about masonry)
- React 19 compatible (peerDeps: react >=16.8.0 || ^17 || ^18 || ^19)
- Only ~7KB gzipped
- Does not conflict with existing masonry library

**Alternatives rejected:**
- react-virtuoso: Over-engineered, pre-built components not needed
- react-window: Deprecated pattern, lacks masonry support

**Integration:** See Integration Points section below.

---

### Guest Reactions / Heart (GALLERY-06)

**Implementation:** Supabase schema change + UI component (no new library)

**Database schema changes:**
```sql
-- Simple counter for anonymous likes
ALTER TABLE guestbook_messages ADD COLUMN like_count INTEGER DEFAULT 0;

-- Full likes table with visitor tracking (prevents duplicate likes)
CREATE TABLE guestbook_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES guestbook_messages(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, visitor_id)
);
```

**UI:** Use existing Heart icon from lucide-react (already installed in package.json). The `src/pages/Guestbook.tsx` page already displays messages and can be extended with like buttons.

**State:** Extend `uiStore` with:
- `likedMessages: Set<string>` for tracking user's likes (persisted to localStorage)
- RPC function to increment/decrement like_count

**Supabase RPC for atomic like increment:**
```sql
CREATE OR REPLACE FUNCTION toggle_message_like(message_id UUID, visitor_id TEXT)
RETURNS JSONB AS $$
DECLARE
  existing_like UUID;
  new_count INTEGER;
BEGIN
  -- Check if already liked
  SELECT id INTO existing_like FROM guestbook_likes
  WHERE message_id = toggle_message_like.message_id AND visitor_id = toggle_message_like.visitor_id;

  IF existing_like IS NOT NULL THEN
    -- Unlike: remove like and decrement count
    DELETE FROM guestbook_likes WHERE id = existing_like;
    UPDATE guestbook_messages SET like_count = GREATEST(0, like_count - 1) WHERE id = message_id;
  ELSE
    -- Like: add like and increment count
    INSERT INTO guestbook_likes (message_id, visitor_id) VALUES (message_id, visitor_id);
    UPDATE guestbook_messages SET like_count = like_count + 1 WHERE id = message_id;
  END IF;

  SELECT like_count INTO new_count FROM guestbook_messages WHERE id = message_id;
  RETURN jsonb_build_object('like_count', new_count, 'user_liked', existing_like IS NULL);
END;
$$ LANGUAGE plpgsql;
```

**No new library needed** - uses existing lucide-react Heart icon and Supabase RPC.

---

### Social Sharing (SOCIAL-01, SOCIAL-02)

**Implementation:** Extend existing SEOHead + add ShareButtons component

The `src/components/seo/SEOHead.tsx` already handles:
- Open Graph tags (og:title, og:description, og:image, og:type, og:url)
- Twitter Card tags (twitter:card, twitter:title, twitter:image)
- JSON-LD structured data
- Canonical URLs

**What's needed:**
1. `ShareButtons.tsx` component using native Web Share API
2. Dynamic OG image URL for shared gallery items (query param for specific photo)
3. URL generation for deep linking to specific photos/albums

**Web Share API with fallback:**
```typescript
const shareLink = async (url: string, title: string) => {
  if (navigator.share) {
    await navigator.share({ url, title });
  } else {
    await navigator.clipboard.writeText(url);
    // Show toast "Link copied!"
  }
};
```

**No new library needed** - native `navigator.share()` with copy-to-clipboard fallback.

---

### Upload Resume (ADV-02)

**Implementation:** Create Zustand store with localStorage persistence

Current `Upload.tsx` already tracks:
- File status (uploading, complete, error)
- Progress via XHR
- Error messages

**What needs to be added:**
1. New `uploadStore.ts` with persist middleware (localStorage)
2. Queue structure: `{ file, progress, status, retryCount }`
3. On page mount: hydrate from localStorage, resume pending uploads
4. Clean up completed uploads from persistence

**Zustand persist with localStorage:**
```typescript
export const useUploadStore = create(
  persist(
    (set, get) => ({
      queue: [], // UploadingFile[]
      addToQueue: (files) => set(state => ({ queue: [...state.queue, ...files] })),
      removeFromQueue: (id) => set(state => ({ queue: state.queue.filter(f => f.id !== id) })),
      updateProgress: (id, progress) => set(state => ({
        queue: state.queue.map(f => f.id === id ? { ...f, progress } : f)
      })),
      // On mount, filter out completed items older than 1 hour
    }),
    { name: 'upload-queue', storage: createJSONStorage(() => localStorage) }
  )
);
```

**No new library needed** - uses existing Zustand with persist middleware.

---

### PWA Offline (ADV-01)

**Implementation:** Enhance workbox configuration in vite.config.js

Current setup:
- vite-plugin-pwa v1.2.0 already configured
- Service worker registered via `virtual:pwa-register`
- Basic caching via workbox (globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'])

**What's needed:** Add runtime caching strategy for gallery images from Supabase storage

**Enhanced workbox config:**
```javascript
VitePWA({
  workbox: {
    cleanupOutdatedCaches: true,
    clientsClaim: true,
    skipWaiting: true,
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'gallery-media',
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-cache',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 5 * 60, // 5 minutes
          },
        },
      },
    ],
  },
})
```

**No new library needed** - workbox is bundled with vite-plugin-pwa.

---

### Guest Upload Status (ADV-03)

**Implementation:** Extend upload store + Supabase status polling

Current: Upload shows "pending review" message after completion.

**What's needed:**
1. Store upload reference ID in localStorage after submission
2. Poll Supabase for status (or use Supabase Realtime subscription)
3. Show "Your photo is being reviewed" with status updates

**Supabase Realtime for live status:**
```typescript
const channel = supabase
  .channel('upload-status')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'guest_uploads',
    filter: `id=eq.${uploadId}`
  }, (payload) => {
    setStatus(payload.new.status); // 'pending' | 'approved' | 'rejected'
  })
  .subscribe();
```

**No new library needed** - Supabase Realtime is already part of the client.

---

## Installation

```bash
# Only new dependency needed
npm install @tanstack/react-virtual

# No other libraries required for v1.1 features
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|------------------------|
| @tanstack/react-virtual | react-virtuoso | If need pre-built grid/list components with built-in infinite scroll |
| @tanstack/react-virtual | react-window | If targeting React 16-17 only (react-window lacks React 19 support) |
| Native Web Share API | share-api package | Native API has better mobile UX, fallback works everywhere |
| Zustand localStorage | redux-persist | Zustand is already in use, simpler for this use case |
| Supabase Realtime | socket.io-client | Supabase Realtime is already configured, no extra server needed |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| react-lazy-load-image-component | Deprecated, conflicts with native lazy loading | Native `loading="lazy"` + Intersection Observer |
| react-share | Over-engineered, limited customization | Native Web Share API + custom buttons |
| Workbox via CDN | Harder to configure with Vite | vite-plugin-pwa workbox (already using) |
| Redux | Over-engineered for this use case | Zustand with persistence middleware |
| Socket.io | Extra server dependency | Supabase Realtime (already configured) |

## Integration Points

### Gallery Virtualization Integration
```
src/stores/galleryStore.ts (existing)
  └── Add virtualizer state (columns, rowHeights)
src/components/gallery/
  ├── GalleryGrid.tsx (existing)
  │   └── Wrap with useVirtualizer
  └── Lightbox.tsx (existing)
      └── Works with virtualized indices
```

### Upload Resume Integration
```
src/stores/uploadStore.ts (new)
  └── persist to localStorage with resume queue
src/pages/Upload.tsx (existing)
  └── On mount, hydrate from localStorage
```

### Social Sharing Integration
```
src/components/social/ShareButtons.tsx (new)
  └── Uses SEOHead dynamic image updates
src/pages/Gallery.tsx (existing)
  └── Add share button to photo context menu
```

### PWA Offline Integration
```
vite.config.js (existing)
  └── Enhance workbox runtimeCaching
src/utils/serviceWorker.ts (existing)
  └── Already has swManager, extend for cache events
```

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| React 19.2.x | @tanstack/react-virtual 3.x | Tested: react >=16.8.0 supports React 19 |
| React 19.2.x | Framer Motion 12.x | Already verified in codebase |
| React 19.2.x | Zustand 5.x | Already verified in codebase |
| Supabase JS 2.99.x | React 19 | Official Supabase client supports React 19 |
| vite-plugin-pwa 1.2.0 | workbox-window 7.x | peerDeps specify workbox ^7.4.0 |
| Tailwind CSS 4.x | Vite 7.x | Via @tailwindcss/vite plugin |

## Sources

- [TanStack Virtual - Context7](https://ctx7.com/tanstack/virtual) - Library documentation and React integration patterns, **HIGH confidence**
- [npm info @tanstack/react-virtual](https://www.npmjs.com/package/@tanstack/react-virtual) - Current version 3.13.24, peerDeps show React 19 support, **HIGH confidence**
- [vite-plugin-pwa docs](https://vite-pwa.dev/) - Workbox configuration for offline gallery caching, **HIGH confidence**
- [Web Share API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API) - Native sharing with fallback, **HIGH confidence**
- [Supabase Realtime](https://supabase.com/docs/guides/realtime) - Live status updates for upload queue, **HIGH confidence**
- [package.json dependencies](file://C:/Users/bbask/Coding_Projects/Wedding_Website_Clean/package.json) - Current installed versions, **HIGH confidence**
- [Gallery store analysis](file://C:/Users/bbask/Coding_Projects/Wedding_Website_Clean/src/stores/galleryStore.ts) - Current caching implementation, **HIGH confidence**
- [SEOHead component](file://C:/Users/bbask/Coding_Projects/Wedding_Website_Clean/src/components/seo/SEOHead.tsx) - Existing OG tag implementation, **HIGH confidence**
- [Upload component](file://C:/Users/bbask/Coding_Projects/Wedding_Website_Clean/src/pages/Upload.tsx) - Current upload flow, **HIGH confidence**
- [vite.config.js](file://C:/Users/bbask/Coding_Projects/Wedding_Website_Clean/vite.config.js) - Current PWA configuration, **HIGH confidence**

---
*Stack research for: Wedding Memory Archive v1.1*
*Researched: 2026-04-24*