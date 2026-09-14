import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGalleryToolbar } from './useGalleryToolbar'

describe('useGalleryToolbar', () => {
  it('initializes with masonry view, no selectMode, Proposal collection', () => {
    const { result } = renderHook(() => useGalleryToolbar())
    expect(result.current.viewMode).toBe('masonry')
    expect(result.current.selectMode).toBe(false)
    expect(result.current.selectedCollection).toBe('Proposal')
  })

  it('honors initialCollection override', () => {
    const { result } = renderHook(() => useGalleryToolbar({ initialCollection: 'Wedding Photos' }))
    expect(result.current.selectedCollection).toBe('Wedding Photos')
  })

  it('setViewMode switches between masonry / grid / timeline', () => {
    const { result } = renderHook(() => useGalleryToolbar())
    act(() => result.current.setViewMode('grid'))
    expect(result.current.viewMode).toBe('grid')
    act(() => result.current.setViewMode('timeline'))
    expect(result.current.viewMode).toBe('timeline')
  })

  it('setSelectMode toggles select mode', () => {
    const { result } = renderHook(() => useGalleryToolbar())
    act(() => result.current.setSelectMode(true))
    expect(result.current.selectMode).toBe(true)
    act(() => result.current.setSelectMode(false))
    expect(result.current.selectMode).toBe(false)
  })

  it('setSelectedCollection switches tabs', () => {
    const { result } = renderHook(() => useGalleryToolbar())
    act(() => result.current.setSelectedCollection('Bach+ette'))
    expect(result.current.selectedCollection).toBe('Bach+ette')
  })

  it('handleCollectionChange updates the selected tab', () => {
    const { result } = renderHook(() => useGalleryToolbar())
    act(() => result.current.handleCollectionChange('Guest Photos'))
    expect(result.current.selectedCollection).toBe('Guest Photos')
  })

  it('exposes a collectionSwitchDirectionRef that starts at 0', () => {
    const { result } = renderHook(() => useGalleryToolbar())
    expect(result.current.collectionSwitchDirectionRef.current).toBe(0)
  })

  it('empty-state copy derives from the selected collection metadata', () => {
    const { result } = renderHook(() => useGalleryToolbar({ initialCollection: 'Wedding Photos' }))
    expect(result.current.emptyStateTitle).toMatch(/Wedding day coverage/)
    expect(result.current.emptyStateBody).toMatch(/photographer-led archive/)
  })
})
