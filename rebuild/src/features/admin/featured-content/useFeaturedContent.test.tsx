import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  EDITORIAL_SOURCE_TYPE_OPTIONS,
  FEATURED_CONTENT_FIXTURES,
  FEATURED_SLOTS,
  FIXTURE_FEATURES,
} from './featured-content-data'
import { formStateFromFeature, useFeaturedContent } from './useFeaturedContent'

describe('featured-content data + hook edge paths', () => {
  it('exposes four slots and four source types with the frozen copy', () => {
    expect(FEATURED_SLOTS.map(slot => slot.label)).toEqual([
      'Moment of the Week',
      'Standout Upload',
      'Featured Note',
      'Film Feature',
    ])
    expect(EDITORIAL_SOURCE_TYPE_OPTIONS.map(option => option.value)).toEqual([
      'custom',
      'guest_upload',
      'guestbook_message',
      'film_chapter',
    ])
  })

  it('maps a missing feature to an empty form', () => {
    expect(formStateFromFeature(null)).toEqual({
      isActive: false,
      title: '',
      summary: '',
      badgeLabel: '',
      ctaLabel: '',
      sourceUrl: '',
      sourceType: 'custom',
    })
    expect(formStateFromFeature(FIXTURE_FEATURES['home_moment_of_the_week'])).toMatchObject({
      isActive: true,
      title: 'The First Dance',
    })
  })

  it('reports slot load and save failures without throwing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { result } = renderHook(() =>
      useFeaturedContent({
        data: {
          ...FEATURED_CONTENT_FIXTURES,
          fetchFeature: () => Promise.reject(new Error('offline')),
        },
      })
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Could not load this editorial slot.')
    expect(result.current.feature).toBeNull()
  })

  it('surfaces a save failure and ignores clear when no feature exists', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { result } = renderHook(() =>
      useFeaturedContent({
        data: {
          ...FEATURED_CONTENT_FIXTURES,
          fetchFeature: () => Promise.resolve(null),
          fetchHistory: () => Promise.resolve([]),
          saveFeature: () => Promise.reject(new Error('offline')),
        },
      })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setField('title', 'A title')
    })
    await act(async () => {
      await result.current.save()
    })
    expect(result.current.error).toBe('Could not save the slot. Check the console for details.')

    await act(async () => {
      await result.current.clearSlot()
    })
    expect(result.current.clearing).toBe(false)
  })

  it('keeps the title validation on the frozen error copy', async () => {
    const { result } = renderHook(() => useFeaturedContent({ data: FEATURED_CONTENT_FIXTURES }))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.setField('title', '   '))
    await act(async () => {
      await result.current.save()
    })
    expect(result.current.titleError).toBe('Title is required')
  })

  it('saves an inactive slot with the frozen inactive history summary', async () => {
    const appendHistory = vi.fn(() => Promise.resolve())
    const { result } = renderHook(() =>
      useFeaturedContent({
        data: { ...FEATURED_CONTENT_FIXTURES, appendHistory },
      })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.setField('isActive', false))
    await act(async () => {
      await result.current.save()
    })

    expect(result.current.statusMessage).toBe('Saved (slot is off)')
    expect(appendHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        changeSummary: 'Updated "The First Dance" (inactive)',
      })
    )
  })

  it('falls back to a synthetic id when the fixture has no row for a slot', async () => {
    const saved = await FEATURED_CONTENT_FIXTURES.saveFeature({
      slot: 'unknown-slot' as never,
      title: 'Placeholder',
      sourceType: 'custom',
    })
    expect(saved.id).toBe('feature-unknown-slot')
  })
})
