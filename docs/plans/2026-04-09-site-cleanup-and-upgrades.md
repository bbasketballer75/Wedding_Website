# Site Cleanup & Upgrades Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove voice/video from the guestbook (text-only), delete the anniversary section entirely, upgrade Guest Memories to a full masonry gallery, fix the sitemap, and establish a performance baseline.

**Architecture:** Each task is independent and should be committed separately. The DB migrations must run first since the TypeScript/UI changes depend on the schema. Anniversary removal touches ~15 files — do them as one atomic commit. Guest Memories is a page rewrite — reuse existing `PhotoGrid` + `PhotoLightbox` components, don't invent new ones.

**Tech Stack:** React 19, TypeScript, Supabase (Postgres), Playwright e2e, Vite, Netlify, `sitemap` npm package.

---

## Task 1: DB Migrations

**Files:**

- Run via Supabase MCP or `supabase migration new` locally

### Step 1: Drop `type` column from guestbook_messages

Run in Supabase SQL editor or via MCP `execute_sql`:

```sql
ALTER TABLE guestbook_messages DROP COLUMN IF EXISTS type;
```

### Step 2: Drop anniversary_entries table

```sql
DROP TABLE IF EXISTS anniversary_entries CASCADE;
```

> **Caution:** `CASCADE` drops any dependent views/foreign keys. There are none in this project, but confirm before running.

### Step 3: Verify

```sql
-- Should return 0 columns named "type"
SELECT column_name FROM information_schema.columns
WHERE table_name = 'guestbook_messages' AND column_name = 'type';

-- Should return 0 rows
SELECT COUNT(*) FROM information_schema.tables
WHERE table_name = 'anniversary_entries';
```

### Step 4: Commit

```bash
git commit -m "chore(db): drop guestbook type column and anniversary_entries table"
```

---

## Task 2: Guestbook — Text Only

**Files:**

- Modify: `src/lib/supabase.ts` (GuestbookMessage interface)
- Modify: `src/pages/Guestbook.tsx`
- Modify: `src/pages/admin/GuestbookModeration.tsx`
- Modify: `tests/e2e/support/adminMockData.ts`
- Modify: `tests/e2e/admin-workflows.spec.ts`
- Regenerate: `tests/e2e/admin-visuals.spec.ts-snapshots/admin-guestbook-desktop-chromium-win32.png`

### Step 1: Remove `type` from GuestbookMessage interface

In `src/lib/supabase.ts`, find the `GuestbookMessage` interface (~line 86). Remove the `type` field:

```ts
// BEFORE
export interface GuestbookMessage {
  id: string
  name: string
  content: string
  type: 'text' | 'voice' | 'video'
  media_url?: string | null
  // ...
}

// AFTER
export interface GuestbookMessage {
  id: string
  name: string
  content: string
  media_url?: string | null
  // ...
}
```

Also remove the `p_type` parameter from the `submitGuestbookMessage` RPC call if it exists there (grep for `p_type`).

### Step 2: Clean up Guestbook.tsx

In `src/pages/Guestbook.tsx`:

- Remove the `MessageType = 'text' | 'voice' | 'video'` type definition
- Remove the `ActiveFilter = 'all' | MessageType` type definition
- Remove any filter state (`const [filter, setFilter]`) related to message type
- Remove any voice/video recording UI or stub code
- Keep the text submission form as-is (it already hardcodes `p_type: 'text'`)
- If `p_type` is still passed in the submission call, remove that argument entirely now that the column is gone

### Step 3: Clean up GuestbookModeration.tsx

In `src/pages/admin/GuestbookModeration.tsx`:

Remove the filter state (line ~23):

```ts
// Remove this line:
const [filter, setFilter] = useState<'all' | 'text' | 'voice' | 'video'>('all')
```

Remove the filtered messages logic (line ~151):

```ts
// Remove or simplify:
const filteredMessages = messages.filter(message => {
  if (filter !== 'all' && message.type !== filter) return false
  // ...
})
// Replace with:
const filteredMessages = messages
```

Remove the filter button UI block (lines ~163-189, the four filter buttons with `guestbook-filter-*` testids).

Remove the `message_type` field from audit log metadata if present (~line 80):

```ts
// Remove: message_type: message.type,
```

### Step 4: Update adminMockData.ts

In `tests/e2e/support/adminMockData.ts`, remove `type` from all three mock guestbook messages:

```ts
// BEFORE
{ id: 'msg-1', name: 'Sarah Mitchell', type: 'text', content: '...', ... }
{ id: 'msg-2', name: 'Mike Chen', type: 'voice', content: '...', ... }
{ id: 'msg-3', name: 'Aunt Patricia', type: 'video', content: '...', ... }

// AFTER
{ id: 'msg-1', name: 'Sarah Mitchell', content: '...', ... }
{ id: 'msg-2', name: 'Mike Chen', content: '...', ... }
{ id: 'msg-3', name: 'Aunt Patricia', content: '...', ... }
```

Also remove any `message_type` field from `auditLogEntries`.

### Step 5: Update admin-workflows.spec.ts

Remove the entire `'filter by "text" shows only text-type messages'` test — the filter UI no longer exists. Remove lines ~65-75.

### Step 6: Run TypeScript check

```bash
npx tsc --noEmit
```

Expected: no errors.

### Step 7: Run affected tests

```bash
npx playwright test admin-workflows.spec.ts admin-a11y.spec.ts --workers=1
```

Expected: all pass.

### Step 8: Regenerate guestbook visual snapshot

```bash
npx playwright test admin-visuals.spec.ts --grep "guestbook" --update-snapshots --workers=1
```

### Step 9: Commit

```bash
git add src/lib/supabase.ts src/pages/Guestbook.tsx src/pages/admin/GuestbookModeration.tsx \
  tests/e2e/support/adminMockData.ts tests/e2e/admin-workflows.spec.ts \
  tests/e2e/admin-visuals.spec.ts-snapshots/admin-guestbook-desktop-chromium-win32.png
git commit -m "feat(guestbook): remove voice/video — text-only messages"
```

---

## Task 3: Remove Anniversary Entirely

**Files to delete:**

- `src/pages/Anniversary.tsx`
- `src/pages/admin/AnniversaryManager.tsx`
- `tests/e2e/anniversary.spec.ts`
- `tests/e2e/admin-visuals.spec.ts-snapshots/admin-anniversary-desktop-chromium-win32.png`

**Files to modify:**

- `src/components/seo/SEOHead.tsx` — remove `AnniversarySEO` export
- `src/App.tsx` — remove lazy import + public route + admin route
- `src/pages/admin/AdminLayout.tsx` — remove `AnniversaryManager` lazy import + route
- `src/lib/supabase.ts` — remove `AnniversaryEntry` interface + 4 service functions
- `tests/e2e/smoke.spec.ts` — remove anniversary test
- `tests/e2e/seo.spec.ts` — remove anniversary route entry
- `tests/e2e/a11y.spec.ts` — remove `/anniversary` from routes array
- `tests/e2e/admin-shell.spec.ts` — remove `/admin/anniversary` from routes array
- `tests/e2e/admin-a11y.spec.ts` — remove `/admin/anniversary` from routes array
- `tests/e2e/admin-visuals.spec.ts` — remove anniversary test block
- `tests/e2e/support/adminMockData.ts` — remove `anniversaryEntriesAdmin` export
- `tests/e2e/support/adminSite.ts` — remove anniversary route mock
- `tests/e2e/support/mockData.ts` — remove `anniversaryEntries` export
- `tests/e2e/support/publicSite.ts` — remove anniversary mock route intercept

> **DO NOT delete** `src/components/sections/AnniversaryCountdown.tsx` — it is imported by `src/pages/Home.tsx` and must stay.

### Step 1: Delete the page files

```bash
rm src/pages/Anniversary.tsx
rm src/pages/admin/AnniversaryManager.tsx
rm tests/e2e/anniversary.spec.ts
rm "tests/e2e/admin-visuals.spec.ts-snapshots/admin-anniversary-desktop-chromium-win32.png"
```

### Step 2: SEOHead.tsx — remove AnniversarySEO

In `src/components/seo/SEOHead.tsx`, find and delete the `AnniversarySEO` named export function.

### Step 3: App.tsx — remove anniversary route

Remove:

```ts
const Anniversary = lazy(() => import('@/pages/Anniversary'))
```

Remove the entire `<Route path="/anniversary">` block:

```tsx
// Remove:
<Route
  path='/anniversary'
  element={
    <RouteErrorBoundary>
      <LazyPage title='Our Anniversary'>
        <Anniversary />
      </LazyPage>
    </RouteErrorBoundary>
  }
/>
```

Also remove `'/anniversary': 'Our Anniversary'` from the titles map (~line 75).

### Step 4: AdminLayout.tsx — remove AnniversaryManager route

Remove:

```ts
const AnniversaryManager = lazy(() => import('./AnniversaryManager'))
```

Remove both `<Route path="anniversary" element={<AnniversaryManager />} />` occurrences (~lines 117 and 186).

Also remove the "Anniversary" nav item from the sidebar nav array if present.

### Step 5: supabase.ts — remove anniversary service code

Remove these items (around lines 849-897):

- `AnniversaryEntry` interface
- `fetchPublishedAnniversaryEntries()` function
- `fetchAllAnniversaryEntries()` function
- `upsertAnniversaryEntry()` function
- `deleteAnniversaryEntry()` function

### Step 6: Update test support files

**`tests/e2e/support/mockData.ts`**: Remove `anniversaryEntries` export and its data.

**`tests/e2e/support/publicSite.ts`**: Remove the `anniversary_entries` route intercept from `installPublicMocks`.

**`tests/e2e/support/adminMockData.ts`**: Remove `anniversaryEntriesAdmin` export and its data.

**`tests/e2e/support/adminSite.ts`**: Remove the `anniversary_entries` route intercept from `installAdminMocks`.

### Step 7: Update spec files

**`tests/e2e/smoke.spec.ts`**: Delete the `'@smoke anniversary page loads'` test block.

**`tests/e2e/seo.spec.ts`**: Remove the `{ route: '/anniversary', ... }` entry from the routes array.

**`tests/e2e/a11y.spec.ts`**: Remove `'/anniversary'` from the `defaultRoutes` array.

**`tests/e2e/admin-shell.spec.ts`**: Remove `'/admin/anniversary'` from the routes array.

**`tests/e2e/admin-a11y.spec.ts`**: Remove `'/admin/anniversary'` from the `a11yRoutes` array.

**`tests/e2e/admin-visuals.spec.ts`**: Remove the `'admin anniversary — desktop'` test block.

### Step 8: TypeScript check

```bash
npx tsc --noEmit
```

Expected: no errors.

### Step 9: Full test run

```bash
npx playwright test --workers=1
```

Expected: all remaining tests pass (count will be lower — anniversary tests removed).

### Step 10: Commit

```bash
git add -A
git commit -m "feat: remove anniversary section entirely"
```

---

## Task 4: Guest Memories — Gallery-Style Masonry

**Files:**

- Rewrite: `src/pages/GuestMemories.tsx`
- Modify: `tests/e2e/guest-memories.spec.ts`
- Regenerate: `tests/e2e/guest-memories.spec.ts-snapshots/`

**Goal:** Replace per-upload cards with individual photo cards in a masonry grid that visually matches the main Gallery page. Reuse `PhotoGrid` and `PhotoLightbox` — no new components.

### Step 1: Understand the data shape

`GuestUpload` has:

```ts
{
  id: string
  guest_name: string
  guest_email: string
  message: string | null
  photo_urls: string[]   // array of photo URLs
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}
```

`PhotoGrid` expects each photo to have:

```ts
{
  id: string
  url: string
  thumbnail: string  // can be same as url
  caption?: string
  photographer?: string
  likes?: number
  aspectRatio?: number
  source?: 'professional' | 'guest'
  collection?: string
}
```

Transform: for each `upload`, for each `url` in `upload.photo_urls`:

```ts
{
  id: `${upload.id}-${photoIndex}`,
  url,
  thumbnail: url,
  caption: upload.message ?? undefined,
  photographer: upload.guest_name,
  source: 'guest' as const,
}
```

### Step 2: Rewrite GuestMemories.tsx

Replace the file contents with:

```tsx
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Camera, Upload } from 'lucide-react'
import { fetchApprovedGuestUploads } from '@/lib/supabase'
import type { GuestUpload } from '@/lib/supabase'
import { PhotoGrid } from '@/components/gallery/PhotoGrid'
import { PhotoLightbox } from '@/components/photo-viewer/PhotoLightbox'
import { Button } from '@/components/ui/Button'
import { GuestMemoriesSEO } from '@/components/seo/SEOHead'

interface FlatPhoto {
  id: string
  url: string
  thumbnail: string
  caption?: string
  photographer?: string
  source: 'guest'
}

function flattenUploads(uploads: GuestUpload[]): FlatPhoto[] {
  return uploads.flatMap(upload =>
    upload.photo_urls.map((url, i) => ({
      id: `${upload.id}-${i}`,
      url,
      thumbnail: url,
      caption: upload.message ?? undefined,
      photographer: upload.guest_name,
      source: 'guest' as const,
    }))
  )
}

export default function GuestMemories() {
  const [uploads, setUploads] = useState<GuestUpload[]>([])
  const [loading, setLoading] = useState(true)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const data = await fetchApprovedGuestUploads()
        if (mounted) setUploads(data)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [])

  const photos = flattenUploads(uploads)

  function handlePhotoClick(_photo: FlatPhoto, index: number) {
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  return (
    <div data-testid='guest-memories-page' className='min-h-screen bg-cream-50'>
      <GuestMemoriesSEO />

      <div className='mx-auto max-w-7xl px-4 pb-20 pt-10 sm:pt-14'>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className='mb-10 sm:mb-14'
        >
          <div className='flex items-center gap-2 mb-4'>
            <Camera className='h-4 w-4 text-gold-500' />
            <span className='text-xs font-medium uppercase tracking-[0.22em] text-gold-600'>
              Guest Memories
            </span>
          </div>
          <h1 className='font-display text-4xl text-charcoal-900 sm:text-5xl mb-4'>
            Your side of the day.
          </h1>
          <p className='max-w-2xl text-charcoal-500 text-lg leading-relaxed'>
            Phone shots, candid moments, and quiet details from the people who were there.
          </p>
          <div className='mt-6 flex items-center gap-3'>
            <span className='text-sm text-charcoal-400'>
              {loading ? '…' : `${photos.length} photo${photos.length === 1 ? '' : 's'}`}
            </span>
            <Link to='/upload'>
              <Button variant='secondary' size='sm' className='gap-2'>
                <Upload className='h-4 w-4' />
                Share your photos
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Gallery */}
        {loading ? (
          <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 animate-pulse'>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className='aspect-[3/4] rounded-[1.8rem] bg-charcoal-100/60' />
            ))}
          </div>
        ) : photos.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className='py-24 text-center'
          >
            <p className='text-charcoal-500 mb-8 max-w-sm mx-auto'>
              No guest photos yet. Be the first to share a moment from the day.
            </p>
            <Link to='/upload'>
              <Button size='lg' className='gap-2'>
                <Upload className='h-4 w-4' />
                Share your photos
              </Button>
            </Link>
          </motion.div>
        ) : (
          <PhotoGrid photos={photos} onPhotoClick={handlePhotoClick} />
        )}
      </div>

      <PhotoLightbox
        photos={photos}
        currentIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onNavigate={setLightboxIndex}
      />
    </div>
  )
}
```

### Step 3: Update guest-memories e2e test

In `tests/e2e/guest-memories.spec.ts`, the old test likely checked for per-upload card elements. Update to:

- Check that `[data-testid="guest-memories-page"]` renders
- Check that the masonry grid renders (look for the MasonryGrid container or `role="button"` photo cards)
- Regenerate visual snapshots

### Step 4: TypeScript check

```bash
npx tsc --noEmit
```

### Step 5: Run test + regenerate snapshots

```bash
npx playwright test guest-memories.spec.ts --update-snapshots --workers=1
```

### Step 6: Full test run

```bash
npx playwright test --workers=1
```

Expected: all pass.

### Step 7: Commit

```bash
git add src/pages/GuestMemories.tsx tests/e2e/guest-memories.spec.ts \
  tests/e2e/guest-memories.spec.ts-snapshots/
git commit -m "feat(guest-memories): upgrade to masonry gallery matching main gallery"
```

---

## Task 5: Sitemap — Add Missing Routes

**Files:**

- Modify: `scripts/generate-sitemap.js`

### Step 1: Update routes array

In `scripts/generate-sitemap.js`, replace the `routes` array:

```js
// BEFORE
const routes = [
  { url: '/', changefreq: 'weekly', priority: 1.0 },
  { url: '/film', changefreq: 'monthly', priority: 0.9 },
  { url: '/gallery', changefreq: 'monthly', priority: 0.8 },
  { url: '/guestbook', changefreq: 'weekly', priority: 0.8 },
  { url: '/upload', changefreq: 'weekly', priority: 0.7 },
]

// AFTER
const routes = [
  { url: '/', changefreq: 'weekly', priority: 1.0 },
  { url: '/film', changefreq: 'monthly', priority: 0.9 },
  { url: '/gallery', changefreq: 'monthly', priority: 0.8 },
  { url: '/guestbook', changefreq: 'weekly', priority: 0.8 },
  { url: '/guest-photos', changefreq: 'weekly', priority: 0.7 },
  { url: '/people', changefreq: 'monthly', priority: 0.6 },
  { url: '/upload', changefreq: 'weekly', priority: 0.7 },
]
```

> Static routes only — no dynamic entries needed for a wedding site. Admin routes are excluded intentionally.

### Step 2: Check the build script hook

In `package.json`, verify `generate-sitemap` runs as part of the build:

```bash
grep "sitemap\|postbuild\|prebuild" package.json
```

If the script only runs manually and isn't wired to build, add to the `"build"` script in package.json:

```json
"build": "vite build && node scripts/generate-sitemap.js"
```

### Step 3: Test the script runs

```bash
node scripts/generate-sitemap.js
```

Expected output:

```
✅ Sitemap generated successfully!
✅ Robots.txt generated successfully!
```

Check `dist/sitemap.xml` contains all 7 routes.

### Step 4: Commit

```bash
git add scripts/generate-sitemap.js package.json
git commit -m "chore(seo): add guest-photos and people to sitemap, remove anniversary"
```

---

## Task 6: Performance Baseline

**Files:**

- Create: `.lighthouserc.cjs`
- Modify: `package.json` (add `perf` script and `@lhci/cli` devDep)

**Goal:** Establish Lighthouse CI scores for the three heaviest pages (Home, Gallery, Film). Not a CI gate yet — just a baseline and a `npm run perf` command for ongoing monitoring.

### Step 1: Install @lhci/cli

```bash
npm install --save-dev @lhci/cli
```

### Step 2: Create .lighthouserc.cjs

```js
// .lighthouserc.cjs
module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:4173/',
        'http://localhost:4173/gallery',
        'http://localhost:4173/film',
        'http://localhost:4173/guest-photos',
      ],
      startServerCommand: 'npm run preview',
      startServerReadyPattern: 'Local',
      numberOfRuns: 1,
    },
    assert: {
      // Warn only — don't fail. Tighten these after reviewing the baseline.
      assertions: {
        'categories:performance': ['warn', { minScore: 0.6 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.8 }],
        'categories:seo': ['warn', { minScore: 0.9 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
}
```

### Step 3: Add perf script to package.json

```json
"scripts": {
  "perf": "npm run build && lhci autorun"
}
```

### Step 4: Run and review baseline

```bash
npm run perf
```

Look at the output scores for each page. Document any score below:

- Performance < 0.7 on any page → note which metric is dragging it (LCP, CLS, TBT)
- Accessibility < 0.95 → investigate (our a11y tests should have caught most issues)

### Step 5: Commit

```bash
git add .lighthouserc.cjs package.json package-lock.json
git commit -m "chore(perf): add Lighthouse CI baseline with npm run perf"
```

---

## Final Verification

After all tasks complete:

```bash
npx tsc --noEmit
npx playwright test --workers=1
```

Expected: 0 TypeScript errors, all Playwright tests pass (count lower than before — anniversary tests removed).

Then push:

```bash
git push origin main
```
