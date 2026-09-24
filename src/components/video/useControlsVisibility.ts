import { useCallback, useRef, useState } from 'react'

// Auto-hides the control overlay 3s after the last mouse activity while playing.
export function useControlsVisibility(isPlaying: boolean) {
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
