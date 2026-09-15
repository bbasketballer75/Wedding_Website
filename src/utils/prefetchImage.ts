/**
 * prefetchImage — warm the browser cache for an image the lightbox will read.
 *
 * Deliberately uses fetch(mode: 'cors') instead of the previous
 * `<link rel="prefetch" as="image">` approach:
 *
 *  1. `<link rel="prefetch">` has no dedicated CSP directive, so it falls back
 *     to `default-src 'self'`. Our media host is cross-origin, so every
 *     prefetch was a CSP violation and the request never actually ran —
 *     dozens of console violations per gallery page load, and no warm cache.
 *  2. The lightbox reads these files with a CORS-mode fetch(). Warming with the
 *     same request mode means the cached entry is directly reusable, and the
 *     response is never opaque — which is what broke the lightbox when
 *     `<img>` (no-cors) loads populated the service-worker cache first.
 *
 * `connect-src` in public/_headers already allows the media host.
 */
export function prefetchImage(url: string): void {
  if (!url || typeof fetch !== 'function') return
  void fetch(url).catch(() => {
    // Prefetch is best-effort by definition; a failure here must never surface.
  })
}
