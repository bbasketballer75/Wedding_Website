# Phase 17: Download Management - Validation

**Created:** 2026-04-30
**Phase:** 17-download-management
**Status:** Test definitions for implementation

## Overview

This document defines the test infrastructure and automated verification commands for Phase 17 (Download Management). All tests use Vitest (the project's existing test framework).

## Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `vitest.config.ts` (existing) |
| Quick run command | `npm run test:run` |
| Full suite command | `npm run test:run -- --reporter=verbose` |
| UI mode | `npm run test:ui` |

## Test File Requirements

### Wave 0: Test Infrastructure (Must exist before implementation)

| Test File | Purpose | Command |
|-----------|---------|---------|
| `src/stores/downloadStore.test.ts` | Tests for new download store | `vitest run src/stores/downloadStore.test.ts` |
| `src/hooks/useLongPress.test.ts` | Tests for long-press hook | `vitest run src/hooks/useLongPress.test.ts` |
| `src/utils/download.test.ts` | Tests for batch download | `vitest run src/utils/download.test.ts` |

## Requirement -> Test Map

### DL-01: Multi-Select Download Queue

| Behavior | Test Type | Test File | Command |
|----------|-----------|-----------|---------|
| Long-press activates select mode | Unit | `src/hooks/useLongPress.test.ts` | `vitest run src/hooks/useLongPress.test.ts` |
| Checkbox toggles selection | Unit | `src/components/gallery/PhotoGrid.test.tsx` | `vitest run src/components/gallery/PhotoGrid.test.tsx` |
| Queue stores selected photos | Unit | `src/stores/downloadStore.test.ts` | `vitest run src/stores/downloadStore.test.ts` |
| GalleryHeader shows checkbox column | Unit | `src/components/gallery/components/GalleryHeader.test.tsx` | `vitest run src/components/gallery/components/GalleryHeader.test.tsx` |
| GalleryHeader shows selected count | Unit | `src/components/gallery/components/GalleryHeader.test.tsx` | `vitest run src/components/gallery/components/GalleryHeader.test.tsx` |

### DL-02: Batch Download with Progress

| Behavior | Test Type | Test File | Command |
|----------|-----------|-----------|---------|
| JSZip generates zip for small batches (<=20) | Unit | `src/utils/download.test.ts` | `vitest run src/utils/download.test.ts` |
| Progress indicator updates correctly | Unit | `src/utils/download.test.ts` | `vitest run src/utils/download.test.ts` |
| Edge Function called for large batches (>20) | Integration | `src/utils/download.test.ts` | `vitest run src/utils/download.test.ts` |
| Signed URLs refreshed before download (D-24) | Unit | `src/utils/download.test.ts` | `vitest run src/utils/download.test.ts` |

### DL-03: Download Queue Persistence

| Behavior | Test Type | Test File | Command |
|----------|-----------|-----------|---------|
| Queue persists across reload | Integration | `src/stores/downloadStore.test.ts` | `vitest run src/stores/downloadStore.test.ts` |
| Soft limit (50) shows warning | Unit | `src/stores/downloadStore.test.ts` | `vitest run src/stores/downloadStore.test.ts` |
| Hard limit (100) blocks adding | Unit | `src/stores/downloadStore.test.ts` | `vitest run src/stores/downloadStore.test.ts` |

## Behavior Test Specifications

### downloadStore.test.ts

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useDownloadStore } from '../downloadStore'

describe('downloadStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useDownloadStore.getState().clearQueue()
    useDownloadStore.setState({ isPanelOpen: false, isDownloading: false, downloadProgress: 0 })
  })

  describe('addToQueue', () => {
    it('should add photo to queue', () => {
      const photo = { id: '1', url: 'http://example.com/1.jpg', thumbnail: 'http://example.com/t1.jpg' }
      useDownloadStore.getState().addToQueue(photo)
      expect(useDownloadStore.getState().queuedPhotos).toHaveLength(1)
    })

    it('should warn at soft limit (50)', () => {
      // Add 50 photos and verify warning triggers on 51st
      const photos = Array.from({ length: 50 }, (_, i) => ({
        id: String(i), url: `http://example.com/${i}.jpg`, thumbnail: `http://example.com/t${i}.jpg`
      }))
      photos.forEach(p => useDownloadStore.getState().addToQueue(p))

      // Mock console.warn to capture warning
      const warnMock = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const photo51 = { id: '51', url: 'http://example.com/51.jpg', thumbnail: 'http://example.com/t51.jpg' }
      useDownloadStore.getState().addToQueue(photo51)

      expect(warnMock).toHaveBeenCalledWith(expect.stringContaining('50'))
      warnMock.mockRestore()
    })

    it('should block at hard limit (100)', () => {
      // Add 100 photos
      const photos = Array.from({ length: 100 }, (_, i) => ({
        id: String(i), url: `http://example.com/${i}.jpg`, thumbnail: `http://example.com/t${i}.jpg`
      }))
      photos.forEach(p => useDownloadStore.getState().addToQueue(p))
      expect(useDownloadStore.getState().queuedPhotos).toHaveLength(100)

      // 101st should not be added
      const photo101 = { id: '101', url: 'http://example.com/101.jpg', thumbnail: 'http://example.com/t101.jpg' }
      useDownloadStore.getState().addToQueue(photo101)
      expect(useDownloadStore.getState().queuedPhotos).toHaveLength(100)
    })
  })

  describe('sessionStorage persistence', () => {
    it('should persist queuedPhotos to sessionStorage', () => {
      const photo = { id: '1', url: 'http://example.com/1.jpg', thumbnail: 'http://example.com/t1.jpg' }
      useDownloadStore.getState().addToQueue(photo)

      const stored = sessionStorage.getItem('download-store')
      expect(stored).toBeTruthy()
      const parsed = JSON.parse(stored)
      expect(parsed.state.queuedPhotos).toHaveLength(1)
    })

    it('should not persist isDownloading or downloadProgress', () => {
      useDownloadStore.getState().setDownloading(true)
      useDownloadStore.getState().setProgress(50)

      const stored = sessionStorage.getItem('download-store')
      const parsed = JSON.parse(stored!)
      expect(parsed.state.isDownloading).toBeUndefined()
      expect(parsed.state.downloadProgress).toBeUndefined()
    })
  })
})
```

### useLongPress.test.ts

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, fireEvent, act } from '@testing-library/react'
import { useLongPress } from './useLongPress'

describe('useLongPress', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should not fire on short press', () => {
    const onLongPress = vi.fn()
    const { result } = renderHook(() => useLongPress(onLongPress))

    act(() => {
      fireEvent.mouseDown(result.current.onMouseDown as unknown as React.MouseEvent)
    })

    // Advance time but not past threshold
    vi.advanceTimersByTime(400)

    expect(onLongPress).not.toHaveBeenCalled()
  })

  it('should fire after 500ms threshold', () => {
    const onLongPress = vi.fn()
    const { result } = renderHook(() => useLongPress(onLongPress))

    act(() => {
      fireEvent.mouseDown(result.current.onMouseDown as unknown as React.MouseEvent)
    })

    // Advance past threshold
    vi.advanceTimersByTime(500)

    expect(onLongPress).toHaveBeenCalledTimes(1)
  })

  it('should clear timeout on mouseUp', () => {
    const onLongPress = vi.fn()
    const { result } = renderHook(() => useLongPress(onLongPress))

    act(() => {
      fireEvent.mouseDown(result.current.onMouseDown as unknown as React.MouseEvent)
    })

    vi.advanceTimersByTime(300)

    act(() => {
      result.current.onMouseUp()
    })

    vi.advanceTimersByTime(300) // Total 600ms but cleared at 300

    expect(onLongPress).not.toHaveBeenCalled()
  })

  it('should clear timeout on mouseLeave', () => {
    const onLongPress = vi.fn()
    const { result } = renderHook(() => useLongPress(onLongPress))

    act(() => {
      fireEvent.mouseDown(result.current.onMouseDown as unknown as React.MouseEvent)
    })

    vi.advanceTimersByTime(300)

    act(() => {
      result.current.onMouseLeave()
    })

    vi.advanceTimersByTime(300) // Total 600ms but cleared at 300

    expect(onLongPress).not.toHaveBeenCalled()
  })

  it('should work with touch events', () => {
    const onLongPress = vi.fn()
    const { result } = renderHook(() => useLongPress(onLongPress))

    act(() => {
      fireEvent.touchStart(result.current.onTouchStart as unknown as React.TouchEvent)
    })

    vi.advanceTimersByTime(500)

    expect(onLongPress).toHaveBeenCalledTimes(1)
  })

  it('should use custom threshold when provided', () => {
    const onLongPress = vi.fn()
    const { result } = renderHook(() => useLongPress(onLongPress, 300))

    act(() => {
      fireEvent.mouseDown(result.current.onMouseDown as unknown as React.MouseEvent)
    })

    vi.advanceTimersByTime(300)

    expect(onLongPress).toHaveBeenCalledTimes(1)
  })
})
```

### download.test.ts

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { downloadBatch, refreshSignedUrls } from './download'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('download utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['test'], { type: 'image/jpeg' }))
    } as Response)
  })

  describe('refreshSignedUrls', () => {
    it('should return photos unchanged (placeholder for server-side refresh)', async () => {
      const photos = [
        { id: '1', url: 'http://example.com/1.jpg' },
        { id: '2', url: 'http://example.com/2.jpg' }
      ]
      const result = await refreshSignedUrls(photos)
      expect(result).toEqual(photos)
    })
  })

  describe('downloadBatch', () => {
    it('should use JSZip for small batches (<=20)', async () => {
      const photos = Array.from({ length: 5 }, (_, i) => ({
        id: String(i),
        url: `http://example.com/${i}.jpg`,
        caption: `Photo ${i}`
      }))

      const onProgress = vi.fn()
      await downloadBatch(photos, onProgress)

      expect(onProgress).toHaveBeenCalledWith(0, 5, expect.stringContaining('Preparing'))
      expect(mockFetch).toHaveBeenCalledTimes(5)
    })

    it('should call Edge Function for large batches (>20)', async () => {
      // Mock Edge Function response
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ signed_urls: [] })
      } as Response)

      const photos = Array.from({ length: 25 }, (_, i) => ({
        id: String(i),
        url: `http://example.com/${i}.jpg`,
        caption: `Photo ${i}`
      }))

      const onProgress = vi.fn()
      await downloadBatch(photos, onProgress)

      expect(onProgress).toHaveBeenCalledWith(0, 25, expect.stringContaining('server'))
    })

    it('should report progress during download', async () => {
      const photos = [
        { id: '1', url: 'http://example.com/1.jpg' },
        { id: '2', url: 'http://example.com/2.jpg' }
      ]

      const onProgress = vi.fn()
      await downloadBatch(photos, onProgress)

      expect(onProgress).toHaveBeenCalledWith(1, 2, expect.stringContaining('1 of 2'))
      expect(onProgress).toHaveBeenCalledWith(2, 2, expect.stringContaining('Generating'))
    })
  })
})
```

### GalleryHeader.test.tsx

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GalleryHeader } from './GalleryHeader'

describe('GalleryHeader', () => {
  describe('select mode (D-03, D-04)', () => {
    it('should show selected count when selectMode is true', () => {
      render(
        <GalleryHeader
          // ... required props
          selectMode={true}
          selectedCount={5}
          // ...
        />
      )

      expect(screen.getByText('5 selected')).toBeTruthy()
    })

    it('should show checkbox in select mode', () => {
      render(
        <GalleryHeader
          // ... required props
          selectMode={true}
          selectedCount={5}
          // ...
        />
      )

      // Checkbox should be visible
      const checkbox = screen.getByRole('button', { name: /exit select mode/i })
      expect(checkbox).toBeTruthy()
    })

    it('should call onSelectAll when Select All clicked', () => {
      const onSelectAll = vi.fn()
      render(
        <GalleryHeader
          // ... required props
          selectMode={true}
          selectedCount={5}
          onSelectAll={onSelectAll}
          // ...
        />
      )

      fireEvent.click(screen.getByText('Select All'))
      expect(onSelectAll).toHaveBeenCalled()
    })

    it('should call onClearSelection when Clear clicked', () => {
      const onClearSelection = vi.fn()
      render(
        <GalleryHeader
          // ... required props
          selectMode={true}
          selectedCount={5}
          onClearSelection={onClearSelection}
          // ...
        />
      )

      fireEvent.click(screen.getByText('Clear'))
      expect(onClearSelection).toHaveBeenCalled()
    })
  })
})
```

## Phase-Level Verification Commands

### Before Implementation (Wave 0)
```bash
# These files should NOT exist yet
ls src/stores/downloadStore.test.ts  # Should fail
ls src/hooks/useLongPress.test.ts   # Should fail
ls src/utils/download.test.ts       # Should exist (extend existing)
```

### After Implementation
```bash
# Run all phase 17 tests
vitest run src/stores/downloadStore.test.ts
vitest run src/hooks/useLongPress.test.ts
vitest run src/utils/download.test.ts
vitest run src/components/gallery/components/GalleryHeader.test.tsx
```

### Full Verification
```bash
# Lint check
npm run lint

# Build check
npm run build

# All tests
npm run test:run
```

## Success Criteria

| Criterion | Verification |
|-----------|--------------|
| All test files created | `ls src/stores/downloadStore.test.ts src/hooks/useLongPress.test.ts` returns files |
| downloadStore tests pass | `vitest run src/stores/downloadStore.test.ts` passes |
| useLongPress tests pass | `vitest run src/hooks/useLongPress.test.ts` passes |
| download tests pass | `vitest run src/utils/download.test.ts` passes |
| GalleryHeader tests pass | `vitest run src/components/gallery/components/GalleryHeader.test.tsx` passes |

---

*Validation definitions complete — 2026-04-30*
*Phase: 17-download-management*