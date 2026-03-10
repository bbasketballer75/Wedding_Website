import { useEffect, useRef, useState } from 'react'

// Touch gesture hook
export const useTouchGestures = (elementRef, options = {}) => {
  const [gestures, setGestures] = useState({
    swipe: null,
    pinch: null,
    longPress: false,
  })

  const startTouch = useRef(null)
  const lastTouch = useRef(null)
  const longPressTimer = useRef(null)
  const pinchDistance = useRef(0)

  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onPinch,
    onLongPress,
    threshold = 50,
    longPressDelay = 500,
  } = options

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    const handleTouchStart = e => {
      const touch = e.touches[0]
      startTouch.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      }
      lastTouch.current = { ...startTouch.current }

      // Start long press timer
      longPressTimer.current = setTimeout(() => {
        setGestures(prev => ({ ...prev, longPress: true }))
        onLongPress?.(e)
      }, longPressDelay)

      // Handle pinch if two fingers
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        pinchDistance.current = Math.sqrt(dx * dx + dy * dy)
      }
    }

    const handleTouchMove = e => {
      if (!startTouch.current) return

      const touch = e.touches[0]
      lastTouch.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      }

      // Clear long press if moved
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current)
        longPressTimer.current = null
      }

      // Handle pinch
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (pinchDistance.current > 0) {
          const scale = distance / pinchDistance.current
          setGestures(prev => ({ ...prev, pinch: scale }))
          onPinch?.(scale, e)
        }
      }
    }

    const handleTouchEnd = e => {
      if (!startTouch.current || !lastTouch.current) return

      // Clear long press timer
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current)
        longPressTimer.current = null
      }

      const deltaX = lastTouch.current.x - startTouch.current.x
      const deltaY = lastTouch.current.y - startTouch.current.y
      const deltaTime = lastTouch.current.time - startTouch.current.time

      // Check if it's a swipe (fast movement)
      if (Math.abs(deltaX) > threshold && deltaTime < 300) {
        const direction =
          Math.abs(deltaX) > Math.abs(deltaY)
            ? deltaX > 0
              ? 'right'
              : 'left'
            : deltaY > 0
              ? 'down'
              : 'up'

        setGestures(prev => ({ ...prev, swipe: direction }))

        // Call appropriate callback
        switch (direction) {
          case 'left':
            onSwipeLeft?.(e)
            break
          case 'right':
            onSwipeRight?.(e)
            break
          case 'up':
            onSwipeUp?.(e)
            break
          case 'down':
            onSwipeDown?.(e)
            break
        }
      }

      // Reset gestures after a short delay
      setTimeout(() => {
        setGestures({ swipe: null, pinch: null, longPress: false })
      }, 100)

      startTouch.current = null
      lastTouch.current = null
      pinchDistance.current = 0
    }

    // Add event listeners
    element.addEventListener('touchstart', handleTouchStart, { passive: true })
    element.addEventListener('touchmove', handleTouchMove, { passive: true })
    element.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchmove', handleTouchMove)
      element.removeEventListener('touchend', handleTouchEnd)
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elementRef])

  return gestures
}

// Haptic feedback hook
export const useHapticFeedback = () => {
  const vibrate = pattern => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern)
    }
  }

  return {
    // Light feedback for taps
    light: () => vibrate(10),

    // Medium feedback for button presses
    medium: () => vibrate(25),

    // Heavy feedback for important actions
    heavy: () => vibrate([50, 30, 50]),

    // Success feedback
    success: () => vibrate([10, 20, 10]),

    // Error feedback
    error: () => vibrate([100, 50, 100]),

    // Warning feedback
    warning: () => vibrate([50]),

    // Custom pattern
    custom: vibrate,
  }
}

// Safe area handling for notches
export const useSafeArea = () => {
  const [safeArea, setSafeArea] = useState({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  })

  useEffect(() => {
    const updateSafeArea = () => {
      const style = getComputedStyle(document.documentElement)
      setSafeArea({
        top: parseInt(style.getPropertyValue('--safe-area-inset-top')) || 0,
        right: parseInt(style.getPropertyValue('--safe-area-inset-right')) || 0,
        bottom: parseInt(style.getPropertyValue('--safe-area-inset-bottom')) || 0,
        left: parseInt(style.getPropertyValue('--safe-area-inset-left')) || 0,
      })
    }

    updateSafeArea()
    window.addEventListener('resize', updateSafeArea)
    window.addEventListener('orientationchange', updateSafeArea)

    return () => {
      window.removeEventListener('resize', updateSafeArea)
      window.removeEventListener('orientationchange', updateSafeArea)
    }
  }, [])

  return safeArea
}

export default {
  useTouchGestures,
  useHapticFeedback,
  useSafeArea,
}
