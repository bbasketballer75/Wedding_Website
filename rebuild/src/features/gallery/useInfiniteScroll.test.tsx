import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useInfiniteScroll } from './useInfiniteScroll'

function makeItems(count: number) {
  return Array.from({ length: count }, (_, index) => ({ id: index + 1 }))
}

describe('useInfiniteScroll', () => {
  it('preloads one page, reveals the next page per loadMore, then stops', () => {
    const items = makeItems(30)
    const { result } = renderHook(() => useInfiniteScroll({ items, itemsPerPage: 12 }))

    expect(result.current.displayedItems).toHaveLength(12)
    expect(result.current.hasMore).toBe(true)
    expect(result.current.isLoading).toBe(false)

    act(() => result.current.loadMore())
    expect(result.current.displayedItems).toHaveLength(24)

    act(() => result.current.loadMore())
    expect(result.current.displayedItems).toHaveLength(30)
    expect(result.current.hasMore).toBe(false)

    act(() => result.current.loadMore())
    expect(result.current.displayedItems).toHaveLength(30)
  })

  it('supports the grid page size (18) and resets when the item set changes', () => {
    const { result, rerender } = renderHook(
      ({ items }: { items: Array<{ id: number }> }) =>
        useInfiniteScroll({ items, itemsPerPage: 18 }),
      { initialProps: { items: makeItems(40) } }
    )

    expect(result.current.displayedItems).toHaveLength(18)
    act(() => result.current.loadMore())
    expect(result.current.displayedItems).toHaveLength(36)

    rerender({ items: makeItems(5) })
    expect(result.current.displayedItems).toHaveLength(5)
    expect(result.current.hasMore).toBe(false)
  })

  it('reset() returns to the first page', () => {
    const items = makeItems(30)
    const { result } = renderHook(() => useInfiniteScroll({ items, itemsPerPage: 12 }))
    act(() => result.current.loadMore())
    expect(result.current.displayedItems).toHaveLength(24)
    act(() => result.current.reset())
    expect(result.current.displayedItems).toHaveLength(12)
  })
})
