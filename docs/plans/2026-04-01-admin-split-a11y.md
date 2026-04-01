# Admin Code-Split, A11y Fixes & Console Drop — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split 3,880-line Admin.tsx into per-section files with lazy loading, add focus traps to ShareModal and PhotoLightbox, and drop console calls from the production bundle.

**Architecture:** All changes land on a single feature branch in a worktree. Admin sections are extracted into `src/pages/admin/` files and loaded lazily inside `AdminLayout`. A11y fixes use the inline focus-trap pattern (no new libs). The drop_console fix is one line in vite.config.js.

**Tech Stack:** React 19, TypeScript, React Router v6, Framer Motion, Tailwind, Vite/Terser, Playwright

---

## Task 0: Set up worktree & branch

**Files:** none

**Step 1: Create worktree**

```bash
cd C:/Users/bbask/Coding_Projects/Wedding_Website_Clean
git worktree add .worktrees/admin-split -b feature/admin-split
cd .worktrees/admin-split
```

**Step 2: Verify TypeScript is clean at baseline**

```bash
npx tsc --noEmit
```
Expected: no errors

---

## Task 1: Drop console calls from production bundle

**Files:**
- Modify: `vite.config.js:236`

**Step 1: Apply the change**

In `vite.config.js`, find the `terserOptions.compress` block and change:
```js
drop_console: false,
```
to:
```js
drop_console: true,
```

**Step 2: Verify build still works**

```bash
npx tsc --noEmit
```
Expected: no errors

**Step 3: Commit**

```bash
git add vite.config.js
git commit -m "perf: drop console calls from production bundle"
```

---

## Task 2: ShareModal — focus trap + dialog ARIA

**Files:**
- Modify: `src/components/share/ShareModal.tsx`

**Context:** The modal renders as a Framer Motion `AnimatePresence` block. The inner `motion.div` is the dialog panel. Currently has no `role`, no `aria-modal`, no focus management.

**Step 1: Add `useRef` and `useEffect` imports to ShareModal**

`useState` is already imported. Add `useRef` and `useEffect` to the existing React import.

**Step 2: Add a `containerRef` and focus-trap effect**

Inside the `ShareModal` function, before `return`:

```tsx
const containerRef = useRef<HTMLDivElement>(null)

useEffect(() => {
  if (!isOpen) return
  const container = containerRef.current
  if (!container) return

  const trigger = document.activeElement as HTMLElement | null

  const focusable = () =>
    Array.from(
      container.querySelectorAll<HTMLElement>(
        'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
      )
    )

  focusable()[0]?.focus()

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
      return
    }
    if (e.key !== 'Tab') return
    const els = focusable()
    if (els.length === 0) return
    const first = els[0]
    const last = els[els.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  document.addEventListener('keydown', handleKeyDown)
  return () => {
    document.removeEventListener('keydown', handleKeyDown)
    trigger?.focus()
  }
}, [isOpen, onClose])
```

**Step 3: Attach `containerRef` and add ARIA to the dialog panel**

The inner `motion.div` (the white panel, currently `className="bg-white rounded-2xl..."`) becomes:

```tsx
<motion.div
  ref={containerRef}
  role="dialog"
  aria-modal="true"
  aria-label="Share"
  // ... existing motion props and className unchanged
>
```

**Step 4: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors

**Step 5: Commit**

```bash
git add src/components/share/ShareModal.tsx
git commit -m "fix(a11y): add focus trap and dialog ARIA to ShareModal"
```

---

## Task 3: PhotoLightbox — focus trap + dialog ARIA

**Files:**
- Modify: `src/components/photo-viewer/PhotoLightbox.tsx`

**Context:** PhotoLightbox is 513 lines. It renders a full-screen overlay via `AnimatePresence`. There is already a `useRef` import. Find the outermost container `motion.div` of the lightbox panel.

**Step 1: Add `useEffect` to the existing React import if not already present**

**Step 2: Add `lightboxRef` and the same focus-trap effect**

Add this after the existing state declarations near the top of the `PhotoLightbox` component:

```tsx
const lightboxRef = useRef<HTMLDivElement>(null)

useEffect(() => {
  if (!isOpen) return
  const container = lightboxRef.current
  if (!container) return

  const trigger = document.activeElement as HTMLElement | null

  const focusable = () =>
    Array.from(
      container.querySelectorAll<HTMLElement>(
        'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
      )
    )

  focusable()[0]?.focus()

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
      return
    }
    if (e.key !== 'Tab') return
    const els = focusable()
    if (els.length === 0) return
    const first = els[0]
    const last = els[els.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  document.addEventListener('keydown', handleKeyDown)
  return () => {
    document.removeEventListener('keydown', handleKeyDown)
    trigger?.focus()
  }
}, [isOpen, onClose])
```

**Step 3: Attach `lightboxRef` and ARIA to the lightbox root panel**

Find the outermost `motion.div` that wraps the lightbox content (not the backdrop). Add:

```tsx
<motion.div
  ref={lightboxRef}
  role="dialog"
  aria-modal="true"
  aria-label="Photo viewer"
  // ... existing props unchanged
>
```

**Step 4: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors

**Step 5: Commit**

```bash
git add src/components/photo-viewer/PhotoLightbox.tsx
git commit -m "fix(a11y): add focus trap and dialog ARIA to PhotoLightbox"
```

---

## Task 4: Extract `utils.ts` from Admin.tsx

**Files:**
- Create: `src/pages/admin/utils.ts`
- Modify: `src/pages/Admin.tsx` (remove extracted code, add import)

**Context:** Admin.tsx contains ~20 pure functions and 2 large constants that have no React dependencies. Extract them verbatim.

**Step 1: Create `src/pages/admin/utils.ts`**

Copy these items from Admin.tsx into the new file, adding `export` to each:

- Types/interfaces used only by these functions (check what each function references)
- Constants: `adminNavSections`, `adminRouteMeta`
- Functions: `getAdminRouteMeta`, `buildGuestTaggingCommands`, `normalizeTags`, `createPromotionDraft`, `getGuestVideoVisibilityLabel`, `buildGuestVideoPromotionPatch`, `getPublishedPhotoCount`, `buildGuestUploadMediaEntries`, `buildApprovedFingerprintSet`, `buildPendingFingerprintSet`, `getGuestUploadDuplicateInsight`, `getModerationState`, `formatMemoryTrailLabel`, `getAdminAuditActor`, `groupAuditEntries`, `appendAuditEntry`, `formatAuditTimestamp`, `getAuditActorLabel`

Add the necessary imports to `utils.ts` (they're already in Admin.tsx — copy only what these functions use from `@/lib/supabase`, `@/stores/authStore`, `@/data/memoryTrails`).

**Step 2: In Admin.tsx, replace each removed item with an import**

```ts
import {
  adminNavSections,
  adminRouteMeta,
  getAdminRouteMeta,
  buildGuestTaggingCommands,
  normalizeTags,
  createPromotionDraft,
  getGuestVideoVisibilityLabel,
  buildGuestVideoPromotionPatch,
  getPublishedPhotoCount,
  buildGuestUploadMediaEntries,
  buildApprovedFingerprintSet,
  buildPendingFingerprintSet,
  getGuestUploadDuplicateInsight,
  getModerationState,
  formatMemoryTrailLabel,
  getAdminAuditActor,
  groupAuditEntries,
  appendAuditEntry,
  formatAuditTimestamp,
  getAuditActorLabel,
} from './admin/utils'
```

**Step 3: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors. Fix any missing import in utils.ts if tsc complains.

**Step 4: Commit**

```bash
git add src/pages/admin/utils.ts src/pages/Admin.tsx
git commit -m "refactor(admin): extract pure utilities to admin/utils.ts"
```

---

## Task 5: Extract `Dashboard.tsx`

**Files:**
- Create: `src/pages/admin/Dashboard.tsx`
- Modify: `src/pages/Admin.tsx`

**Context:** The `Dashboard` function starts at line ~160. Its co-located sub-components (`StatCard`, `WorkflowStep`, `AdminSignalRow`) are only used by Dashboard — move them together into the same file.

**Step 1: Create `src/pages/admin/Dashboard.tsx`**

Cut `StatCard`, `WorkflowStep`, `AdminSignalRow`, and `Dashboard` from Admin.tsx. Paste into the new file. Add all necessary imports (React, Link, Button, icons, supabase hooks, utils imports from `./utils`). Export `Dashboard` as the named export:

```ts
export function Dashboard() { ... }
```

**Step 2: In Admin.tsx, import Dashboard**

```ts
import { Dashboard } from './admin/Dashboard'
```

Remove the cut code from Admin.tsx.

**Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/pages/admin/Dashboard.tsx src/pages/Admin.tsx
git commit -m "refactor(admin): extract Dashboard to admin/Dashboard.tsx"
```

---

## Task 6: Extract `PhotoModeration.tsx`

**Files:**
- Create: `src/pages/admin/PhotoModeration.tsx`
- Modify: `src/pages/Admin.tsx`

**Context:** `PhotoModeration` is the largest section (~1,450 lines). It starts after the Dashboard utils. It uses `AuditTrailList` and `CompactAuditHistory` — check if those are only used here. If so, move them into the same file.

**Step 1: Create `src/pages/admin/PhotoModeration.tsx`**

Cut `AuditTrailList`, `CompactAuditHistory`, and `PhotoModeration` from Admin.tsx. Paste into the new file. Add all necessary imports. Export `PhotoModeration`:

```ts
export function PhotoModeration() { ... }
```

**Step 2: In Admin.tsx, import PhotoModeration**

```ts
import { PhotoModeration } from './admin/PhotoModeration'
```

**Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/pages/admin/PhotoModeration.tsx src/pages/Admin.tsx
git commit -m "refactor(admin): extract PhotoModeration to admin/PhotoModeration.tsx"
```

---

## Task 7: Extract `GuestbookModeration.tsx`

**Files:**
- Create: `src/pages/admin/GuestbookModeration.tsx`
- Modify: `src/pages/Admin.tsx`

**Step 1: Create `src/pages/admin/GuestbookModeration.tsx`**

Cut `GuestbookModeration` from Admin.tsx. Export it:

```ts
export function GuestbookModeration() { ... }
```

**Step 2: In Admin.tsx, import GuestbookModeration**

```ts
import { GuestbookModeration } from './admin/GuestbookModeration'
```

**Step 3: TypeScript check + commit**

```bash
npx tsc --noEmit
git add src/pages/admin/GuestbookModeration.tsx src/pages/Admin.tsx
git commit -m "refactor(admin): extract GuestbookModeration to its own file"
```

---

## Task 8: Extract `AuditLogView.tsx`

**Files:**
- Create: `src/pages/admin/AuditLogView.tsx`
- Modify: `src/pages/Admin.tsx`

**Step 1: Create `src/pages/admin/AuditLogView.tsx`**

Cut `AuditLogView` from Admin.tsx. Export it:

```ts
export function AuditLogView() { ... }
```

**Step 2: In Admin.tsx, add import. TypeScript check + commit.**

```bash
npx tsc --noEmit
git add src/pages/admin/AuditLogView.tsx src/pages/Admin.tsx
git commit -m "refactor(admin): extract AuditLogView to its own file"
```

---

## Task 9: Extract `FeaturedContentManager.tsx`

**Files:**
- Create: `src/pages/admin/FeaturedContentManager.tsx`
- Modify: `src/pages/Admin.tsx`

**Context:** There are TWO `FeaturedContentManager` functions in Admin.tsx. The first (~line 2684) is the real one. The second (~line 3414) is a stub redirect `return <Navigate to="/admin/photos" replace />`. Delete the stub; extract only the real one.

**Step 1: Create `src/pages/admin/FeaturedContentManager.tsx`**

Cut the real `FeaturedContentManager` (the ~730-line one). Delete the stub version entirely. Export:

```ts
export function FeaturedContentManager() { ... }
```

**Step 2: In Admin.tsx, add import. TypeScript check + commit.**

```bash
npx tsc --noEmit
git add src/pages/admin/FeaturedContentManager.tsx src/pages/Admin.tsx
git commit -m "refactor(admin): extract FeaturedContentManager to its own file"
```

---

## Task 10: Extract `Analytics.tsx` and `Settings.tsx`

**Files:**
- Create: `src/pages/admin/Analytics.tsx`
- Create: `src/pages/admin/Settings.tsx`
- Modify: `src/pages/Admin.tsx`

**Step 1: Create both files**

Cut `Analytics` and `Settings` from Admin.tsx into separate files. Export each:

```ts
// Analytics.tsx
export function Analytics() { ... }

// Settings.tsx
export function Settings() { ... }
```

**Step 2: In Admin.tsx, add both imports. TypeScript check + commit.**

```bash
npx tsc --noEmit
git add src/pages/admin/Analytics.tsx src/pages/admin/Settings.tsx src/pages/Admin.tsx
git commit -m "refactor(admin): extract Analytics and Settings to their own files"
```

---

## Task 11: Create `AdminLayout.tsx` with lazy loading

**Files:**
- Create: `src/pages/admin/AdminLayout.tsx`
- Modify: `src/pages/Admin.tsx`

**Context:** `AdminLayout` (line ~3697) contains the nav shell, sidebar, and `<Routes>`. Move it to its own file and switch all section imports to `React.lazy`.

**Step 1: Create `src/pages/admin/AdminLayout.tsx`**

Cut the `AdminLayout` function from Admin.tsx. In the new file, replace the direct imports of Dashboard, PhotoModeration, etc. with lazy imports and wrap the Routes in Suspense:

```tsx
import { lazy, Suspense } from 'react'
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useToast } from '@/context/ToastContext'
import { Button } from '@/components/ui/Button'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { adminNavSections, adminRouteMeta, getAdminRouteMeta } from './utils'
import { MediaReviewPanel } from '@/components/admin/MediaReviewPanel'
import { AlbumOrganizer } from '@/components/admin/AlbumOrganizer'

const Dashboard             = lazy(() => import('./Dashboard').then(m => ({ default: m.Dashboard })))
const PhotoModeration       = lazy(() => import('./PhotoModeration').then(m => ({ default: m.PhotoModeration })))
const GuestbookModeration   = lazy(() => import('./GuestbookModeration').then(m => ({ default: m.GuestbookModeration })))
const AuditLogView          = lazy(() => import('./AuditLogView').then(m => ({ default: m.AuditLogView })))
const FeaturedContentManager = lazy(() => import('./FeaturedContentManager').then(m => ({ default: m.FeaturedContentManager })))
const Analytics             = lazy(() => import('./Analytics').then(m => ({ default: m.Analytics })))
const Settings              = lazy(() => import('./Settings').then(m => ({ default: m.Settings })))

function AdminPageSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-gold-100/60" />
      <div className="h-32 rounded-2xl bg-gold-50/80" />
      <div className="h-64 rounded-2xl bg-gold-50/80" />
    </div>
  )
}

export function AdminLayout() {
  // ... paste the existing AdminLayout body here
  // In the Routes sections, wrap with Suspense:
  // <Suspense fallback={<AdminPageSkeleton />}>
  //   <Routes>...</Routes>
  // </Suspense>
}
```

Wrap BOTH `<Routes>` blocks (the `isReviewRoute` branch and the main branch) in `<Suspense fallback={<AdminPageSkeleton />}>`.

**Step 2: In Admin.tsx, import AdminLayout**

```ts
import { AdminLayout } from './admin/AdminLayout'
```

Remove the AdminLayout cut from Admin.tsx.

**Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/pages/admin/AdminLayout.tsx src/pages/Admin.tsx
git commit -m "refactor(admin): extract AdminLayout with lazy-loaded sub-pages"
```

---

## Task 12: Shrink Admin.tsx to auth guard only

**Files:**
- Modify: `src/pages/Admin.tsx`

**Context:** After all extractions, Admin.tsx should only contain the `Admin` default export (the auth guard) and its imports. Everything else has been extracted.

**Step 1: Verify Admin.tsx now only contains**

```tsx
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { AdminLayout } from './admin/AdminLayout'

export default function Admin() {
  const { isAuthenticated, isLoading, isAdmin } = useAuthStore()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500" />
      </div>
    )
  }

  if (!isAuthenticated || !isAdmin) {
    const redirectTo = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to="/admin/login" replace state={{ from: redirectTo }} />
  }

  return <AdminLayout />
}
```

Remove all remaining unused imports from Admin.tsx.

**Step 2: Final TypeScript + lint check**

```bash
npx tsc --noEmit
npx eslint src/pages/Admin.tsx src/pages/admin/
```
Expected: no errors or warnings

**Step 3: Commit**

```bash
git add src/pages/Admin.tsx
git commit -m "refactor(admin): Admin.tsx is now auth guard only (~30 lines)"
```

---

## Task 13: Final verification

**Step 1: Full TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors

**Step 2: Full lint check**

```bash
npx eslint src/
```
Expected: no new errors

**Step 3: Run E2E suite**

```bash
npx playwright test --reporter=list
```
Expected: 43/43 passing

**Step 4: Verify bundle**

```bash
npx vite build 2>&1 | grep -E "admin|chunk|kB"
```
Expected: admin sub-pages appear as separate chunks, no single chunk >500kB

**Step 5: Push and open PR**

```bash
git push -u origin feature/admin-split
gh pr create --title "refactor: split Admin.tsx + fix ShareModal/PhotoLightbox a11y + drop prod console" \
  --body "Splits 3880-line Admin.tsx into 9 focused files with lazy loading. Adds focus traps to ShareModal and PhotoLightbox. Drops console calls from prod bundle."
```

---

## File size targets after completion

| File | Before | After |
|------|--------|-------|
| `src/pages/Admin.tsx` | 3,880 lines | ~30 lines |
| `src/pages/admin/utils.ts` | — | ~360 lines |
| `src/pages/admin/AdminLayout.tsx` | — | ~170 lines |
| `src/pages/admin/Dashboard.tsx` | — | ~200 lines |
| `src/pages/admin/PhotoModeration.tsx` | — | ~1,450 lines |
| `src/pages/admin/GuestbookModeration.tsx` | — | ~260 lines |
| `src/pages/admin/AuditLogView.tsx` | — | ~135 lines |
| `src/pages/admin/FeaturedContentManager.tsx` | — | ~735 lines |
| `src/pages/admin/Analytics.tsx` | — | ~195 lines |
| `src/pages/admin/Settings.tsx` | — | ~90 lines |
