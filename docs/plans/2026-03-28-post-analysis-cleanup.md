# Post-Analysis Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Address the three P2 items and two P3 items identified in the 2026-03-28 project health analysis.

**Architecture:** Three independent, low-risk changes — (1) simplify the Guestbook fetch path to remove an unnecessary RPC call, (2) wire the existing `RouteErrorBoundary` into App.tsx routes, (3) delete the vestigial `memoriesStore`/`useMemories` files. Two P3 type cleanups follow.

**Tech Stack:** React 19, TypeScript 5.9, Supabase JS, Vitest, ESLint

---

## Task 1: Simplify Guestbook fetch — remove legacy RPC path

**Context:** The guestbook UI was simplified to text-only (no reactions/comments). The fetch still tries `get_guestbook_messages_with_comments` RPC first (a heavier join query returning reactions + comments), then falls back to a direct table query. The insert still sends `reactions: {}`. The `GuestbookMessage` type in `supabase.ts` still declares `reactions`. None of these serve the current UI.

**Files:**
- Modify: `src/pages/Guestbook.tsx` (fetch useEffect ~line 114, insert ~line 217)
- Modify: `src/lib/supabase.ts` (GuestbookMessage interface ~line 87)

---

### Step 1: Remove `reactions` from `GuestbookMessage` type

In `src/lib/supabase.ts`, find the `GuestbookMessage` interface (around line 87) and remove the `reactions` field:

**Before:**
```ts
export interface GuestbookMessage {
  id: string
  name: string
  email: string
  content: string
  type: 'text' | 'voice' | 'video'
  media_url?: string
  reactions: Record<string, number>
  created_at: string
}
```

**After:**
```ts
export interface GuestbookMessage {
  id: string
  name: string
  email: string
  content: string
  type: 'text' | 'voice' | 'video'
  media_url?: string
  created_at: string
}
```

### Step 2: Simplify the fetch `useEffect` in Guestbook.tsx

Replace the entire fetch `useEffect` (lines ~114–147) with a direct query:

**Before:**
```ts
useEffect(() => {
  const fetchMessages = async () => {
    try {
      setIsLoading(true)
      setLoadError(null)

      const { data: rpcData, error: rpcError } = await supabase.rpc('get_guestbook_messages_with_comments')
      if (!rpcError && Array.isArray(rpcData)) {
        setMessages(rpcData.map(mapSupabaseMessage))
        return
      }

      const { data, error } = await supabase
        .from('guestbook_messages')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        setLoadError('Having trouble loading notes right now — yours will still go through below.')
        setMessages([])
        return
      }

      setMessages((data || []).map((message) => mapSupabaseMessage({ ...message, comments: [] })))
    } catch {
      setLoadError('Having trouble reaching the guestbook — your note will still go through below.')
      setMessages([])
    } finally {
      setIsLoading(false)
    }
  }

  void fetchMessages()
}, [])
```

**After:**
```ts
useEffect(() => {
  const fetchMessages = async () => {
    try {
      setIsLoading(true)
      setLoadError(null)

      const { data, error } = await supabase
        .from('guestbook_messages')
        .select('id, name, content, type, created_at')
        .order('created_at', { ascending: false })

      if (error) {
        setLoadError('Having trouble loading notes right now — yours will still go through below.')
        setMessages([])
        return
      }

      setMessages((data || []).map((row) => mapSupabaseMessage(row as GuestbookMessage)))
    } catch {
      setLoadError('Having trouble reaching the guestbook — your note will still go through below.')
      setMessages([])
    } finally {
      setIsLoading(false)
    }
  }

  void fetchMessages()
}, [])
```

### Step 3: Remove `reactions: {}` from the insert (Guestbook.tsx ~line 217)

**Before:**
```ts
.insert([{ name, email, content: normalizedContent, type: 'text', media_url: null, reactions: {} }])
```

**After:**
```ts
.insert([{ name, email, content: normalizedContent, type: 'text', media_url: null }])
```

### Step 4: Verify TypeScript is clean

```bash
npx tsc --noEmit
```
Expected: no output (0 errors)

### Step 5: Verify lint is clean

```bash
npm run lint
```
Expected: no errors

### Step 6: Commit

```bash
git add src/pages/Guestbook.tsx src/lib/supabase.ts
git commit -m "refactor(guestbook): remove legacy RPC fetch and reactions insert"
```

---

## Task 2: Wire RouteErrorBoundary into App.tsx

**Context:** `src/components/error/ErrorBoundary.tsx` exports `RouteErrorBoundary` — a thin wrapper around the full `ErrorBoundary` class. It's not used anywhere. If a lazy-loaded page throws during render, React unmounts the whole app. Wrapping the routes catches this at the page level.

**Files:**
- Modify: `src/App.tsx`

---

### Step 1: Add `RouteErrorBoundary` import to App.tsx

In `src/App.tsx`, add the import after the existing imports:

```ts
import { RouteErrorBoundary } from '@/components/error/ErrorBoundary'
```

### Step 2: Wrap the `<AnimatePresence>` block in `AppContent`

Find the `<AnimatePresence mode="wait">` in `AppContent` (around line 108) and wrap it:

**Before:**
```tsx
<AnimatePresence mode="wait">
  <Routes location={location} key={location.pathname}>
    {/* ...routes... */}
  </Routes>
</AnimatePresence>
```

**After:**
```tsx
<RouteErrorBoundary>
  <AnimatePresence mode="wait">
    <Routes location={location} key={location.pathname}>
      {/* ...routes... */}
    </Routes>
  </AnimatePresence>
</RouteErrorBoundary>
```

### Step 3: Verify TypeScript is clean

```bash
npx tsc --noEmit
```
Expected: no output

### Step 4: Verify lint is clean

```bash
npm run lint
```
Expected: no errors

### Step 5: Commit

```bash
git add src/App.tsx
git commit -m "feat: wire RouteErrorBoundary around routes in App.tsx"
```

---

## Task 3: Delete vestigial memoriesStore and useMemories

**Context:** `src/stores/memoriesStore.ts` and `src/hooks/useMemories.js` are not imported by any page component. The store writes to the `shared_memories` / `all_memories` tables via a submission form — functionality that was superseded by the current Upload page's `guest_uploads` approval workflow. Deleting removes ~450 lines and a test file that tested now-dead code.

**Files:**
- Delete: `src/stores/memoriesStore.ts`
- Delete: `src/stores/memoriesStore.test.ts`
- Delete: `src/hooks/useMemories.js`
- Modify: `src/stores/index.ts`

---

### Step 1: Check nothing newly imports these before deleting

```bash
grep -r "memoriesStore\|useMemories" src/ --include="*.ts" --include="*.tsx" --include="*.js" -l
```
Expected output (only the files themselves + index):
```
src/stores/index.ts
src/stores/memoriesStore.ts
src/stores/memoriesStore.test.ts
src/hooks/useMemories.js
```
If any other file appears, stop and investigate before continuing.

### Step 2: Remove exports from `src/stores/index.ts`

**Before:**
```ts
// Central store exports
export { useAuthStore } from './authStore'
export { useGalleryStore } from './galleryStore'
export { useMemoriesStore } from './memoriesStore'
export { useUIStore } from './uiStore'

// Types for stores
export type { AuthState } from './authStore'
export type { GalleryState } from './galleryStore'
export type { MemoriesState } from './memoriesStore'
export type { UIState } from './uiStore'
```

**After:**
```ts
// Central store exports
export { useAuthStore } from './authStore'
export { useGalleryStore } from './galleryStore'
export { useUIStore } from './uiStore'

// Types for stores
export type { AuthState } from './authStore'
export type { GalleryState } from './galleryStore'
export type { UIState } from './uiStore'
```

### Step 3: Delete the three files

```bash
rm src/stores/memoriesStore.ts
rm src/stores/memoriesStore.test.ts
rm src/hooks/useMemories.js
```

### Step 4: Verify TypeScript is clean

```bash
npx tsc --noEmit
```
Expected: no output

### Step 5: Verify lint is clean

```bash
npm run lint
```
Expected: no errors

### Step 6: Run unit tests to confirm nothing broke

```bash
npm run test:run
```
Expected: all tests pass (the memoriesStore tests are now gone, remaining tests should pass)

### Step 7: Commit

```bash
git add src/stores/index.ts src/stores/memoriesStore.ts src/stores/memoriesStore.test.ts src/hooks/useMemories.js
git commit -m "chore: remove vestigial memoriesStore and useMemories hook"
```

---

## Task 4 (P3): Remove unused `GuestBookEntry` from `src/types/index.ts`

**Context:** `src/types/index.ts` defines a `GuestBookEntry` interface that is never explicitly imported from this file. A duplicate `GuestBookEntry` in `src/types/global.d.ts` is the globally-ambient version; `src/validators/guestBookSchema.ts` derives its own type via Zod. The one in `index.ts` is redundant noise.

**Files:**
- Modify: `src/types/index.ts`

---

### Step 1: Verify `types/index.ts` GuestBookEntry is not imported anywhere

```bash
grep -r "from '@/types'" src/ --include="*.ts" --include="*.tsx" -l | xargs grep -l "GuestBookEntry" 2>/dev/null
```
Expected: no output (nothing imports `GuestBookEntry` from `@/types`)

### Step 2: Delete the interface from `src/types/index.ts`

Remove lines 38–44:
```ts
export interface GuestBookEntry {
  id: string
  name: string
  message: string
  photo_url?: string
  created_at: string
}
```

### Step 3: Verify TypeScript is clean

```bash
npx tsc --noEmit
```
Expected: no output

### Step 4: Commit

```bash
git add src/types/index.ts
git commit -m "chore: remove duplicate GuestBookEntry from types/index.ts"
```

---

## Task 5 (P3): Remove lingering comment/count fields from `src/lib/supabase.ts`

**Context:** Lines 358–359 in `supabase.ts` define `comments_count` and `hidden_comments_count` on a photo engagement summary type — a leftover from when photo comments were surfaced in the gallery lightbox. Verify nothing reads them, then remove.

**Files:**
- Modify: `src/lib/supabase.ts`

---

### Step 1: Check if `comments_count` or `hidden_comments_count` are referenced

```bash
grep -r "comments_count\|hidden_comments_count" src/ --include="*.ts" --include="*.tsx"
```
Review the output. If the fields are only in `supabase.ts` and `components/admin/AlbumOrganizer.tsx`, proceed — the `AlbumOrganizer` uses them to display a count badge on photo cards in the admin UI. If so, **stop** — they're still in use and this task should be skipped.

**If the output shows they're ONLY in `src/lib/supabase.ts`:**

Remove the two fields from the relevant interface in `supabase.ts` (around lines 358–359).

```bash
npx tsc --noEmit && npm run lint
```
Expected: clean

```bash
git add src/lib/supabase.ts
git commit -m "chore: remove stale comment count fields from supabase types"
```

---

## Push

After all tasks:

```bash
git push origin main
```

---

## Verification

```bash
npx tsc --noEmit        # 0 errors
npm run lint            # 0 errors
npm run test:run        # all tests pass
git log --oneline origin/main..HEAD  # empty (all pushed)
```
