/**
 * Muted looping preview behind the play overlay, ported verbatim from the
 * frozen `src/components/video/usePreviewVideo.ts`.
 */
import { useEffect, useState, type RefObject } from 'react'
import { attemptPlay } from './playback'

export interface UsePreviewVideoResult {
  previewReady: boolean
  setPreviewReady: (ready: boolean) => void
}

export function usePreviewVideo(
  previewVideoRef: RefObject<HTMLVideoElement | null>,
  previewStartTime: number,
  shouldShowPreviewVideo: boolean
): UsePreviewVideoResult {
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
          attemptPlay(previewVideo)
        }

        previewVideo.addEventListener('seeked', handleSeeked, { once: true })
        previewVideo.currentTime = safePreviewStart
        return true
      }

      markReady()
      attemptPlay(previewVideo)
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
      attemptPlay(previewVideo)
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
