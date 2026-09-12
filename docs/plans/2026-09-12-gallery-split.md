# Plan A: Gallery.tsx Split (2143 → ~300 lines)

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task. Each task ends with a green test/build before the next.

**Goal:** Split the 2143-line `src/pages/Gallery.tsx` into 4–5 focused subcomponents in `src/components/gallery/` so the page becomes a thin composition layer (~300 lines) and each concern lives in a single file.

**Architecture:** Pure refactor. Zero behavior change. All props/state passed down explicitly (no Context refactor — that's a separate concern). Components colocated in `src/components/gallery/` mirroring the pattern used by `PhotoLightbox`, `DownloadQueuePanel`, etc.

**Tech Stack:** React 19 + TypeScript 5.9 + Tailwind (existing). Vitest for unit tests.

---

## Gate 1: Internal gap analysis

Already done in this session:

| Sub-section (estimated boundary)                                        | Approx lines                       | Already extracted? |
| ----------------------------------------------------------------------- | ---------------------------------- | ------------------ |
| Constants (`FACE_NAME_ALIASES`, `COLLECTION_COVERS`, storage keys)      | 45–867                             | ❌ Inline          |
| `Gallery` state + handlers                                              | 1009–1670                          | ❌ Inline          |
| `Gallery` JSX (header/toolbar/grid/lightbox/face-filter/sidebar)        | 1687–~2140                         | ❌ Inline          |
| `useGalleryData` / `useGalleryEngagement` / `useGalleryDownloads` hooks | (overlap with state)               | ❌ Inline          |
| `GallerySkeleton` and `GallerySEO`                                      | (already imported, separate files) | ✅ External        |

No existing hook files. All hooks must be created from scratch.

---

## Task breakdown (bite-sized, TDD each)

### Task 1: Create `src/components/gallery/constants.ts` — pure data module

**Objective:** Move static constants (`FACE_NAME_ALIASES`, `resolveAlias`, `COLLECTION_COVERS`, storage-key constants) out of Gallery.tsx into a pure, dependency-free module.

**Files:**

- Create: `src/components/gallery/constants.ts`

**Step 1:** Read Gallery.tsx lines 50–69 and 140–156 (FACE_NAME_ALIASES, resolveAlias) and 865–868 (storage-key constants) and 140–156 (COLLECTION_COVERS).

**Step 2:** Move `FACE_NAME_ALIASES`, `resolveAlias`, `getPhotoEngagementSessionId` (line ~895), `getPhotoCommentAuthor` (line ~896), `COLLECTION_COVERS`, `PHOTO_ENGAGEMENT_SESSION_KEY`, `PHOTO_COMMENT_AUTHOR_KEY` into `constants.ts`. Pure re-export, no behavior change.

**Step 3:** Verify build passes: `npm run build` — expected: exit 0, dist rebuilt.

**Step 4:** Commit: `git add src/pages/Gallery.tsx src/components/gallery/constants.ts && git commit -m "refactor(gallery): extract constants to src/components/gallery/constants.ts"`

### Task 2: Create `src/hooks/useGalleryData.ts` — data loading hook

**Objective:** Extract photo loading/filtering/state logic from Gallery.tsx (lines ~1017–1670 useEffects and filtering) into a reusable hook.

**Files:**

- Create: `src/hooks/useGalleryData.ts`

**Step 1:** Write a unit test in `src/hooks/useGalleryData.test.ts`:

```ts
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useGalleryData } from './useGalleryData'

describe('useGalleryData', () => {
  it('starts with curated photos', () => {
    const { result } = renderHook(() => useGalleryData('Proposal'))
    expect(result.current.photos.length).toBeGreaterThan(0)
    expect(result.current.isLoading).toBe(true)
  })
  it('switches collections', () => {
    const { result, rerender } = renderHook(({ c }) => useGalleryData(c), {
      initialProps: { c: 'Proposal' as const },
    })
    rerender({ c: 'Wedding Photos' as const })
    expect(result.current.collection).toBe('Wedding Photos')
  })
})
```

**Step 2:** Run `npm run test:run -- src/hooks/useGalleryData.test.ts` — expected: FAIL (hook doesn't exist).

**Step 3:** Extract Gallery.tsx lines ~1017–1670 (state, useEffects, data-loading callbacks) into `useGalleryData(collection: CollectionTab)` returning `{ photos, collection, isLoading, loadError, ... }`.

**Step 4:** Run test — expected: PASS.

**Step 5:** Verify build passes: `npm run build` — exit 0.

**Step 6:** Commit: `git add src/hooks/useGalleryData.ts src/hooks/useGalleryData.test.ts src/pages/Gallery.tsx && git commit -m "refactor(gallery): extract useGalleryData hook"`

### Task 3: Create `src/hooks/useGalleryEngagement.ts` — likes/comments hook

**Objective:** Extract like/comment/engagement logic from Gallery.tsx into a focused hook.

**Files:**

- Create: `src/hooks/useGalleryEngagement.ts`

**Step 1:** Write a unit test in `src/hooks/useGalleryEngagement.test.ts`:

```ts
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useGalleryEngagement } from './useGalleryEngagement'

vi.mock('@/context/ToastContext', () => ({ useToast: () => ({ addToast: vi.fn() }) }))

describe('useGalleryEngagement', () => {
  it('initializes with empty engagement map', () => {
    const { result } = renderHook(() => useGalleryEngagement())
    expect(result.current.engagement).toEqual({})
  })
})
```

**Step 2:** Run test — FAIL.

**Step 3:** Extract Gallery.tsx like/comment/engagement logic (functions like `handleLike`, `handleComment`, `fetchEngagementSummaries`) into the hook.

**Step 4:** Run test — PASS.

**Step 5:** Verify `npm run build` — exit 0.

**Step 6:** Commit: `git add src/hooks/useGalleryEngagement.ts src/hooks/useGalleryEngagement.test.ts src/pages/Gallery.tsx && git commit -m "refactor(gallery): extract useGalleryEngagement hook"`

### Task 4: Create `src/hooks/useGalleryDownloads.ts` — downloads hook

**Objective:** Extract download-queue logic from Gallery.tsx into a focused hook.

**Files:**

- Create: `src/hooks/useGalleryDownloads.ts`

**Step 1:** Write test in `src/hooks/useGalleryDownloads.test.ts`:

```ts
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useGalleryDownloads } from './useGalleryDownloads'

describe('useGalleryDownloads', () => {
  it('starts with empty queue and not downloading', () => {
    const { result } = renderHook(() => useGalleryDownloads())
    expect(result.current.queue).toEqual([])
    expect(result.current.isDownloading).toBe(false)
  })
})
```

**Step 2:** Run test — FAIL.

**Step 3:** Extract download logic (handleDownload, handleDownloadPack, queue wiring) from Gallery.tsx into the hook.

**Step 4:** Run test — PASS.

**Step 5:** Build — exit 0.

**Step 6:** Commit.

### Task 5: Create `src/components/gallery/GalleryHeader.tsx` — header/search subcomponent

**Objective:** Extract the page header (title, SEO, search input) into its own component.

**Files:**

- Create: `src/components/gallery/GalleryHeader.tsx`

**Step 1:** Write a smoke test in `src/components/gallery/GalleryHeader.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { GalleryHeader } from './GalleryHeader'

describe('GalleryHeader', () => {
  it('renders the title', () => {
    render(<GalleryHeader title='Wedding Photos' />)
    expect(screen.getByText(/Wedding Photos/i)).toBeInTheDocument()
  })
})
```

**Step 2:** Run test — FAIL.

**Step 3:** Extract header JSX from Gallery.tsx (lines ~1687–~1770) into GalleryHeader.tsx. Props: `title`, `onSearchChange`, `searchQuery`.

**Step 4:** Run test — PASS.

**Step 5:** Build — exit 0.

**Step 6:** Commit.

### Task 6: Create `src/components/gallery/GalleryToolbar.tsx` — collection tabs + view-mode selector + face filter

**Objective:** Extract the controls bar into its own component.

**Files:**

- Create: `src/components/gallery/GalleryToolbar.tsx`

**Step 1:** Smoke test in `GalleryToolbar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { GalleryToolbar } from './GalleryToolbar'

describe('GalleryToolbar', () => {
  it('renders collection tabs', () => {
    render(
      <GalleryToolbar
        selected='Proposal'
        onSelect={() => {}}
        viewMode='masonry'
        onViewModeChange={() => {}}
      />
    )
    expect(screen.getByText('Proposal')).toBeInTheDocument()
  })
})
```

**Step 2:** Run test — FAIL.

**Step 3:** Extract toolbar JSX (lines ~1770–~1900) into GalleryToolbar.tsx.

**Step 4:** Run test — PASS.

**Step 5:** Build — exit 0.

**Step 6:** Commit.

### Task 7: Create `src/components/gallery/GalleryGrid.tsx` — photo grid wrapper + face sidebar

**Objective:** Extract the grid rendering + face-filter sidebar into one component.

**Files:**

- Create: `src/components/gallery/GalleryGrid.tsx`

**Step 1:** Smoke test in `GalleryGrid.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { GalleryGrid } from './GalleryGrid'

vi.mock('@/components/gallery/VirtualizedPhotoGrid', () => ({
  VirtualizedPhotoGrid: () => <div data-testid='grid' />,
}))
vi.mock('@/components/face-recognition/FaceRecognition', () => ({
  FaceRecognition: () => <div data-testid='faces' />,
}))

describe('GalleryGrid', () => {
  it('renders grid + face widget', () => {
    render(<GalleryGrid photos={[]} onPhotoClick={() => {}} />)
    expect(screen.getByTestId('grid')).toBeInTheDocument()
    expect(screen.getByTestId('faces')).toBeInTheDocument()
  })
})
```

**Step 2:** Run test — FAIL.

**Step 3:** Extract grid + sidebar JSX (lines ~1900–~2125) into GalleryGrid.tsx. Props: `photos`, `onPhotoClick`, `faceFilter`, `onFaceFilter`.

**Step 4:** Run test — PASS.

**Step 5:** Build — exit 0.

**Step 6:** Commit.

### Task 8: Reduce Gallery.tsx to composition layer

**Objective:** Replace Gallery.tsx body with thin composition using the extracted subcomponents. Final file should be ~250–350 lines.

**Files:**

- Modify: `src/pages/Gallery.tsx`

**Step 1:** Read current Gallery.tsx (full). Identify the 5 subcomponents needed: `GalleryHeader`, `GalleryToolbar`, `GalleryGrid`, lightbox (`<PhotoLightbox>` lazy), engagement, downloads.

**Step 2:** Write Gallery.tsx skeleton (no test needed; integration covered by e2e):

```tsx
import { useEffect } from 'react'
import { GallerySEO } from '@/components/seo/SEOHead'
import { PhotoLightbox, type PhotoLightboxProps } from '@/components/photo-viewer/PhotoLightbox'
import { useGalleryData } from '@/hooks/useGalleryData'
import { useGalleryEngagement } from '@/hooks/useGalleryEngagement'
import { useGalleryDownloads } from '@/hooks/useGalleryDownloads'
import { GalleryHeader } from '@/components/gallery/GalleryHeader'
import { GalleryToolbar } from '@/components/gallery/GalleryToolbar'
import { GalleryGrid } from '@/components/gallery/GalleryGrid'

export default function Gallery() {
  const { collection, photos, isLoading, loadError, setCollection } = useGalleryData('Proposal')
  const { engagement, lightboxIndex, setLightboxIndex, submitComment, toggleLike } = useGalleryEngagement()
  const { isDownloading, downloadSelected, selectMode, setSelectMode } = useGalleryDownloads()

  // Wire subcomponents together with handlers

  return (
    <>
      <GallerySEO />
      <GalleryHeader title="Wedding Photos" onSearchChange={...} searchQuery={...} />
      <GalleryToolbar selected={collection} onSelect={setCollection} viewMode={...} onViewModeChange={...} />
      <GalleryGrid photos={filteredPhotos} onPhotoClick={...} />
      <PhotoLightbox ... />
    </>
  )
}
```

**Step 3:** Verify line count: `wc -l src/pages/Gallery.tsx` — expected: < 350.

**Step 4:** Run full test suite: `npm run test:run` — expected: all tests pass.

**Step 5:** Build: `npm run build` — expected: exit 0, dist size similar or smaller.

**Step 6:** Run e2e: `npx playwright test tests/e2e/gallery.spec.ts` — expected: pass.

**Step 7:** Commit: `git add src/pages/Gallery.tsx && git commit -m "refactor(gallery): reduce to thin composition layer (~300 lines)"`.

### Task 9: Open PR

**Objective:** Ship the refactor as a single PR.

**Step 1:** Push branch: `git push -u origin refactor/gallery-split-2026-09-12`.

**Step 2:** Open PR: `gh pr create --base main --head refactor/gallery-split-2026-09-12 --title "refactor(gallery): split Gallery.tsx into focused subcomponents" --body "Pure refactor. Gallery.tsx went from 2143 → ~300 lines. Zero behavior change; all tests pass; build succeeds. Splits state into 3 hooks (useGalleryData, useGalleryEngagement, useGalleryDownloads) and JSX into 3 components (GalleryHeader, GalleryToolbar, GalleryGrid)."`

---

## Verification matrix

| Gate                                                        | Expected                     | Verify       |
| ----------------------------------------------------------- | ---------------------------- | ------------ |
| `wc -l src/pages/Gallery.tsx`                               | < 350                        | before/after |
| `wc -l src/components/gallery/Gallery*.tsx`                 | each < 250                   | per-task     |
| `wc -l src/hooks/useGallery*.ts`                            | each < 200                   | per-task     |
| `npm run lint`                                              | exit 0, 0 errors             | every task   |
| `npm run test:run`                                          | all pass                     | every task   |
| `npm run build`                                             | exit 0, dist similar/smaller | every task   |
| `npx playwright test tests/e2e/gallery.spec.ts`             | pass                         | task 9       |
| `grep "src/pages/Gallery.tsx" src/components/gallery/*.tsx` | no cross-imports back        | post-task 8  |

---

## Risks

1. **Prop drilling** — passing 5+ props to subcomponents is fine but signals a need for Context later (separate refactor).
2. **Lazy `PhotoLightbox`** — must keep `lazy()` import to preserve the ~35 kB gzip bundle split.
3. **Animation/transition glue** — `AnimatePresence` and `motion.div` are heavily used; preserve exactly.
4. **Face filter UX** — `faceFilter` is currently `string | null`; preserve state shape.

---

## Done when

- [ ] Gallery.tsx < 350 lines
- [ ] 3 new hook files exist with passing tests
- [ ] 3 new component files exist with smoke tests
- [ ] All existing tests pass unchanged
- [ ] Build succeeds with no size regression
- [ ] Playwright gallery.spec.ts passes
- [ ] PR opened and CI green

**Estimated effort:** 2-3 hours focused, plus verification buffer.
