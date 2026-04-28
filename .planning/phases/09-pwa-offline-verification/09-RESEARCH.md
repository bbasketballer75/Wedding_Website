# Phase 9: PWA Offline Verification - Research

**Researched:** 2026-04-28
**Domain:** Progressive Web App offline image caching via Workbox/vite-plugin-pwa
**Confidence:** MEDIUM

## Summary

The project already has PWA infrastructure configured (vite-plugin-pwa 1.2.0 with Workbox 7.4.0) but is missing runtime caching strategies for external images. Gallery images are served through `getMediaPath()` which rewrites `/media/_thumbs/...` paths to Cloudflare R2 via a worker. The PWA currently only precaches local assets (JS, CSS, HTML) and does not cache the external R2 media URLs. This means previously-viewed gallery photos are not available offline.

The key insight is that the media-rewrite worker uses URL-path-based routing (e.g., `/media/_thumbs/Engagement/Photos/filename.webp`) to map to R2 paths, but when offline, those requests will fail before reaching the worker. The solution is to configure Workbox runtime caching that intercepts these URL patterns and caches responses using CacheFirst or StaleWhileRevalidate strategies.

**Primary recommendation:** Add `workbox.runtimeCaching` configuration to VitePWA with CacheFirst strategy for media URL patterns, and implement update notifications using `workbox-window` to prevent white screens on new versions.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| PWA service worker registration | Browser/Client | -- | Browser registers SW; VitePWA generates it |
| Runtime caching of gallery images | Browser/Client | CDN/Edge (R2) | SW caches R2 responses in browser cache |
| Media URL rewriting | CDN/Edge | Browser/Client | Cloudflare worker rewrites paths; offline SW must cache rewritten URLs |
| PWA update notification | Browser/Client | -- | SW communicates with workbox-window in browser |
| Offline fallback page | Browser/Client | -- | Static HTML served by SW when network fails |

## User Constraints (from CONTEXT.md)

*No CONTEXT.md exists for this phase — all constraints below are derived from the phase description and project context.*

### Locked Decisions
- PWA serves cached gallery images when offline (no alternatives to this goal)
- Media is served from Cloudflare R2 via media-rewrite worker (cannot change this architecture)
- vite-plugin-pwa 1.2.0 is already configured (must use this, not alternatives)
- Workbox 7.4.0 is the underlying caching library (must use this)

### Claude's Discretion
- Cache strategy choice: CacheFirst vs StaleWhileRevalidate for images
- Precache list construction vs runtime caching approach
- Update notification UI implementation
- Testing methodology for offline scenarios

### Deferred Ideas (OUT OF SCOPE)
- Push notifications (not required for offline gallery)
- Background sync (gallery is read-only, no writes to persist)
- Install prompt UI (not part of phase requirements)

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vite-plugin-pwa | 1.2.0 | PWA plugin for Vite | Already configured; zero-config for Workbox generation |
| workbox | 7.4.0 | Caching primitives | Bundled with vite-plugin-pwa |
| workbox-window | 7.4.0 | Update notifications | Official Workbox companion for SW-to-app communication |

### Installation
No additional packages needed — workbox and workbox-window are already installed as dependencies of vite-plugin-pwa (verified: `npm view vite-plugin-pwa@1.2.0` lists workbox-build 7.4.0 and workbox-window 7.4.0 as deps).

## Architecture Patterns

### System Architecture Diagram

```
Browser (PWA)
    |
    |-- SW (Workbox Generated) --+
    |                            |
    |  [Precache] local assets   |  [Runtime Cache] gallery images
    |  JS/CSS/HTML/icons         |  /media/_thumbs/* --> R2 cached
    |                            |
    +---> Network Request
              |
              +--Online--> Cloudflare Worker --> R2 Bucket
              |
              +--Offline--> Cache Hit (served from browser cache)
                              |
                              +--Cache Miss--> offline.html fallback
```

**Key flow for offline gallery:**
1. User browses gallery; images load from R2 via Cloudflare worker
2. Workbox runtime caching caches each response in browser Cache Storage
3. User goes offline; navigates to gallery
4. SW intercepts `/media/_thumbs/...` requests
5. CacheFirst strategy returns cached response (no network needed)
6. If not cached: offline.html or cached error response

### Current VitePWA Configuration (from vite.config.js)

```javascript
VitePWA({
  registerType: 'autoUpdate',
  devOptions: { enabled: false },
  manifestFilename: 'manifest.webmanifest',
  includeAssets: ['favicon-custom.svg', 'favicon-16x16.png', 'favicon-32x32.png', 'apple-touch-icon.png', 'browserconfig.xml', 'robots.txt', 'offline.html'],
  manifest: { /* pwaManifest object */ },
  workbox: {
    cleanupOutdatedCaches: true,
    clientsClaim: true,
    skipWaiting: true,
  },
})
```

**Missing:** `workbox.runtimeCaching` configuration for external media URLs.

### Recommended Workbox Runtime Caching Configuration

```javascript
VitePWA({
  // ... existing config ...
  workbox: {
    // ... existing config ...
    runtimeCaching: [
      {
        // Cache engagement photos from R2
        urlPattern: /^https?:\/\/.*\/media\/_thumbs\/Engagement\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'gallery-engagement',
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        // Cache Bach+ette photos
        urlPattern: /^https?:\/\/.*\/media\/_thumbs\/Bach\+ette\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'gallery-bach-ette',
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 30 * 24 * 60 * 60,
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        // Cache Wedding Day photos
        urlPattern: /^https?:\/\/.*\/media\/_thumbs\/Professional\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'gallery-wedding-day',
          expiration: {
            maxEntries: 300,
            maxAgeSeconds: 30 * 24 * 60 * 60,
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        // Cache Guest Uploads
        urlPattern: /^https?:\/\/.*\/media\/_thumbs\/Guest.?Uploads\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'gallery-guest-uploads',
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 30 * 24 * 60 * 60,
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        // Cache direct /media/ paths (bypassing _thumbs)
        urlPattern: /^https?:\/\/.*\/media\/(Engagement|Bach\+ette|Professional|Guest.?Uploads)\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'gallery-direct-media',
          expiration: {
            maxEntries: 300,
            maxAgeSeconds: 30 * 24 * 60 * 60,
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
    ],
  },
})
```

**Important patterns from codebase:**
- `getMediaPath()` rewrites paths to either `/{DEV_MEDIA_PROXY_PREFIX}/...` (dev) or `{mediaBaseUrl}/...` (prod)
- In dev, proxy target is `VITE_MEDIA_BASE_URL` via Vite's dev server proxy
- In prod, proxy is the Cloudflare worker which rewrites `_thumbs` paths to R2
- Workbox SW runs in production, so runtime cache URLs must match the **production URL pattern**

### media-rewrite Worker URL Mapping (from src/workers/media-rewrite/index.ts)

The worker handles these path patterns:
- `/media/_thumbs/Engagement/Photos/filename.webp` -> `professional/photos/proposal/filename`
- `/media/_thumbs/Bach+ette/Photos/filename.webp` -> `media/Bach+ette/Photos/filename` (with .webp->.jpg conversion)
- `/media/_thumbs/Professional/Wedding Day/Photos/filename.webp` -> `media/Professional/Wedding Day/Photos/filename`
- `/media/_thumbs/Guest Uploads/...` -> `media/Guest Uploads/...`
- `_thumbs` is a virtual directory that maps to R2 paths via complex path rewriting

**Critical insight:** The `_thumbs` pattern is a virtual path recognized by the Cloudflare worker. When offline, the browser needs to cache the actual image responses (which come from R2 through the worker). The runtime cache URL pattern must match what the browser requests — which is the full URL including any proxy prefix or the worker's public URL.

### Offline Update Notification Pattern (using workbox-window)

```typescript
// src/pwa/update-notification.ts
import { useEffect } from 'react'
import { useToast } from '@/context/ToastContext'

export function usePWAUpdateNotification() {
  const { addToast } = useToast()

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // Dynamic import to avoid loading workbox-window unless needed
    import('workbox-window').then(({ Workbox }) => {
      const wb = new Workbox('/sw.js')

      wb.addEventListener('waiting', (event: any) => {
        const sw = event.detail.serviceWorker
        // Show toast notification instead of immediate reload
        addToast({
          id: 'pwa-update',
          type: 'info',
          title: 'Update available',
          message: 'A new version of the site is ready. Refresh to see the latest.',
          duration: 0, // Don't auto-dismiss
          action: {
            label: 'Refresh now',
            onClick: () => {
              wb.messageSkipWaiting()
              window.location.reload()
            },
          },
        })
      })

      wb.addEventListener('controlling', () => {
        window.location.reload()
      })

      wb.addEventListener('activated', (event: any) => {
        if (!event.detail.isUpdate) {
          // First install, no notification needed
        }
      })

      wb.register()
    })
  }, [])
}
```

**Why this prevents white screen:** The default `registerType: 'autoUpdate'` with `skipWaiting: true` causes the new SW to immediately take control, replacing the old SW and triggering a reload. If the new SW has updated precache manifest but the page was loaded with old assets, the page may break. The `waiting` event pattern defers the activation until user confirms, preventing the silent reload.

### Offline Fallback Flow

```
1. Request for /media/_thumbs/... image
2. SW intercepts via runtime route
3. CacheFirst: check Cache Storage
   - HIT: return cached response
   - MISS: attempt network request
4. Network request fails (offline)
5. Return offline fallback OR cached error response
```

**The existing public/offline.html is already in the precache manifest** (included in `includeAssets`). VitePWA automatically serves this when the SW cannot fulfill a navigation request. However, for **image requests**, the SW should return a placeholder image or transparent 1x1 pixel rather than falling back to the offline HTML page (which is for navigation, not for sub-resource images).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SW update notification | Custom message passing between SW and app | workbox-window | Handles all edge cases (first install vs update, multiple tabs, etc.) |
| Image caching strategy | Custom fetch + CacheStorage logic | Workbox CacheFirst/StaleWhileRevalidate | Cache expiration, size limits, race condition handling all done correctly |
| Offline detection | navigator.onLine polling | Workbox's built-in network detection | Always accurate; avoids polling race conditions |

**Key insight:** Workbox is specifically designed for this use case. The complexity of cache expiration management, storage quota handling, and cache keyed by URL + headers is significant. Hand-rolling a robust solution is error-prone.

## Common Pitfalls

### Pitfall 1: Cache key mismatch (images not caching)
**What goes wrong:** Browser caches responses but subsequent requests still miss the cache.
**Why it happens:** Cache key includes URL with query parameters or different casing. R2 URLs may have different representations (with vs without trailing slashes, encoded vs decoded characters like `+` vs `%2B`).
**How to avoid:** Configure Workbox's `matchOptions` and `normalization` to ensure consistent cache keys. For R2/Cloudflare, the URL pattern must be URL-decoded.
**Warning signs:** Network tab shows same image loading repeatedly; Cache Storage shows multiple entries for same logical image.

### Pitfall 2: Caching auth-required images (403 errors)
**What goes wrong:** SW caches 403 responses; subsequent requests return cached 403s.
**Why it happens:** Some Supabase Storage URLs may require auth tokens. If cached as-is, offline requests fail.
**How to avoid:** Supabase Storage public URLs use signed URLs with expiration. Long-lived cached images may break after expiry. Ensure gallery images use **public** R2 URLs or have very long cache TTLs relative to signed URL expiry. The media-rewrite worker serves directly from R2 with `Cache-Control: public, max-age=31536000, immutable` so this is not an issue for the main gallery.
**Warning signs:** Images visible online but show as broken images offline.

### Pitfall 3: Cache storage quota exceeded
**What goes wrong:** Browser limits Cache Storage to ~50-100MB. Caching 500+ high-res wedding photos exceeds this quickly.
**Why it happens:** Each cached image counts against the Cache Storage quota. Browsers evict caches under pressure.
**How to avoid:** Set `maxEntries` limits per cache (200-300 per cache as in the recommended config). Use thumbnails (which are already served via `_thumbs`) rather than full-resolution images. The gallery uses `getMediaPath()` which serves `_thumbs` paths, so cached images should be appropriately sized.
**Warning signs:** DevTools shows "Quota exceeded" errors; some images disappear from cache.

### Pitfall 4: SW update causing white screen
**What goes wrong:** New SW version installs and activates immediately; page reloads but old JS references non-existent cached assets.
**Why it happens:** `skipWaiting: true` causes new SW to activate before page is ready.
**How to avoid:** Use `waiting` event pattern with user-controlled reload (as shown in update-notification pattern above). Or set `skipWaiting: false` and call `registration.waiting?.postMessage({ type: 'SKIP_WAITING' })` from the page when ready.
**Warning signs:** Users report blank page after PWA update notification appears.

### Pitfall 5: URL patterns not matching production URLs
**What goes wrong:** Runtime cache rules have no effect; images never cached.
**Why it happens:** In dev, media URLs go through `localhost:5173/__media_proxy/...` but in production they go through `theporadas.com/media/...`. Runtime cache `urlPattern` must match the production URL.
**How to avoid:** In dev, `VITE_MEDIA_BASE_URL` controls proxy. The SW runtime cache patterns must be generic enough to match both or must be environment-aware. The recommended patterns above use regex that matches both dev proxy URLs and production URLs (via `^https?:\/\/.*\/media\/...`).

## Code Examples

### Adding runtime caching to VitePWA (vite.config.js change only)

```javascript
// Add to existing VitePWA workbox config
workbox: {
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /^https?:\/\/.*\/media\/_thumbs\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'gallery-images-v1',
        expiration: {
          maxEntries: 500,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    {
      urlPattern: /^https?:\/\/.*\/media\/(?!_thumbs).*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'gallery-direct-media-v1',
        expiration: {
          maxEntries: 300,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
  ],
},
```

### Update notification component (new file)

```typescript
// src/components/pwa/PWAUpdateToast.tsx
import { useState, useEffect } from 'react'
import { Toast } from '@/components/ui/Toast'
import { RefreshCw, X } from 'lucide-react'

interface PWAUpdateToastProps {
  onRefresh: () => void
  onDismiss: () => void
}

export function PWAUpdateToast({ onRefresh, onDismiss }: PWAUpdateToastProps) {
  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-2xl border border-gold-200 bg-white/95 p-4 shadow-xl backdrop-blur-sm">
      <button
        onClick={onDismiss}
        className="absolute right-3 top-3 text-charcoal-400 hover:text-charcoal-600"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-100">
          <RefreshCw className="h-5 w-5 text-gold-600" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-charcoal-900">Update available</p>
          <p className="mt-1 text-sm text-charcoal-500">
            A new version of the gallery is ready with offline improvements.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={onRefresh}
              className="rounded-full bg-gold-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gold-600"
            >
              Refresh
            </button>
            <button
              onClick={onDismiss}
              className="rounded-full border border-charcoal-200 px-4 py-2 text-sm text-charcoal-600 transition-colors hover:bg-charcoal-50"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Hook to integrate with App.tsx
export function usePWAUpdateNotification() {
  const [showUpdateToast, setShowUpdateToast] = useState(false)
  const [pendingSW, setPendingSW] = useState<ServiceWorker | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    import('workbox-window').then(({ Workbox }) => {
      const wb = new Workbox('/sw.js')

      wb.addEventListener('waiting', (event: any) => {
        setPendingSW(event.detail.serviceWorker)
        setShowUpdateToast(true)
      })

      wb.addEventListener('controlling', () => {
        window.location.reload()
      })

      wb.register()
    })
  }, [])

  const handleRefresh = () => {
    pendingSW?.postMessage({ type: 'SKIP_WAITING' })
    window.location.reload()
  }

  const handleDismiss = () => {
    setShowUpdateToast(false)
    setPendingSW(null)
  }

  return { showUpdateToast, handleRefresh, handleDismiss }
}
```

### Testing offline in DevTools

```
1. Open Chrome DevTools (F12)
2. Application tab → Service Workers → Check "Offline" checkbox
3. Navigate to /gallery
4. Verify images load from cache (Network tab shows "cached" or "from cache storage")
5. Check Cache Storage (Application → Cache Storage) for gallery-images-v1 cache
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SW navigation fallback to offline.html | Runtime caching of sub-resources (images) | Enables offline image browsing, not just offline navigation | Gallery images available offline |
| Auto-update with skipWaiting (white screen risk) | Update notification with user-controlled refresh | Prevents white screen on PWA updates | Users see meaningful update prompt |
| Single cache for all remote resources | Per-album cache isolation | Limits cache eviction blast radius; better expiration control | Engagement album images don't get evicted by Wedding Day |

## Assumptions Log

> List all claims tagged `[ASSUMED]` in this research.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Gallery images are served with long cache headers (public, max-age=31536000) | Common Pitfalls - Pitfall 2 | If images require auth tokens that expire, cached images would break after expiry. Verified in media-rewrite worker source. |
| A2 | `workbox.runtimeCaching` patterns in the recommended config will match production URLs | Code Examples | If URL structure differs in production (e.g., Cloudflare domain is different), cache patterns may not match. Needs verification against actual R2/Cloudflare URL patterns. |
| A3 | Browser Cache Storage quota (~50-100MB) is sufficient for thumbnail caching | Common Pitfalls - Pitfall 3 | If quota is smaller or already used, some images may not cache. Plan should include monitoring Cache Storage usage. |
| A4 | vite-plugin-pwa 1.2.0 generates Workbox SW that supports `runtimeCaching` in the `workbox` option | Standard Stack | Confirmed by npm view output. The `workbox` property in VitePWA config maps directly to Workbox's generateSW config. |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

## Open Questions

1. **What is the exact production URL for R2-served images?**
   - What we know: `getMediaPath()` returns URLs starting with `/media/` in production, which go through the Cloudflare worker. The worker URL pattern isn't explicitly documented in the codebase.
   - What's unclear: The full Cloudflare worker URL (e.g., does it use a workers.dev subdomain, a custom domain, or is it behind a CDN?).
   - Recommendation: Verify actual production image URLs by checking Network tab when browsing gallery in production, or check Cloudflare dashboard for worker routes.

2. **Should full-resolution images be cached or only thumbnails?**
   - What we know: Gallery uses `/media/_thumbs/` paths for the masonry grid, suggesting thumbnails are the primary cached variant.
   - What's unclear: Whether the lightbox loads full-resolution images from different paths (non-`_thumbs`).
   - Recommendation: Check if lightbox uses different URL patterns; if so, add those patterns to runtime cache config.

3. **How many images can realistically be cached before quota issues?**
   - What we know: ~500-600 photos in the gallery; `_thumbs` are smaller webp thumbnails.
   - What's unclear: Actual thumbnail file sizes; browser quota limits vary by browser and available storage.
   - Recommendation: Set conservative `maxEntries` limits (200-500) and monitor Cache Storage in DevTools during testing.

## Environment Availability

> Step 2.6: SKIPPED (no external dependencies beyond the existing PWA tooling which is already installed).

The phase requires no additional tools beyond what is already in the project:
- vite-plugin-pwa 1.2.0 is already in package.json
- workbox 7.4.0 is a transitive dependency (already present)
- workbox-window 7.4.0 is a transitive dependency (already present)
- No new npm packages need to be installed

## Validation Architecture

> Skip if workflow.nyquist_validation is explicitly set to false. If absent, treat as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (e2e tests already exist) |
| Config file | `playwright.config.ts` |
| Quick run command | `npm run test:e2e:public` |
| Full suite command | `npm run test:e2e` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PWA-01 | PWA caches Supabase storage image URLs for offline access | Manual/e2e | DevTools Cache Storage verification | N/A |
| PWA-01 | Guest can browse previously-viewed gallery photos while offline | Manual/e2e | Chrome offline mode + gallery navigation | N/A |
| PWA-01 | Offline browsing works for photos in any album | Manual/e2e | Test each album tab while offline | N/A |
| PWA-01 | PWA update notification appears when new version available (no white screen) | Manual | Reload page with updated SW; verify toast appears | N/A |
| PWA-01 | Offline fallback tested and working | Manual | Toggle offline; verify fallback behavior | N/A |

### Sampling Rate
- **Per task commit:** Manual verification via DevTools
- **Per wave merge:** Full e2e suite
- **Phase gate:** Manual offline testing checklist verified

### Wave 0 Gaps
- [ ] Add runtime caching to vite.config.js
- [ ] Create PWAUpdateToast component
- [ ] Integrate update notification hook in App.tsx
- [ ] Manual offline testing checklist documented

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | No | Not applicable to PWA caching |
| V4 Access Control | No | PWA serves public images only |
| V2 Authentication | No | No auth required for gallery images |

**Noted:** Gallery images are public (no auth required), so caching them poses no security risk. The media-rewrite worker already serves with `Cache-Control: public, max-age=31536000, immutable` indicating these are public resources.

## Sources

### Primary (HIGH confidence)
- `src/workers/media-rewrite/index.ts` - Verified: worker serves with `public, max-age=31536000, immutable` headers
- `vite.config.js` - Verified: VitePWA 1.2.0 configuration, `registerType: 'autoUpdate'`, `skipWaiting: true`
- `src/utils/media.ts` - Verified: `getMediaPath()` URL rewriting logic for `/media/_thumbs/...` paths
- `npm view vite-plugin-pwa@1.2.0` - Verified: deps include workbox-build 7.4.0 and workbox-window 7.4.0
- `src/lib/supabase.ts` - Verified: Photo type with `url` and `thumbnail` fields

### Secondary (MEDIUM confidence)
- [vite-plugin-pwa documentation](https://vite-pwa.dev/) - Framework-agnostic PWA plugin docs (site unavailable during research; used skill file and npm registry data instead)
- [Workbox documentation](https://developer.chrome.com/docs/workbox/) - Official Workbox caching library docs
- `.codex/skills/pwa.md` - Project PWA skill file with caching configuration examples

### Tertiary (LOW confidence)
- WebSearch for "vite-plugin-pwa workbox runtime caching external images" - Failed due to API error; used npm registry and local file inspection instead

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Verified by npm registry and local installation
- Architecture: MEDIUM - Based on code analysis; URL patterns need production verification
- Pitfalls: MEDIUM - Based on common PWA issues and Workbox documentation

**Research date:** 2026-04-28
**Valid until:** 2026-05-28 (PWA configuration is stable; vite-plugin-pwa API unlikely to change in near term)