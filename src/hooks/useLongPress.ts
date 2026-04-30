import { useRef, useCallback } from 'react'

export interface LongPressHandlers {
  onMouseDown: (e: React.MouseEvent) => void
  onMouseUp: () => void
  onMouseLeave: () => void
  onTouchStart: (e: React.TouchEvent) => void
  onTouchEnd: () => void
}

export function useLongPress(
  onLongPress: () => void,
  threshold: number = 500
): LongPressHandlers {
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const target = useRef<EventTarget | null>(null)

  const startTimer = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      target.current = e.currentTarget
      timeout.current = setTimeout(() => {
        onLongPress()
        // Clear the timeout after firing
        timeout.current = null
      }, threshold)
    },
    [onLongPress, threshold]
  )

  const clearTimer = useCallback(() => {
    if (timeout.current) {
      clearTimeout(timeout.current)
      timeout.current = null
    }
  }, [])

  return {
    onMouseDown: (e: React.MouseEvent) => {
      e.preventDefault()
      startTimer(e)
    },
    onMouseUp: () => {
      clearTimer()
    },
    onMouseLeave: () => {
      clearTimer()
    },
    onTouchStart: (e: React.TouchEvent) => {
      startTimer(e)
    },
    onTouchEnd: () => {
      clearTimer()
    },
  }
}