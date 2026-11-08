import { useEffect, useRef, type RefObject } from 'react'

/**
 * Local port of the frozen `src/hooks/useTouchGestures.ts` (pinch + swipe
 * subset the lightbox uses). The frozen hook attached passive touch listeners
 * and reported a ratio between the current and initial two-finger distance via
 * `onPinch`; the lightbox clamps the resulting scale to 1–3×.
 */
export interface TouchGesturesOptions {
  onSwipeLeft?: (event: TouchEvent) => void
  onSwipeRight?: (event: TouchEvent) => void
  onPinch?: (scale: number, event: TouchEvent) => void
  threshold?: number
}

export function useTouchGestures(
  elementRef: RefObject<HTMLElement | null>,
  options: TouchGesturesOptions = {}
): void {
  const { onSwipeLeft, onSwipeRight, onPinch, threshold = 50 } = options
  const startTouch = useRef<{ x: number; y: number; time: number } | null>(null)
  const lastTouch = useRef<{ x: number; y: number; time: number } | null>(null)
  const pinchDistance = useRef(0)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (!touch) return
      startTouch.current = { x: touch.clientX, y: touch.clientY, time: Date.now() }
      lastTouch.current = { ...startTouch.current }

      if (event.touches.length === 2) {
        const first = event.touches[0]
        const second = event.touches[1]
        if (!first || !second) return
        const dx = first.clientX - second.clientX
        const dy = first.clientY - second.clientY
        pinchDistance.current = Math.sqrt(dx * dx + dy * dy)
      }
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (!startTouch.current) return
      const touch = event.touches[0]
      if (!touch) return
      lastTouch.current = { x: touch.clientX, y: touch.clientY, time: Date.now() }

      if (event.touches.length === 2) {
        const first = event.touches[0]
        const second = event.touches[1]
        if (!first || !second) return
        const dx = first.clientX - second.clientX
        const dy = first.clientY - second.clientY
        const distance = Math.sqrt(dx * dx + dy * dy)
        if (pinchDistance.current > 0) {
          onPinch?.(distance / pinchDistance.current, event)
        }
      }
    }

    const handleTouchEnd = (event: TouchEvent) => {
      if (!startTouch.current || !lastTouch.current) return

      const deltaX = lastTouch.current.x - startTouch.current.x
      const deltaY = lastTouch.current.y - startTouch.current.y
      const deltaTime = lastTouch.current.time - startTouch.current.time

      if (Math.abs(deltaX) > threshold && deltaTime < 300) {
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          if (deltaX > 0) onSwipeRight?.(event)
          else onSwipeLeft?.(event)
        }
      }

      startTouch.current = null
      lastTouch.current = null
      pinchDistance.current = 0
    }

    element.addEventListener('touchstart', handleTouchStart, { passive: true })
    element.addEventListener('touchmove', handleTouchMove, { passive: true })
    element.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchmove', handleTouchMove)
      element.removeEventListener('touchend', handleTouchEnd)
    }
    // The frozen hook intentionally listens once per element ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elementRef])
}
