# Pitfalls Research

**Domain:** Wedding Archive Website (post-wedding photo/memory preservation platform)
**Researched:** 2026-04-23
**Confidence:** MEDIUM-HIGH

## Critical Pitfalls

### Pitfall 1: Photo Gallery "Feels Incomplete"

**What goes wrong:**
Gallery appears functional but users sense something is unfinished — photos load with visible delay, lightbox feels jarring, no smooth transitions between albums, inconsistent hover states.

**Why it happens:**
- Gallery state held in component state (`useState` in `Gallery.tsx`) rather than centralized store
- No loading skeletons — users see blank space before photos appear
- Lightbox is a separate modal rather than contextual overlay with shared transition context
- Album switching triggers full re-render without animation
- No cache headers or prefetching for adjacent photos

**How to avoid:**
- Add loading skeleton components matching expected photo dimensions
- Implement shared photo state in Zustand with `lightboxOpen`, `currentPhotoIndex`, `currentAlbum`
- Use Framer Motion shared layout for lightbox transitions
- Add `loading="lazy"` and explicit `width`/`height` attributes on all images
- Prefetch next/previous 3 photos when lightbox opens

**Warning signs:**
- Console shows "layout shift" warnings in Lighthouse
- Photos jump when scrolling into view
- Lightbox takes >300ms to open

**Phase to address:**
Phase 2: Gallery Performance & UX

---

### Pitfall 2: Guest Upload Abandonment Due to Poor Feedback

**What goes wrong:**
Guests start uploading but abandon mid-process because they don't know if it's working, get cryptic errors, or lose progress on network issues.

**Why it happens:**
- Upload progress is not visible (no progress bar per file)
- Errors give no actionable feedback ("Upload failed" without reason)
- Page refresh loses all progress — no persistence of in-flight uploads
- Large files (>50MB) fail silently without chunking strategy
- No confirmation when upload completes — user doesn't know if it succeeded

**How to avoid:**
- Show per-file progress bars with percentage and estimated time remaining
- Display specific error messages (network timeout vs file too large vs format unsupported)
- Persist upload queue to localStorage so page refresh resumes uploads
- Implement chunked uploads for files >10MB with individual retry logic
- Show success confirmation with what happens next (moderation delay, expected timeline)

**Warning signs:**
- Support emails about "my photo didn't upload"
- Upload completion rate drops for files >20MB
- Users refresh page and think uploads succeeded when they didn't

**Phase to address:**
Phase 3: Upload Experience Polish

---

### Pitfall 3: Admin Tool Complexity Creep

**What goes wrong:**
Admin moderation panel becomes overwhelming — too many actions per screen, inconsistent workflows between photo/guestbook/featured content, no clear visual hierarchy.

**Why it happens:**
- `MediaReviewPanel.tsx` at 900+ lines tries to do everything
- Batch approval, face tagging, photo promotion all on one screen
- No clear primary action per card/section
- Loading states mix with action states (buttons change but don't disable properly)
- Pagination absent — admin sees infinite scroll of unmoderated items with no context

**How to avoid:**
- Break into discrete sub-pages: Queue → Batch Review → Face Tagging → History
- One primary action per card, secondary actions in overflow menu
- Show pending count in navigation so admin knows workload
- Add bulk actions but keep individual override clear
- Disable controls during operations, show loading indicators, confirm before destructive actions

**Warning signs:**
- Admin avoids moderation page because it feels "cluttered"
- Actions apply to wrong items (race conditions on async operations)
- Hard to undo moderation decisions

**Phase to address:**
Phase 4: Admin Controls & Moderation

---

### Pitfall 4: Breaking Auth During Refactor

**What goes wrong:**
Refactoring auth or adding admin features causes session bugs — users get logged out unexpectedly, admin access fails for valid users, race conditions between `initializeAuth` and `refreshSession`.

**Why it happens:**
- `authStore.ts` has race conditions between init and refresh (documented in CONCERNS.md)
- Multiple Supabase client instances with different configurations
- Frontend checks admin role via `user.user_metadata?.role` which can be manipulated
- No error boundaries on auth-dependent pages

**How to avoid:**
- Implement auth state machine with explicit states: `initializing`, `authenticated`, `unauthenticated`, `error`
- Queue auth operations — never run `initializeAuth` and `refreshSession` simultaneously
- Consolidate to single Supabase client instance exported from `src/lib/supabase.ts`
- Add server-side RLS policies that enforce admin role — frontend check only for UI state
- Wrap admin pages in `ComponentErrorBoundary` with auth recovery actions

**Warning signs:**
- Users report "logged out after navigating back"
- Admin pages show brief unauthenticated state before redirecting
- Auth operations appear to run twice in network tab

**Phase to address:**
Phase 1: Foundation & Auth Polish

---

### Pitfall 5: Seasonal Code Path Breakage

**What goes wrong:**
HalloweenContext and seasonal components silently fail or cause crashes when conditions change, and error boundaries don't catch them properly.

**Why it happens:**
- `HalloweenContext` renders early in tree — errors may bypass standard error boundaries
- Seasonal code is rarely tested until the season arrives
- No feature flag fallback when seasonal data fails to load
- Components like `LightningEffect` and `HalloweenAudio` have implicit dependencies on context state

**How to avoid:**
- Ensure all seasonal components wrapped in dedicated error boundaries
- Add explicit `isEnabled` flag that defaults to `false` — seasonal features only render when flag is on
- Never have conditional rendering dependent solely on date — always check feature flag first
- Add seasonal component health check to admin dashboard

**Warning signs:**
- Seasonal features fail in first week of season
- Error boundary catches "cannot read property of null" but doesn't indicate which component

**Phase to address:**
Phase 1: Foundation & Auth Polish (ensure error boundaries)

---

### Pitfall 6: State Management Inconsistency After Migration

**What goes wrong:**
After moving state from components to Zustand, some components still hold local state causing data to appear inconsistent (filter changes in one place, selection in another).

**Why it happens:**
- Gallery has component-level state for `selectedPhotos`, `lightboxOpen`, `activeAlbum` (documented in CONCERNS.md)
- Moving to Zustand but forgetting to remove `useState` initializers
- No clear ownership — some state in component, some in store, some in URL params
- Hydration mismatches if Zustand persists to localStorage

**How to avoid:**
- Inventory all gallery state before migration — document what lives where
- Remove component state in same PR that adds Zustand state
- Use Zustand store for all shared state, URL params for navigation-only state
- Test gallery in all states: empty, single album, multiple albums, lightbox open

**Warning signs:**
- "State not syncing" reports from testers
- Filter changes don't persist when switching between albums
- Lightbox position resets unexpectedly

**Phase to address:**
Phase 2: Gallery Performance & UX

---

### Pitfall 7: Photo Type Drift After Refactoring

**What goes wrong:**
`Gallery.tsx` defines local `Photo` interface while `src/lib/supabase.ts` exports a different `Photo` type. Changes to one don't reflect in the other.

**Why it happens:**
- Early development created local types for "quick progress" without importing from shared module
- Admin pages and public pages use inconsistent field names
- TypeScript only catches exact matches — `id` vs `photo_id` slips through

**How to avoid:**
- Import `Photo` type from `src/lib/supabase.ts` exclusively
- If Gallery needs extended fields, extend the imported type: `interface GalleryPhoto extends Photo`
- Add TypeScript lint rule to flag local type definitions that duplicate imported names
- Audit type usage across admin/public boundaries before release

**Warning signs:**
- TypeScript errors on `photo_id` field after adding to Supabase schema
- Admin moderation shows different field names than public gallery
- Adding new Photo field requires editing two files

**Phase to address:**
Phase 1: Foundation & Auth Polish (type consolidation)

---

### Pitfall 8: Console Errors in Production Builds

**What goes wrong:**
Production code contains `console.log`, `console.warn`, `console.error` calls that expose sensitive data and make debugging harder in production.

**Why it happens:**
- Developer `console.log` statements left during active development
- Error handling uses `console.error` instead of structured logging service
- No build-time stripping of console calls for production

**How to avoid:**
- Replace all `console.*` calls with the `logger` utility from `src/utils/logger.ts`
- Configure build to strip console in production (terser plugin or Babel transform)
- Set `logger.enableProduction()` to disable output in production builds
- Add pre-commit hook to catch new `console.` usages

**Warning signs:**
- Browser console shows Supabase auth tokens or user emails in production
- Error messages differ between dev and prod (lost context in prod)

**Phase to address:**
Phase 1: Foundation & Auth Polish

---

### Pitfall 9: Dead UI After Network Errors

**What goes wrong:**
Admin pages crash without recovery if data fetch fails — user sees broken UI with no way to retry or recover.

**Why it happens:**
- No error boundaries on admin pages (`PhotoModeration`, `GuestbookModeration`, `FeaturedContentManager`)
- Failed fetches leave components in partial state
- No retry mechanism for failed data loads

**How to avoid:**
- Wrap all admin page content in `ComponentErrorBoundary`
- Provide explicit retry actions in error fallback UIs
- Add "Last loaded" timestamp to help admin know data freshness
- Implement optimistic UI patterns with rollback on failure

**Warning signs:**
- Console shows "uncaught promise rejection" on admin pages
- Admin reports page "looks broken" with no recovery option

**Phase to address:**
Phase 4: Admin Controls & Moderation

---

### Pitfall 10: Rate Limiting Bypass on Upload

**What goes wrong:**
In-memory rate limiting in `src/lib/supabase.ts` resets on page refresh and doesn't work across tabs — determined users can bypass limits.

**Why it happens:**
- Rate limiting uses `Map()` that lives in JavaScript heap
- Each page load creates fresh state
- Multiple tabs each have independent in-memory state

**How to avoid:**
- Move rate limiting to Supabase Edge Functions with persistent state
- Use session-based limiting tied to authenticated user ID
- Add server-side validation for all upload requests
- Log rate limit bypasses for security monitoring

**Warning signs:**
- Security audit shows upload endpoint hit from same user rapidly
- Guest reports successful upload despite exceeding stated limits

**Phase to address:**
Phase 1: Foundation & Auth Polish (Edge Function rate limiting)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Using `useState` for gallery state | Fast to implement | Hard to share across routes, no persistence | Never — project will refactor this |
| Inline styles for "one-off" polish | Quick visual fix | Inconsistency, maintenance nightmare | Only for truly unique animations |
| Skipping error boundaries on admin pages | Faster initial build | Page crashes leave admin stuck | Never — admin must always recover |
| Using console.log for debugging | Zero setup | Leaks to production, no structured logs | Never — use logger utility |
| Duplicate Supabase client instances | Avoids import conflict | Auth state inconsistency | Never — consolidate to one |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase Auth | Multiple client instances | Single exported client from `src/lib/supabase.ts` |
| Supabase Storage | Not handling `400 Bad Request` on large uploads | Chunked uploads with retry logic |
| Supabase RLS | Assuming frontend check is sufficient | RLS policies enforce access at database level |
| Sentry | Using old SDK version without migration plan | Pin minor version, plan upgrade to v11+ |
| TensorFlow.js | Loading heavy models on public pages | Lazy-load only in admin review panel |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Parallel Supabase calls in gallery | Network tab shows 10+ simultaneous requests | Add request deduplication and caching layer | >100 photos loaded |
| Full table scan for known people names | Slow load for person search | Create indexed covering index or separate lookup table | >5000 photos |
| Fetch all batches on admin load | Admin page hangs on load | Pagination, limit, filter on batch queries | >50 pending batches |
| Gallery state in component | State not shared, doesn't persist | Zustand store with proper initialization | Multi-page gallery navigation |
| No image lazy loading | Initial page load blocks on images | `loading="lazy"` on all below-fold images | Gallery with >20 visible thumbnails |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Frontend-only admin check | User manipulates JWT to escalate privileges | Server-side RLS policies enforce admin role |
| CSP allows `unsafe-inline` | XSS attacks execute inline scripts | Remove unsafe directives, use nonce-based CSP |
| Audit log failures are silent | Security events unlogged | Retry mechanism and alerting on audit failures |
| Upload without server validation | Malicious file types bypass client checks | Edge Function validates file type and size |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Lightbox without transitions | Jarring open/close, breaks immersion | Shared layout animation via Framer Motion |
| Upload without progress | Users unsure if upload is working | Per-file progress bars with percentage |
| Error messages without actions | Users stuck, don't know what to do | Error UI with retry/go back/contact support |
| Missing loading states | Blank space before content appears | Skeleton screens matching expected layout |
| Inconsistent button styles | Site feels "cobbled together" | Design system with documented variants |
| No empty states | Confusing when sections have no content | Friendly empty state with explanation |
| Album switching full reload | Slow, no animation, jarring | Keep state, animate transition, lazy load |

---

## "Looks Done But Isn't" Checklist

- [ ] **Gallery:** Often missing skeleton loaders — verify photos show skeleton before loading
- [ ] **Lightbox:** Often missing smooth transition — verify opens with animation, not instant
- [ ] **Upload:** Often missing progress feedback — verify progress bar shows for >1 second uploads
- [ ] **Admin:** Often missing bulk action confirmation — verify destructive actions ask for confirmation
- [ ] **Admin:** Often missing error recovery — verify page recovers after network failure
- [ ] **Error boundaries:** Often missing on admin pages — verify all admin pages have error boundary
- [ ] **Auth:** Often shows brief unauthenticated flash — verify redirects are instant, not visible
- [ ] **Seasonal features:** Often missing feature flag — verify components don't render by date alone
- [ ] **Consoles:** Often still has `console.log` — verify production build has no console output
- [ ] **Type consistency:** Often has duplicate types — verify Gallery uses imported Supabase types

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Breaking auth flow | HIGH | Revert auth changes, test session persistence, ensure single client instance |
| Upload data loss | HIGH | Implement upload queue persistence to localStorage, validate uploads before marking complete |
| Gallery state inconsistency | MEDIUM | Audit all state ownership, migrate to Zustand store, remove component state |
| Admin page crash | LOW | Add error boundary, implement retry UI, catch promise rejections |
| Type drift | LOW | Update imports, extend Supabase type, lint against duplicate definitions |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Photo Gallery "Feels Incomplete" | Phase 2: Gallery Performance & UX | Lighthouse score >90, no layout shift |
| Guest Upload Abandonment | Phase 3: Upload Experience Polish | >95% upload completion rate |
| Admin Tool Complexity Creep | Phase 4: Admin Controls & Moderation | Admin completes moderation without confusion |
| Breaking Auth During Refactor | Phase 1: Foundation & Auth Polish | Session persists across navigation, no race conditions |
| Seasonal Code Path Breakage | Phase 1: Foundation & Auth Polish | Error boundaries catch seasonal component failures |
| State Management Inconsistency | Phase 2: Gallery Performance & UX | State syncs across all routes |
| Photo Type Drift | Phase 1: Foundation & Auth Polish | No duplicate Photo type definitions |
| Console Errors in Production | Phase 1: Foundation & Auth Polish | Production build has zero console output |
| Dead UI After Network Errors | Phase 4: Admin Controls & Moderation | All admin pages recover gracefully |
| Rate Limiting Bypass | Phase 1: Foundation & Auth Polish | Edge Function enforces limits server-side |

---

## Sources

- Codebase analysis: `.planning/codebase/CONCERNS.md` (documented issues)
- Project context: `.planning/PROJECT.md` (requirements and constraints)
- Personal experience: Admin tool complexity, gallery state management patterns
- Known patterns: Supabase client consolidation, Zustand migration, React 19 concurrent features

---
*Pitfalls research for: Wedding Archive Website*
*Researched: 2026-04-23*