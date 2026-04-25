# Feature Research

**Domain:** Wedding archive website (theporadas.com) - v1.1 polish and feature expansion
**Researched:** 2026-04-24
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Gallery virtualization** | Users expect smooth scrolling with 200+ photos without lag or crashes | MEDIUM | Current PhotoGrid renders all photos at once - works at small scale but will struggle with larger albums. @tanstack/react-virtual is the standard solution. |
| **Guest reactions** | Modern social platforms have reactions; users click them reflexively | LOW | Guestbook already has reaction UI (emoji picker via Smile button, reactions stored in DB). Just needs to work consistently. |
| **Upload resume** | Network interruptions happen; users expect uploads to continue where they left off | MEDIUM | Current upload uses XHR with progress tracking. localStorage persistence would allow resume after page refresh or browser close. |
| **Guest upload status** | Users want to know if their submission was reviewed/approved | LOW | Currently shows "pending review" message on success. Needs visible status indicator visible to guest on confirmation and potentially tracking page. |
| **Social sharing with OG tags** | Users share wedding content; previews must look good on Facebook, X, Pinterest | LOW | SEOHead.tsx already has comprehensive OG tag support. Need dynamic per-photo/per-gallery sharing with correct og:image. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Featured content spotlight** | Creates editorial control over what guests see first; makes the archive feel curated, not just uploaded | MEDIUM | FeaturedContentManager.tsx already exists in admin. Need to wire it to homepage and ensure slots display correctly. |
| **PWA offline gallery browsing** | Guests may have limited connectivity at reception; offline access is a delightful surprise | HIGH | vite-plugin-pwa already configured. Workbox handles caching. Need to verify full gallery works offline including images from Supabase storage. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Real-time sync of reactions** | "Why doesn't my reaction appear instantly?" | Requires Supabase Realtime subscription; adds cost, complexity, and potential for inconsistencies | Optimistic updates (already in Guestbook.tsx) - reactions update locally immediately, sync in background |
| **Photo comments** | "Let me tag friends in photos" | Adds moderation burden, notification complexity, and potential for abuse | People gallery with face tagging (already exists) handles the "who was there" use case |
| **Push notifications for new uploads** | "Notify me when new photos are approved" | Requires service worker push setup, user permission, and ongoing infrastructure | Email notification on approval (already in upload flow) |

## Feature Dependencies

```
[Guest upload status] ───enhances──> [Upload resume]
     │
     └──requires──> [Moderation queue expansion]

[Featured content spotlight] ──requires──> [Moderation queue expansion]

[Social sharing with OG tags]
     │
     └──requires──> [Per-photo OG image generation] (for gallery shares)

[PWA offline gallery browsing]
     │
     └──requires──> [Service worker image caching strategy]
```

### Dependency Notes

- **Guest upload status requires moderation queue expansion:** Can't show "your photo is approved" without the approval workflow existing.
- **Featured content spotlight requires moderation queue expansion:** Admins highlight approved content; needs the approve workflow first.
- **Social sharing with OG tags requires per-photo OG image:** When sharing a specific photo, the og:image should be that photo, not the default site image.
- **PWA offline gallery browsing requires service worker image caching strategy:** Supabase storage URLs must be cached by Workbox; need custom runtime caching handler.

## MVP Definition

### Launch With (v1.1)

Minimum viable product - what's needed to validate the concept.

- [ ] **Gallery virtualization** - @tanstack/react-virtual on PhotoGrid; renders only visible photos + overscan
- [ ] **Guest reactions** - Ensure reaction picker works consistently; fix any edge cases in optimistic updates
- [ ] **Social sharing with OG tags** - Per-page OG meta, dynamic og:image for gallery shares
- [ ] **Upload resume** - localStorage queue persistence; detect incomplete uploads on page load
- [ ] **Guest upload status** - Post-submission status page showing pending/approved/rejected states

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] **Featured content spotlight** - Wire FeaturedContentManager to homepage display
- [ ] **PWA offline verification** - Full offline gallery test; fix any caching gaps

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Gallery virtualization | HIGH - Performance at scale | MEDIUM | P1 |
| Guest reactions polish | MEDIUM - Existing feature | LOW | P1 |
| Social sharing with OG tags | HIGH - Share quality | LOW | P1 |
| Upload resume | HIGH - Reliability | MEDIUM | P2 |
| Guest upload status | HIGH - Trust/closure | LOW | P2 |
| Featured content spotlight | MEDIUM - Editorial control | MEDIUM | P2 |
| PWA offline verification | MEDIUM - Edge case handling | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Detailed Feature Behavior

### Gallery Virtualization

**Expected behavior:**
- Initial render: Show first ~24 photos (viewport + overscan)
- Scroll: New photos render as they enter viewport; old photos unmount when leaving
- No scroll position jumps (virtualizer must measure items correctly)
- Maintain masonry layout with varying heights
- Lightbox opens correctly for virtualized items

**Implementation approach:**
- Use `@tanstack/react-virtual` with `useVirtualizer` hook
- Two approaches for masonry:
  1. Row-based virtualization (simpler): Virtualize rows, each row contains items
  2. Column-based with absolute positioning (more complex but true masonry)
- Recommended: Row-based for v1 since PhotoGrid has `viewMode` prop - can virtualize standard grid mode and keep masonry as-is or virtualize rows in masonry
- Overscan: 4 items above/below viewport to prevent blank spaces during fast scroll

**Known challenges:**
- Masonry grid with varying heights requires measuring after render
- LQIP (Low Quality Image Placeholder) blur-up effect may conflict with virtualization timing
- Framer Motion animations on mount need to work with virtualizer's mount/unmount

### Guest Reactions

**Expected behavior:**
- Click "Add a reaction" button on message → reaction picker appears
- Select emoji → reaction count increments optimistically
- Supabase update happens in background
- Reaction picker closes after selection
- Users can add one of each reaction type per message

**Current state (Guestbook.tsx):**
- Reaction picker exists (reactionPickerForId state)
- REACTION_TYPES array: love, clap, laugh, wow with emoji
- handleAddReaction updates localReactions optimistically then calls Supabase
- Reactions stored as JSON in `reactions` column

**Edge cases to fix:**
- Reaction picker closes on outside click? (Currently only X button)
- What happens if Supabase update fails? (Currently silently fails - optimistic update stays)
- Rate limiting on reactions? (Not currently implemented)

### Social Sharing with OG Tags

**Expected behavior:**
- Share button on each photo → opens share modal with correct og:image
- Pinterest: Uses specific image URL
- Twitter: Card with image preview
- Facebook: Rich preview with correct image
- Copy link: Copies URL with correct OG meta

**Current state (ShareButton.tsx, SEOHead.tsx):**
- ShareButton.tsx: Has native share, copy link, email, Facebook, Twitter, Pinterest
- SEOHead.tsx: Comprehensive OG tags including og:image:width/height, twitter:card
- DEFAULT_SOCIAL_IMAGE used as fallback
- GallerySEO accepts shareImage prop for custom images

**What's missing:**
- Per-photo share: PhotoGrid needs share button on each photo that passes that photo's URL as og:image
- Share modal needs to show a preview of what will be shared
- URL for shared photo should be /gallery?photo={id} format to land on correct image

### Upload Resume

**Expected behavior:**
- User selects files, starts upload
- Page refreshes or browser closes mid-upload
- User returns to upload page
- Previously selected files (that didn't complete) are restored
- User can resume from where they left off

**Implementation approach:**
- Persist upload queue to localStorage: `{ files: [{ id, name, size, type, status, progress, publicUrl? }] }`
- On page load (Upload.tsx mount): Check localStorage for incomplete uploads
- If found: Show "You have incomplete uploads - resume or clear" prompt
- Resume: Re-upload files with status 'pending' (not 'complete')
- Completed uploads: Don't re-upload; use existing publicUrl

**Edge cases:**
- File on disk is no longer accessible (user closed browser without File object)
- Handle case gracefully - can't resume video files if user doesn't have original
- Clear queue when submission succeeds

### Guest Upload Status

**Expected behavior:**
- After submitting upload, user sees confirmation with status
- Status: "Your photo is being reviewed" (pending)
- User can return to site later and check status (email-based lookup?)

**Implementation approach:**
- Use Supabase to track guest_uploads.status: 'pending' | 'approved' | 'rejected'
- After submission: Show "pending review" status
- Optional: Email guest when status changes (needs email template + trigger)
- On Upload page: Add "Check your submission status" input (email lookup)

**Current state:**
- Success screen shows "pending review" messaging
- No way to check status later without email

### Featured Content Spotlight

**Expected behavior:**
- Admin selects content for spotlight slot (home_moment_of_the_week, home_newest_standout_upload, etc.)
- Content appears on homepage in designated spot
- Guests can click through to the featured content

**Current state:**
- FeaturedContentManager.tsx: Admin UI for managing 4 slots
- Slots stored in site_editorial_features table
- Homepage has GuestHighlightReel but may not be connected to editorial features

**What's missing:**
- Homepage display: Verify spotlight content renders in correct location
- Ensure lightbox modal opens when clicking featured content
- Add analytics tracking for spotlight clicks

### PWA Offline Gallery Browsing

**Expected behavior:**
- User installs PWA (Add to Home Screen)
- Later opens PWA with no internet connection
- Gallery page loads with cached images
- User can browse entire gallery (or at least previously viewed photos)
- Lightbox works for cached photos

**Current state (vite.config.js):**
- VitePWA configured with autoUpdate
- Workbox settings: cleanupOutdatedCaches, clientsClaim, skipWaiting
- Manifest includes shortcuts to Gallery and Guest Book

**What's missing:**
- Service worker needs custom runtime caching for Supabase storage URLs
- Current workbox config doesn't explicitly cache /gallery route
- Images from Supabase CDN (storage.supabase.co) need cache strategy
- Strategy: CacheFirst for images, NetworkFirst for API calls

## Competitor Feature Analysis

| Feature | Typical Wedding Platform | Our Approach |
|---------|--------------------------|--------------|
| Gallery virtualization | Standard pagination or lazy load | Virtualization for smooth 200+ scroll |
| Guest reactions | Limited or none | Emoji reactions on guestbook (differentiator) |
| Upload resume | Often missing | Persist queue to localStorage |
| Upload status | Often missing | Status page + email notification |
| Featured spotlight | Often missing | Admin-controlled editorial slots |
| Social sharing | Basic share buttons | Dynamic per-photo OG tags |
| PWA offline | Rare for weddings | Full offline gallery support |

## Sources

- Project codebase: PhotoGrid.tsx, Guestbook.tsx, Upload.tsx, SEOHead.tsx, FeaturedContentManager.tsx, vite.config.js
- vite-plugin-pwa documentation (vite.config.js references)
- @tanstack/react-virtual patterns (standard approach for React virtualization)
- Supabase documentation for storage caching strategies

---
*Feature research for: wedding archive v1.1 features*
*Researched: 2026-04-24*