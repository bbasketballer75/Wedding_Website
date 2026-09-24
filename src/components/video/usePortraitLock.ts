import { useEffect, useState } from 'react'

// Tracks whether the viewport is a phone in portrait orientation.
export function usePortraitLock(): boolean {
  const [isPhonePortrait, setIsPhonePortrait] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const updateViewportState = () => {
      setIsPhonePortrait(
        window.matchMedia('(max-width: 767px) and (orientation: portrait)').matches
      )
    }

    updateViewportState()
    window.addEventListener('resize', updateViewportState)
    window.addEventListener('orientationchange', updateViewportState)

    return () => {
      window.removeEventListener('resize', updateViewportState)
      window.removeEventListener('orientationchange', updateViewportState)
    }
  }, [])

  return isPhonePortrait
}
