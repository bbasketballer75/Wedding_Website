# Phase 5: Social Sharing & Upload Resume - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Guests can share photos with rich social previews and resume interrupted uploads. Phase delivers: photo-specific share URLs with dynamic OG tag updates, share modal wired to lightbox, upload queue persistence to localStorage, and fingerprint-based resume with deduplication.

</domain>

<decisions>
## Implementation Decisions

### Share Modal + OG Tags (SOC-01, SOC-02)

- **D-01:** Share URLs use photo ID format: `/gallery?shared=abc123`. When lightbox opens for a shared photo, detect the URL param and display that photo. This keeps URLs clean and works without JavaScript initially.

- **D-02:** GallerySEO reads `?shared=` from `window.location` on mount, fetches photo metadata from Supabase to get the image URL, and updates og:image dynamically via SEOHead's runtime meta tag update mechanism.

- **D-03:** Social preview when sharing a photo uses:
  - Title: "Wedding Photo from Austin & Jordyn's Wedding"
  - Description: "[Event type] photo from theporadas.com wedding gallery"

- **D-04:** ShareModal currently has no photo-specific data wired from lightbox. Need to pass `url`, `imageUrl`, `title`, `description` props when lightbox opens ShareModal. The component interface already supports this.

### Upload Queue Persistence (UPL-01)

- **D-04:** Store file metadata + fingerprint in localStorage: `{ id, name, type, size, fingerprint, preview, status, progress }`. File objects themselves are NOT stored (not JSON-serializable). The `preview` data URL is preserved for display.

- **D-05:** Incomplete uploads appear in upload queue immediately on page load with a "Resume" button. No separate banner or background processing — the queue shows all pending uploads (new + resumed).

- **D-06:** Resume uses auto-match by fingerprint — when guest re-selects a file, system matches by fingerprint to identify which stored upload metadata it corresponds to.

- **D-07:** Full restart with deduplication — re-upload the whole file, server checks fingerprint and skips if already complete. Simpler than byte-range, works without special server support, acceptable for wedding site upload volumes.

### Claude's Discretion

- Exact implementation of GallerySEO's `?shared=` detection and photo metadata fetch
- ShareModal prop wiring from lightbox (which props flow through)
- localStorage key naming convention for upload queue
- How to display "resumed" uploads in the queue UI differently from fresh uploads

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project
- `.planning/PROJECT.md` — Wedding website overhaul goals
- `.planning/REQUIREMENTS.md` — SOC-01, SOC-02, UPL-01 requirements
- `.planning/ROADMAP.md` — Phase 5 description and success criteria

### Prior Phase Context
- `.planning/phases/01-foundation-polish/01-CONTEXT.md` — Phase 1 decisions
- `.planning/phases/02-gallery-performance/02-CONTEXT.md` — Phase 2 decisions
- `.planning/phases/03-upload-experience/03-CONTEXT.md` — Phase 3 decisions (XHR progress tracking, UploadError enum)
- `.planning/phases/04-navigation-design/04-CONTEXT.md` — Phase 4 decisions (gold theme, skeleton screens)

### Codebase
- `src/components/share/ShareModal.tsx` — Existing share modal with all social buttons, needs photo data wired in
- `src/components/photo-viewer/PhotoLightbox.tsx` — Has `shareModalOpen` state, needs to pass photo data to ShareModal
- `src/components/seo/SEOHead.tsx` — Runtime meta tag updates, GallerySEO accepts `shareImage` prop
- `src/pages/Upload.tsx` — UploadingFile interface, buildFileFingerprint function, needs localStorage persistence added
- `src/utils/storage.ts` — Safe localStorage utilities with error handling (already exists and should be used)
- `src/lib/supabase.ts` — Photo type and Supabase client for fetching photo metadata

</canonical_refs>

<codebase_context>
## Existing Code Insights

### Reusable Assets
- ShareModal.tsx: Fully built modal with Copy/Facebook/Twitter/Email + native share, just needs props wired
- ShareButton.tsx: Another share component variant, may be redundant with ShareModal
- SEOHead.tsx: Runtime meta tag updates via useEffect, already working
- GallerySEO({ shareImage }): Accepts shareImage prop and updates og:image
- storage.ts: `storage.getJSON()` / `storage.setJSON()` for safe localStorage access with error handling
- Upload.tsx: `buildFileFingerprint()` already computes SHA-256 fingerprint

### Established Patterns
- Zustand for shared gallery state (lightbox state in galleryStore)
- Runtime meta tag updates via useEffect in SEOHead
- Framer Motion for modal animations
- Gold theme (gold-500 = #c9a05c) for accents

### Integration Points
- PhotoLightbox → ShareModal: Photo-specific URL and image need to be passed as props
- Gallery.tsx → GallerySEO: ?shared= URL param detection happens in GallerySEO itself
- Upload.tsx: Add localStorage persistence layer for UploadingFile metadata array
- Gallery page route: needs to handle ?shared= param to open lightbox to specific photo

</codebase_context>

<specifics>
## Specific Ideas

No specific references from discussion — open to standard approaches for implementation.
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.
</deferred>

---
*Phase: 05-social-sharing*
*Context gathered: 2026-04-25*
