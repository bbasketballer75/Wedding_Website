# Stack Research

**Domain:** Wedding Memory Archive Websites
**Researched:** 2026-04-23
**Confidence:** MEDIUM-HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React | 19.x | UI framework | Already in use. React 19's concurrent features (useTransition, useDeferredValue) improve gallery scrolling performance. |
| Supabase | 2.99.x | Backend (DB, Auth, Storage) | Already in use. Excellent file storage with built-in image transformations, row-level security for moderation, and affordable free tier. |
| Tailwind CSS | 4.x | Styling | Already in use. v4's CSS-first configuration and improved performance for complex UIs. |
| Zustand | 5.x | State management | Already in use. Lightweight, performant, with good DevTools support for debugging. |
| Framer Motion | 12.x | Animations | Already in use. Best-in-class React animation library with layout animations for gallery transitions. |

### Photo/Video Gallery Management

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-masonry-css` | 1.x | Masonry layout | Already in use. Solid masonry layout but lacks virtualization. |
| `framer-motion` | 12.x | Layout animations | Use for smooth photo reorder transitions when filtering. |
| Native `loading="lazy"` | - | Lazy loading | Use on all gallery images as baseline. |
| Intersection Observer API | - | Visibility detection | Use for infinite scroll triggers and progressive loading. |

**Recommendation:** Extend current masonry setup with virtualization (see "What NOT to Use" section). Add `loading="lazy"` attributes to all gallery thumbnails. Use `decoding="async"` on images to prevent decode blocking.

### Guest Upload Handling

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Supabase Storage | - | File uploads | Already in use. Use `uploadFile` with progress callbacks. |
| JSZip | 3.x | Client-side zip creation | Already in use for guest tagging batch downloads. |
| DOMPurify | 3.x | Input sanitization | Already in use. Essential for guest message fields. |

**Recommendation:** Current upload flow works but lacks:
- Persisted upload progress (refreshing loses progress)
- Automatic retry on failure
- Chunked uploads for large files

### Content Moderation (Admin Controls)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Supabase RLS | - | Row-level security | Use for approval workflow: guests submit to pending bucket, admins promote. |
| Radix UI | 1.x | Accessible primitives | Already in use (Dialog, DropdownMenu, Tabs, Toast, Tooltip). |
| Zod | 4.x | Schema validation | Already in use. Use for admin moderation forms. |

**Recommendation:** Current PhotoModeration.tsx is 900+ lines. Break into smaller components:
- `ModerationQueue.tsx` - List view with filters
- `ModerationItem.tsx` - Single photo review card
- `BulkActionsBar.tsx` - Batch approve/reject

### Performance Optimization

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Sharp | 0.34.x | Server-side image processing | Already in use in build scripts. Ensure thumbnails are pre-generated. |
| Vite | 7.x | Build tool | Already in use. Configure with appropriate chunking strategy. |
| `vite-plugin-pwa` | 1.x | Service worker | Already in use. Verify Workbox configuration for gallery caching. |

**Recommendation:** Implement:
1. **Image placeholder strategy**: Low-quality image placeholders (LQIP) during load
2. **Cache invalidation**: Supabase storage CDN cache for approved photos (set appropriate headers)
3. **Prefetch adjacent images**: Preload next/previous lightbox images

### Elegant, Beautiful UI Design

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Tailwind CSS | 4.x | Utility styling | Already in use. Use design tokens for consistent gold (#d4af37) theme. |
| `tailwind-merge` | 3.x | Class merging | Already in use for dynamic class handling. |
| `clsx` | 2.x | Conditional classes | Already in use. |
| Framer Motion | 12.x | Micro-interactions | Already in use. Add entrance animations, hover effects on gallery items. |
| `lenis` | 1.x | Smooth scrolling | Already in use. Ensure it works across all pages. |

**Recommendation:** Current design uses Allura, Cormorant Garamond, Pinyon Script fonts. Maintain this elegance by:
- Consistent spacing scale (use Tailwind's 4px base grid)
- Motion that feels natural (spring physics, 200-400ms durations)
- Subtle shadows and borders (avoid harsh contrasts)

## Installation

```bash
# Core (already installed)
npm install react@^19.2.4 react-dom@^19.2.4
npm install @supabase/supabase-js@^2.99.0
npm install zustand@5.0.11 framer-motion@12.35.2
npm install tailwindcss@^4.1.18 @tailwindcss/vite@^4.2.1

# Supporting (already installed)
npm install react-masonry-css@^1.0.16 lucide-react@0.577.0
npm install @radix-ui/react-dialog@1.1.15 @radix-ui/react-dropdown-menu@2.1.16
npm install @radix-ui/react-tabs@1.1.13 @radix-ui/react-toast@1.2.15
npm install zod@4.3.6

# Dev dependencies (ensure current)
npm install -D sharp@^0.34.5
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|------------------------|
| react-masonry-css | `react-virtuoso` or `@tanstack/react-virtual` | When gallery exceeds 500 visible items and scrolling becomes choppy |
| Zustand | Redux Toolkit | If team has more Redux experience; Zustand is simpler for this use case |
| Framer Motion | `react-spring` | If needing more physics-based control; Framer Motion has better React 19 support |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `react-lazy-load-image-component` | Deprecated pattern; conflicts with native `loading="lazy"` and React 19 concurrent features | Native lazy loading + Intersection Observer |
| Redux + Redux Thunk | Over-engineered for this use case; Zustand provides same functionality with 1/10th the boilerplate | Zustand with its `devtools` middleware |
| Full-page carousel | Poor UX for wedding galleries with many photos; users cannot scan or browse | Masonry grid or lightbox with keyboard navigation |
| Client-side image resizing via Canvas | Performance hit on mobile; edge cases with EXIF orientation | Server-side Sharp processing (already in use) + Supabase image transformations |

## Stack Patterns by Variant

**If gallery has > 200 visible photos:**
- Use virtualization with `@tanstack/react-virtual`
- Lazy load in batches of 50
- Because masonry without virtualization causes memory issues

**If upload files exceed 50MB:**
- Implement chunked uploads using `supabase.storage.from().uploadPart()`
- Show granular progress (chunk X of Y)
- Because single-file uploads can timeout on slow connections

**If moderation queue exceeds 100 pending items:**
- Add server-side pagination to admin queries (not fetching all at once)
- Filter by date range, collection, status
- Because loading 100+ high-res thumbnails freezes the browser

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| React 19.2.x | Framer Motion 12.x | Tested in current codebase. |
| React 19.2.x | Zustand 5.x | Tested in current codebase. |
| Supabase JS 2.99.x | Supabase Server | Use matching server version for RLS policies. |
| Tailwind CSS 4.x | Vite 7.x | Use `@tailwindcss/vite` plugin (already in use). |
| Sharp 0.34.x | Node 20+ | Required for build scripts. |

## Current Stack Analysis

**Already in use (verified from package.json):**
- React 19.2.4, React Router 7.13.1, Zustand 5.0.11
- Supabase JS 2.99.0 (storage, auth, database)
- Framer Motion 12.35.2, Lenis 1.3.18 (smooth scroll)
- Tailwind CSS 4.1.18, Lucide React 0.577.0
- Radix UI Dialog, DropdownMenu, Tabs, Toast, Tooltip
- Sentry for error tracking
- Playwright for e2e testing

**Existing patterns to preserve:**
- Gallery masonry with `react-masonry-css`
- Upload flow with fingerprinting for deduplication
- Admin moderation with Supabase RLS

**Gaps identified in current codebase:**
1. No image virtualization (memory risk with large galleries)
2. No upload progress persistence across page refreshes
3. MediaReviewPanel.tsx is 900+ lines (needs component breakup)
4. Gallery makes parallel Supabase calls without caching
5. No LQIP (low-quality image placeholder) strategy

## Sources

- [Supabase Storage Documentation](https://supabase.com/docs/reference/javascript/storage-createbucket) - Storage bucket creation and file management patterns, MEDIUM confidence
- [React 19 Blog](https://react.dev/blog) - React 19 features including concurrent features for performance, HIGH confidence
- [package.json dependencies](file://C:/Users/bbask/Coding_Projects/Wedding_Website_Clean/package.json) - Current installed versions, HIGH confidence
- Codebase analysis: Gallery.tsx, Upload.tsx, PhotoModeration.tsx, galleryStore.ts - Current implementation patterns, HIGH confidence

---
*Stack research for: Wedding Memory Archive*
*Researched: 2026-04-23*