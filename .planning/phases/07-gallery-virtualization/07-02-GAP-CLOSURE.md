---
phase: 07-gallery-virtualization
plan: 02-gaps
type: gap-closure
wave: 1
depends_on: []
files_modified:
  - src/components/gallery/VirtualizedPhotoGrid.tsx
  - src/components/gallery/components/VirtualizedMasonryGrid.tsx
autonomous: false
requirements:
  - GAL-01
---

<objective>
Fix two gaps from VERIFICATION.md:
1. Wire onVisibleRangeChange in VirtualizedMasonryGrid (BLOCKER - prefetch never fires)
2. Remove unused useMemo import from VirtualizedPhotoGrid.tsx
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@src/components/gallery/VirtualizedPhotoGrid.tsx
@src/components/gallery/components/VirtualizedMasonryGrid.tsx
</context>

<gap_analysis>

## Gap 1: onVisibleRangeChange never wired (BLOCKER)

**Symptom:** Gallery page scrolls but adjacent photos never prefetch (prefetching completely non-functional)

**Root cause chain:**
1. VirtualizedPhotoGrid defines `handleVisibleRangeChange` (lines 117-124) and passes it as `onVisibleRangeChange` prop to VirtualizedMasonryGrid (line 209)
2. VirtualizedMasonryGrid declares `onVisibleRangeChange?: (startIndex: number, endIndex: number) => void` in props (line 29)
3. BUT useVirtualizer at line 102-108 has NO scroll callback that invokes onVisibleRangeChange
4. Result: onVisibleRangeChange prop exists but is never called, so prefetchAdjacentPhotos never fires

**Fix location:** VirtualizedMasonryGrid.tsx — add scroll callback to useVirtualizer that computes global photo indices and calls onVisibleRangeChange

**Specific changes needed:**
- useVirtualizer needs `onRangeChange` callback or manual scroll handler
- When visible virtual items change, compute globalIndex range from rows[virtualRow.index].startIndex and rows[virtualRow.index].endIndex
- Call onVisibleRangeChange(startGlobalIndex, endGlobalIndex)

## Gap 2: Unused useMemo import lint error

**Symptom:** ESLint error for unused import on line 1 of VirtualizedPhotoGrid.tsx

**Root cause:** `useMemo` imported but never referenced in the file (handleVisibleRangeChange uses useCallback, not useMemo)

**Fix:** Remove `useMemo` from the import statement at line 1

</gap_analysis>

<tasks>

<task type="auto">
  <name>Task 1: Wire onVisibleRangeChange in VirtualizedMasonryGrid</name>
  <files>src/components/gallery/components/VirtualizedMasonryGrid.tsx</files>
  <action>
    Add scroll callback to useVirtualizer that invokes onVisibleRangeChange with global photo indices.

    In VirtualizedMasonryGrid.tsx, modify the useVirtualizer call (around line 102-108):

    Current:
    ```typescript
    const virtualizer = useVirtualizer({
      count: estimatedTotalRows,
      getScrollElement: () => scrollRef.current,
      estimateSize: () => estimateSize,
      hasFixedSize: false,
      overscan: 5,
    })
    ```

    Change to:
    ```typescript
    const virtualizer = useVirtualizer({
      count: estimatedTotalRows,
      getScrollElement: () => scrollRef.current,
      estimateSize: () => estimateSize,
      hasFixedSize: false,
      overscan: 5,
    })
    ```

    Then add a useEffect AFTER the virtualizer creation that uses a scroll event listener approach:

    Add a scrollRef callback to track scroll position changes and call onVisibleRangeChange:

    ```typescript
    // Track previous scroll offset to detect scroll events
    const lastScrollTopRef = useRef(0)

    useEffect(() => {
      const scrollElement = scrollRef.current
      if (!scrollElement || !onVisibleRangeChange) return

      const handleScroll = () => {
        const virtualItems = virtualizer.getVirtualItems()
        if (virtualItems.length === 0) return

        const firstVisibleRow = virtualItems[0]
        const lastVisibleRow = virtualItems[virtualItems.length - 1]

        if (!firstVisibleRow || !lastVisibleRow) return

        const rowStart = rows[firstVisibleRow.index]
        const rowEnd = rows[lastVisibleRow.index]

        if (!rowStart || !rowEnd) return

        const startGlobalIndex = rowStart.startIndex
        const endGlobalIndex = rowEnd.endIndex

        onVisibleRangeChange(startGlobalIndex, endGlobalIndex)
        lastScrollTopRef.current = scrollElement.scrollTop
      }

      // Initial call
      handleScroll()

      scrollElement.addEventListener('scroll', handleScroll, { passive: true })
      return () => scrollElement.removeEventListener('scroll', handleScroll)
    }, [virtualizer, rows, onVisibleRangeChange])
    ```

    Note: We track scroll position to avoid calling on every frame. The dependency on `virtualizer` ensures we re-read getVirtualItems() when rows change. The scroll listener is the actual trigger for prefetch calls.
  </action>
  <verify>
    <automated>
      # Verify onVisibleRangeChange is called in VirtualizedMasonryGrid
      grep -q "onVisibleRangeChange" src/components/gallery/components/VirtualizedMasonryGrid.tsx && \
      grep -q "useEffect.*onVisibleRangeChange" src/components/gallery/components/VirtualizedMasonryGrid.tsx && \
      echo "GAP1_WIRED_OK"
    </automated>
  </verify>
  <done>VirtualizedMasonryGrid calls onVisibleRangeChange(startGlobalIndex, endGlobalIndex) with correct global photo indices when visible rows change</done>
</task>

<task type="auto">
  <name>Task 2: Remove unused useMemo import</name>
  <files>src/components/gallery/VirtualizedPhotoGrid.tsx</files>
  <action>
    In VirtualizedPhotoGrid.tsx line 1, remove `useMemo` from the import statement.

    Current line 1:
    ```typescript
    import { useRef, useCallback, useMemo } from 'react'
    ```

    Change to:
    ```typescript
    import { useRef, useCallback } from 'react'
    ```
  </action>
  <verify>
    <automated>
      # Verify useMemo is not in imports and no lint error
      ! grep -q "useMemo" src/components/gallery/VirtualizedPhotoGrid.tsx && \
      echo "GAP2_FIXED_OK"
    </automated>
  </verify>
  <done>useMemo removed from VirtualizedPhotoGrid.tsx imports, ESLint passes</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Verify prefetch and lint</name>
  <what-built>Both gaps fixed: onVisibleRangeChange wired, useMemo removed</what-built>
  <how-to-verify>
    1. Run: npm run dev
    2. Navigate to http://localhost:5173/gallery
    3. Select "Wedding Photos" collection (most photos)
    4. Open DevTools Network tab
    5. Scroll through gallery slowly
    6. Verify:
       - prefetch links appear in Network tab for adjacent photos (±5)
       - Gallery scrolls smoothly
    7. Run: npm run lint -- --quiet
    8. Verify: No ESLint errors
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- onVisibleRangeChange called in VirtualizedMasonryGrid via useEffect
- useMemo removed from VirtualizedPhotoGrid imports
- npm run lint -- --quiet passes with no errors
- Prefetch fires when scrolling (visible range changes)
</verification>

<success_criteria>
1. VirtualizedMasonryGrid calls onVisibleRangeChange(startIndex, endIndex) with global photo indices on scroll
2. PrefetchAdjacentPhotos fires when visible range changes (±5 photos, 11 total)
3. ESLint passes (no unused import errors)
4. Gallery scrolls smoothly with 200+ photos
</success_criteria>

<output>
After completion, update `.planning/phases/07-gallery-virtualization/07-02-SUMMARY.md` to note gap-closure, then commit.
</output>
