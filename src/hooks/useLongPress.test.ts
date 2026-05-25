import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useLongPress } from './useLongPress'

describe('useLongPress hook', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('triggers onLongPress after delay', () => {
    const onLongPress = vi.fn()
    const onClick = vi.fn()
    const { result } = renderHook(() => useLongPress({ onLongPress, onClick }))

    const mockEvent = {
      button: 0,
      clientX: 10,
      clientY: 10,
    } as any

    result.current.onMouseDown(mockEvent)

    // Advance timer by 499ms (not enough)
    vi.advanceTimersByTime(499)
    expect(onLongPress).not.toHaveBeenCalled()

    // Advance by remaining 1ms
    vi.advanceTimersByTime(1)
    expect(onLongPress).toHaveBeenCalledWith(mockEvent)

    // Lift mouse, onClick should not be called since longpress already fired
    result.current.onMouseUp(mockEvent)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('triggers onClick on fast click', () => {
    const onLongPress = vi.fn()
    const onClick = vi.fn()
    const { result } = renderHook(() => useLongPress({ onLongPress, onClick }))

    const mockEvent = {
      button: 0,
      clientX: 10,
      clientY: 10,
    } as any

    result.current.onMouseDown(mockEvent)

    // Lift mouse before timer finishes
    vi.advanceTimersByTime(200)
    result.current.onMouseUp(mockEvent)

    expect(onLongPress).not.toHaveBeenCalled()
    expect(onClick).toHaveBeenCalledWith(mockEvent)
  })

  it('cancels long press if mouse/touch moves past threshold', () => {
    const onLongPress = vi.fn()
    const onClick = vi.fn()
    const { result } = renderHook(() => useLongPress({ onLongPress, onClick, threshold: 10 }))

    const mockStartEvent = {
      button: 0,
      clientX: 10,
      clientY: 10,
    } as any

    result.current.onMouseDown(mockStartEvent)

    // Move slightly (under threshold) — hook uses onTouchMove for move detection
    result.current.onTouchMove({ clientX: 15, clientY: 15 } as any)

    // Move significantly (above threshold)
    result.current.onTouchMove({ clientX: 30, clientY: 10 } as any)

    // Advance timers completely
    vi.advanceTimersByTime(600)
    expect(onLongPress).not.toHaveBeenCalled()
  })

  it('ignores non-left clicks (e.button !== 0)', () => {
    const onLongPress = vi.fn()
    const onClick = vi.fn()
    const { result } = renderHook(() => useLongPress({ onLongPress, onClick }))

    const mockEvent = {
      button: 2, // Right click
      clientX: 10,
      clientY: 10,
    } as any

    result.current.onMouseDown(mockEvent)
    vi.advanceTimersByTime(600)

    expect(onLongPress).not.toHaveBeenCalled()
  })
})
