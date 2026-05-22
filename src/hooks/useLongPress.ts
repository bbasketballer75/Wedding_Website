import { useRef, useCallback } from 'react'

export interface UseLongPressOptions {
  onLongPress: (e: React.MouseEvent | React.TouchEvent) => void
  onClick?: (e: React.MouseEvent | React.TouchEvent) => void
  delay?: number
  threshold?: number
}

export function useLongPress({
  onLongPress,
  onClick,
  delay = 500,
  threshold = 10,
}: UseLongPressOptions) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isLongPressActive = useRef(false)
  const startCoords = useRef<{ x: number; y: number } | null>(null)

  const start = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      // Exclude right clicks (button = 2) or other non-left clicks
      if ('button' in event && event.button !== 0) return

      isLongPressActive.current = false

      if ('touches' in event) {
        if (event.touches.length === 0) return
        const touch = event.touches[0]
        startCoords.current = { x: touch.clientX, y: touch.clientY }
      } else {
        startCoords.current = { x: event.clientX, y: event.clientY }
      }

      timeoutRef.current = setTimeout(() => {
        isLongPressActive.current = true
        onLongPress(event)
      }, delay)
    },
    [onLongPress, delay]
  )

  const clear = useCallback(
    (event: React.MouseEvent | React.TouchEvent, shouldTriggerClick = true) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }

      if (shouldTriggerClick && !isLongPressActive.current) {
        onClick?.(event)
      }

      isLongPressActive.current = false
      startCoords.current = null
    },
    [onClick]
  )

  const move = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      if (!startCoords.current) return

      let currentX = 0
      let currentY = 0

      if ('touches' in event) {
        if (event.touches.length === 0) return
        currentX = event.touches[0].clientX
        currentY = event.touches[0].clientY
      } else {
        currentX = event.clientX
        currentY = event.clientY
      }

      const diffX = Math.abs(currentX - startCoords.current.x)
      const diffY = Math.abs(currentY - startCoords.current.y)

      // Cancel if touch/mouse moved past threshold (e.g. scrolling or shifting)
      if (diffX > threshold || diffY > threshold) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
      }
    },
    [threshold]
  )

  return {
    onMouseDown: start,
    onMouseUp: (e: React.MouseEvent) => clear(e, true),
    onMouseLeave: (e: React.MouseEvent) => clear(e, false),
    onTouchStart: start,
    onTouchEnd: (e: React.TouchEvent) => clear(e, true),
    onTouchMove: move,
  }
}
