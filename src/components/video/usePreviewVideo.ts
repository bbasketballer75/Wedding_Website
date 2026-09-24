import { useEffect, useState } from 'react'

// Drives the muted looping preview video behind the play overlay:
// seeks to previewStartTime, loops on end, and reports readiness.
export function usePreviewVideo(
  previewVideoRef: React.RefObject<HTMLVideoElement | null>,
  previewStartTime: number,
  shouldShowPreviewVideo: boolean
) {
  const [previewReady, setPreviewReady] = useState(false)

  useEffect(() => {
    const previewVideo = previewVideoRef.current

    if (!previewVideo) {
      return
    }

    if (!shouldShowPreviewVideo) {
      previewVideo.pause()
      previewVideo.currentTime = 0
      return
    }

    let isCancelled = false

    const markReady = () => {
      if (isCancelled) {
        return
      }

      window.requestAnimationFrame(() => {
        if (!isCancelled) {
          setPreviewReady(true)
        }
      })
    }

    const seekAndPlay = () => {
      if (!previewVideo.duration || !Number.isFinite(previewVideo.duration)) {
        return false
      }

      const safePreviewStart = Math.min(previewStartTime, Math.max(previewVideo.duration - 0.1, 0))

      if (Math.abs(previewVideo.currentTime - safePreviewStart) > 0.35) {
        const handleSeeked = () => {
          previewVideo.removeEventListener('seeked', handleSeeked)

          if (isCancelled) {
            return
          }

          markReady()
          const playAttempt = previewVideo.play()
          if (playAttempt && typeof playAttempt.catch === 'function') {
            playAttempt.catch(() => {})
          }
        }

        previewVideo.addEventListener('seeked', handleSeeked, { once: true })
        previewVideo.currentTime = safePreviewStart
        return true
      }

      markReady()
      const playAttempt = previewVideo.play()
      if (playAttempt && typeof playAttempt.catch === 'function') {
        playAttempt.catch(() => {})
      }
      return true
    }

    const handleCanPlay = () => {
      if (previewVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        seekAndPlay()
      }
    }

    const handleEnded = () => {
      const safePreviewStart = Math.min(previewStartTime, Math.max(previewVideo.duration - 0.1, 0))
      previewVideo.currentTime = safePreviewStart
      const playAttempt = previewVideo.play()
      if (playAttempt && typeof playAttempt.catch === 'function') {
        playAttempt.catch(() => {})
      }
    }

    previewVideo.preload = 'auto'
    previewVideo.load()

    if (previewVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      seekAndPlay()
    } else {
      previewVideo.addEventListener('canplay', handleCanPlay)
    }

    previewVideo.addEventListener('ended', handleEnded)

    return () => {
      isCancelled = true
      previewVideo.removeEventListener('canplay', handleCanPlay)
      previewVideo.removeEventListener('ended', handleEnded)
    }
  }, [previewVideoRef, previewStartTime, shouldShowPreviewVideo])

  return { previewReady, setPreviewReady }
}
