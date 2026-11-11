/**
 * Auto-hide controls, ported verbatim from the frozen
 * `src/components/video/useControlsVisibility.ts`.
 */
import { useCallback, useRef, useState } from 'react'

export interface UseControlsVisibilityResult {
  showControls: boolean
  setShowControls: (show: boolean) => void
  handleMouseMove: () => void
}

export function useControlsVisibility(isPlaying: boolean): UseControlsVisibilityResult {
  const [showControls, setShowControls] = useState(true)
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseMove = useCallback(() => {
    setShowControls(true)

    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }

    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false)
      }, 3000)
    }
  }, [isPlaying])

  return { showControls, setShowControls, handleMouseMove }
}
