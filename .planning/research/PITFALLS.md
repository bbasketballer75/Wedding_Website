# Pitfalls Research

**Domain:** Wedding archive v1.1 feature expansion (adding moderation queue expansion, gallery virtualization, guest reactions, featured spotlight, social sharing, upload resume, PWA offline to existing system)
**Researched:** 2026-04-24
**Confidence:** MEDIUM

## Critical Pitfalls

### Pitfall 1: Gallery Virtualization — Lazy Loading Breakage with Masonry Layout

**What goes wrong:**
When adding `@tanstack/react-virtual` to the existing masonry photo grid, the virtualization library assumes uniform row heights, but the masonry layout uses variable height items based on image aspect ratios. This causes incorrect scroll calculations, items being clipped or overlapped, and blank spaces appearing between rows.

**Why it happens:**
The existing `MasonryGrid` component (PhotoGrid.tsx lines 23-43) distributes children across N columns by cycling through them (`i % columnCount`). This creates a column-based layout where row boundaries are undefined. Virtualizers work on flat lists with a defined primary axis — masonry's 2D column distribution breaks the virtualizer's size tracking and overscan logic.

**How to avoid:**
- Use a row-based virtualizer instead of item-based, where each "row" contains photos that fit within the viewport width
- Pre-calculate item heights with known aspect ratios before virtualization kicks in
- Consider switching to a standardized grid layout for virtualization, then apply masonry styling on top
- Use `useVirtualizer` with `getItemSize` returning a calculated row height that accounts for the tallest item in that row

**Warning signs:**
- Scroll position jumps when navigating to an already-visited section
- Blank gaps appearing in the masonry layout between rows
- Items being cut off at the bottom of the viewport
- Scroll height mismatch (scrollbar shows more content than is visible)

**Phase to address:**
02-gallery-performance — before implementing virtualization, verify the masonry layout can be adapted to row-based rendering.

---

### Pitfall 2: Guest Reactions — Optimistic Update Without Rollback

**What goes wrong:**
The guestbook already has `handleAddReaction` (Guestbook.tsx lines 296-309) that optimistically updates local state then calls Supabase. If the Supabase update fails (network error, RLS policy rejection), the local state has already changed but never syncs back. The user sees their reaction was added, but on page reload it disappears. The error catch does nothing — the optimistic update already applied.

**Why it happens:**
The current code pattern:
```typescript
setLocalReactions((prev) => { ... }) // optimistic update
await supabase.from('guestbook_messages').update({ reactions: updated }).eq('id', messageId)
// if this fails, local state already mutated, catch block is empty
```

The catch block only has `// optimistic update already applied` — no rollback. Subsequent renders use wrong `updated` value because `localReactions[messageId]` is stale when calculating the next increment.

**How to avoid:**
- Store previous state before mutation, restore it in the catch block
- Or use a proper optimistic update library (e.g., `@tanstack/react-query` with mutation) that handles rollback
- Verify RLS policies allow authenticated guests to update reactions

**Warning signs:**
- Reactions count differs between what user sees and what reload shows
- Console errors about Supabase update failing for guestbook_messages
- Reaction counts sometimes incrementing by 2 instead of 1

**Phase to address:**
02-gallery-performance — guest reactions are GALLERY-06, should be addressed in the same phase as virtualization.

---

### Pitfall 3: Featured Spotlight — Admin-Fetched Featured Images Not Reflected in Gallery Store

**What goes wrong:**
The Home page already has `GuestHighlightReel`, `MomentOfTheWeekSection`, `StandoutUploadSection`, `FeaturedNoteSection` components. The admin has `FeaturedContentManager.tsx`. But these featured images are fetched independently — they don't flow through the gallery store's `featuredImages`. Adding new spotlight features means querying Supabase separately for each section, duplicating data fetching logic.

**Why it happens:**
The `featuredImages` in `galleryStore.ts` (line 108) is derived from filtering `images` by `type === 'main' || type === 'featured'`. But admin-selected featured content may come from a separate `site_editorial_features` table or have custom metadata that doesn't fit the existing Photo type schema.

**How to avoid:**
- Extend the `Photo` type or `GalleryImage` to include a `spotlightPriority` field
- Create a dedicated `featuredContentStore` or add to `uiStore` for editorial spotlight data
- Fetch featured content once at the app level and pass down via context, rather than each section fetching independently
- Ensure the Supabase schema for `site_editorial_features` is properly typed and imported

**Warning signs:**
- Multiple `supabase.from('...').select()` calls on the Home page for different featured sections
- Featured images not persisting across sessions despite being "saved" in admin
- Inconsistency between what admin marks as featured and what appears on Home

**Phase to address:**
02-gallery-performance — GALLERY-07 featured spotlight should be validated against existing admin feature management.

---

### Pitfall 4: Social Sharing — Dynamic OG Tags Set by useEffect Not Crawled by Share Bots

**What goes wrong:**
The `SEOHead` component (SEOHead.tsx lines 70-149) uses `useEffect` to set OG meta tags dynamically. Social media crawlers (Facebook, Twitter, LinkedIn) run headless browsers that fetch the initial HTML before JavaScript executes. The crawlers see the default HTML shell, not the dynamically injected OG tags.

**Why it happens:**
React renders to the DOM, but crawlers see the raw HTML response. The `<meta>` tags injected via `useEffect` don't exist in the server-sent HTML. For a static site deployed to Netlify, there's no server-side rendering to pre-populate these tags.

**How to avoid:**
- Use a meta tag approach that sets initial values in the HTML `<head>` before React hydrates (SSR-equivalent via Vite plugin or index.html template)
- For React Router SPA, use `vite-plugin-ssr` or `@vitejs/plugin-react-ssr` to render initial route on server
- Alternatively, generate static per-page HTML with correct OG tags at build time
- At minimum, ensure the `index.html` has default OG tags that are reasonable

**Warning signs:**
- Shared links on Facebook show incorrect thumbnail or title
- Twitter card validator shows "WARNING: No metatags found"
- Open Graph debugger shows JavaScript-altered content differently than browser view

**Phase to address:**
02-gallery-performance — SOCIAL-01 and SOCIAL-02 should include SEO verification with social media debuggers.

---

### Pitfall 5: Upload Resume — File Objects Not Serializable to localStorage

**What goes wrong:**
Attempting to persist the upload queue to localStorage fails silently. `File` objects (from `<input type="file">`) cannot be serialized — they're a browser construct referencing binary data, not a plain object. The `UploadingFile` interface has `file: File` which will be dropped or throw a circular reference error when `JSON.stringify` is attempted.

**Why it happens:**
The `persist` middleware in zustand uses `createJSONStorage` with localStorage, which calls `JSON.stringify`. `File` objects are not JSON-serializable — they have no primitive representation of their binary content. The safeSessionStorage wrapper in galleryStore.ts catches errors but silently falls back to memory-only.

**How to avoid:**
- Store only metadata in localStorage: file name, size, type, lastModified, and a fingerprint (SHA-256 hash already computed in `buildFileFingerprint` at Upload.tsx lines 83-98)
- On app reload, read the queue from localStorage and re-prompt the user to re-select files from their device
- Store `publicUrl` and `status` for completed uploads so they're not re-uploaded
- Store failed uploads' fingerprints so they can be auto-retried or flagged
- Never attempt to store the `File` object itself

**Warning signs:**
- localStorage setItem throwing QuotaExceededError despite having space
- Queue appearing empty after page reload despite previous uploads
- Console errors about structured clone failing

**Phase to address:**
02-gallery-performance — ADV-02 upload resume depends on proper file metadata serialization, not File object persistence.

---

### Pitfall 6: PWA Offline — Cache Invalidation Causes White Screen on Update

**What goes wrong:**
After deploying a new version, returning users see a white screen. The service worker has cached the app shell (HTML, CSS, JS bundles), but the new JavaScript bundles have different hashes. The old SW serves the old HTML with new JS that doesn't match, causing runtime errors.

**Why it happens:**
VitePWA's `workbox` config has `skipWaiting: true` and `clientsClaim: true` (vite.config.js lines 191-195), which means the new SW activates immediately. But the app itself (the JavaScript running in the browser) was loaded from the OLD SW cache. When the page reloads, it loads the new SW, but the app bundle is now out of sync with the cached HTML.

**How to avoid:**
- Ensure the `manifest.webmanifest` includes a `version` field or use `registerType: 'prompt'` instead of `'autoUpdate'` to give users control over when to refresh
- Add a `version` query parameter to asset URLs in development to prevent caching during iteration
- Implement an "update available" notification component that prompts users to reload
- After each deploy, verify the SW cache is cleared by checking `navigator.serviceWorker.controller` state

**Warning signs:**
- Users reporting white screens after site updates
- Bundle hash mismatch errors in browser console
- Service worker registration failing with "Active Script URL mismatch"

**Phase to address:**
02-gallery-performance — ADV-01 PWA offline verification should include testing the update flow.

---

### Pitfall 7: Moderation Queue — Expanding Workflow Without RLS Policy Audit

**What goes wrong:**
Adding approve/reject/feature workflow (ADMIN-05, ADMIN-06, ADMIN-07) to the moderation queue introduces new database operations. If RLS policies aren't updated to handle the new operations, moderators lose ability to update content they could previously modify. Or overly permissive new policies expose pending content publicly.

**Why it happens:**
The existing moderation system likely has policies for `photos` and `guest_uploads` but the new "feature" workflow may touch `site_editorial_features` table which has different access patterns. Admin actions that worked before stop working, or pending content becomes visible when it shouldn't.

**How to avoid:**
- Audit all RLS policies before adding new moderation actions
- Test each new workflow (approve, reject, feature) as both admin and unauthenticated guest
- Verify `site_editorial_features` table has appropriate policies for admin-only access
- Add feature flags to new workflows so they can be disabled without deploy

**Warning signs:**
- Admin clicks "feature" button but photo doesn't appear in featured section
- Pending content appears publicly before approval
- Supabase logs show RLS policy violations for moderation operations

**Phase to address:**
02-gallery-performance — moderation queue expansion should be tested with different user roles.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skipping OG tag SSR, using client-side injection | Faster initial development | Social sharing is broken for crawlers and some platforms | Never — wedding photos are share-heavy content |
| Virtualizing without row-based calculations | Seems simpler | Clipped items, broken scroll | Never — leads to unusable gallery |
| Storing File objects in localStorage | Appears to persist queue | Silent failure, broken resume | Never |
| Fetching featured content per section, not centralized | Isolated code | Duplicated queries, stale data | Only during initial prototyping |
| Using optimistic updates without rollback | Snappier UI | Data inconsistency, confused users | Only if using a library that handles it |
| Expanding moderation without RLS audit | Faster to ship | Security gap or broken admin actions | Never |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase RLS for reactions | Forgetting guests need write access to update their own reactions | Verify `guestbook_messages` RLS allows UPDATE for authenticated users; test as unauthenticated guest |
| VitePWA workbox | Not configuring `cleanupOutdatedCaches` — stale assets accumulate | Already configured in vite.config.js (line 192) — keep it |
| Social share buttons | Hardcoding site URL instead of reading `window.location.href` | Use `window.location.href` for per-page sharing, not just the homepage |
| SEO meta injection | Injecting tags after mount — not visible to crawlers | Either SSR or set default values in `index.html` template |
| Upload queue persistence | Assuming File objects serialize | Store metadata + fingerprint only, prompt for file re-selection on restore |
| Featured content vs gallery images | Admin-marked featured may not be in photo collection | Use separate editorial features table, sync with photo IDs |
| Moderation queue expansion | Adding new actions without updating RLS | Audit all affected tables before shipping new workflows |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Virtualizer with unknown item heights | Scroll position jumps, items overlap | Pre-measure images or use fixed aspect ratio containers | 200+ photos in gallery |
| PWA cache too aggressive | Updates don't appear, stale content | Use cache-first for images, network-first for HTML/JS | Any deploy |
| Zustand persist with large images array | localStorage quota exceeded | `partialize` state, exclude base64 image previews | Photos array > 50 items with metadata |
| Multiple featured content fetches | Slow Home page load, waterfalls | Fetch all editorial content in parallel, cache with SW | Home page > 3 sections fetching independently |
| Framer Motion on 200+ virtualized items | Memory bloat, slow animations | Use `layoutId` sparingly, disable animations for off-screen items | Gallery with masonry virtualization |
| Moderation queue expanding | Admin page slow to load with more items | Pagination, virtualized list, limit initial fetch | >100 pending items |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Guest reactions RLS too permissive | Any authenticated user could modify any guest's reactions | RLS policy should allow UPDATE only where user owns the reaction |
| Featured spotlight exposing unpublished photos | Photos pending moderation become publicly visible if featured | Featured content queries should filter by `status = 'approved'` |
| Upload resume revealing previous upload URLs | Anyone who accesses localStorage sees photo URLs they've uploaded | Only store fingerprints and status, not URLs, until admin approval |
| Social sharing leaking guest email | Sharing with certain platforms may expose email in URL parameters | Don't include email in share URL |
| Moderation action RLS too restrictive | Admin cannot approve/reject/feature content | Verify admin role has necessary UPDATE/UPDATE/INSERT permissions |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Virtualized gallery shows loading spinners when scrolling fast | Confusing, appears broken | Use skeleton placeholders with correct aspect ratios, show blurred LQIP while loading |
| Upload resume prompts for re-selecting files but doesn't explain why | User doesn't understand why their "uploaded" photos aren't there | Show clear explanation: "We stored your upload list but not the files themselves — please re-select to continue" |
| Social share shows generic site preview instead of context-specific photo | Less engagement, appears unprofessional | Use per-page OG tags via SSR, or at minimum use the specific photo as og:image when sharing from a photo page |
| PWA works for browsing but not uploading offline | User experience is inconsistent | Clearly communicate what works offline; queue uploads for when connection returns |
| Moderation queue shows no pending count | Admin doesn't know how much work awaits | Show count badge in admin navigation |

---

## "Looks Done But Isn't" Checklist

- [ ] **Virtualization:** Gallery with 200+ photos scrolls without items being cut off or blank gaps appearing
- [ ] **Virtualization:** Scroll position is preserved when navigating away and back
- [ ] **Guest reactions:** Reaction persists after page reload, not just in optimistic UI state
- [ ] **Guest reactions:** Error state is visible to user if Supabase update fails, not silently swallowed
- [ ] **Featured spotlight:** Admin-marked featured content appears on Home within 1 refresh cycle
- [ ] **Featured spotlight:** Featured photos don't include items pending moderation
- [ ] **Social sharing:** Facebook debugger shows correct og:title, og:description, og:image for each page type
- [ ] **Social sharing:** Shared links from photo detail pages show that specific photo as og:image
- [ ] **Upload resume:** Page reload preserves upload queue state in localStorage
- [ ] **Upload resume:** Restored queue shows file name/size/type correctly (not the File object itself)
- [ ] **PWA offline:** Gallery images load when device is in airplane mode
- [ ] **PWA offline:** Uploading while offline shows clear "waiting for connection" state
- [ ] **PWA offline:** After new deploy, existing users see the new version within 2 navigations
- [ ] **Moderation expansion:** All moderation actions (approve, reject, feature) work for admin
- [ ] **Moderation expansion:** Unauthenticated guest cannot see pending content even if it's featured

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Virtualization breaking masonry layout | MEDIUM | Fall back to non-virtualized grid with pagination, defer virtualization to v1.2 |
| Reactions not persisting | LOW | Implement proper rollback pattern in the catch block; patch is < 10 lines |
| Featured spotlight shows wrong content | MEDIUM | Add `status = 'approved'` filter to all featured content queries; verify with admin |
| OG tags not crawled | HIGH | Refactor SEOHead to use SSR-compatible approach (requires Netlify SSR setup or static generation) |
| Upload resume broken | MEDIUM | Switch from serializing File objects to storing metadata; user must re-select files but queue is preserved |
| PWA white screen after deploy | MEDIUM | Force-clear SW cache via DevTools, push `skipWaiting` fix, notify users to hard refresh |
| Moderation RLS issues | MEDIUM | Revert RLS changes, test per-table, re-apply with proper policies |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Gallery virtualization masonry breakage | 02-gallery-performance | Load 200+ photos, scroll through all, verify no cutoffs or blank gaps |
| Guest reaction optimistic update inconsistency | 02-gallery-performance | Submit reaction as guest, check DevTools Supabase call fails gracefully |
| Featured spotlight data sync | 02-gallery-performance | Mark photo as featured in admin, reload Home, verify it appears |
| Social OG tags not crawled | 02-gallery-performance | Use Facebook Sharing Debugger and Twitter Card Validator |
| Upload resume File object serialization | 02-gallery-performance | Reload page mid-upload, verify queue metadata restored |
| PWA offline gallery browsing | 02-gallery-performance | Enable airplane mode, navigate gallery, verify images load |
| PWA update white screen | 02-gallery-performance | Deploy update, visit site as returning user, verify no white screen |
| Moderation queue RLS gaps | 02-gallery-performance | Test all moderation actions as admin, verify pending content stays hidden |

---

## Sources

- TanStack Virtual documentation — row-based virtualization patterns
- Supabase RLS policy documentation — reaction update permissions
- VitePWA workbox configuration — cache invalidation strategies
- React SPA SEO best practices — OG tag injection limitations
- MDN Web Docs — File object serialization constraints
- Web.dev — PWA update strategies
- Codebase analysis: Gallery components (PhotoGrid.tsx, MasonryGrid.tsx, galleryStore.ts, Upload.tsx, Guestbook.tsx, SEOHead.tsx, vite.config.js)

*Pitfalls research for: wedding archive v1.1 feature expansion*
*Researched: 2026-04-24*