import { useCallback, useEffect } from 'react'
import {
  clearSavedVideoProgress,
  getVideoProgressStorageKey,
  writeSavedVideoProgress,
} from '@/utils/videoProgress'

export interface UseVideoProgressResult {
  handleTimeUpdate: () => void
  handleEnded: () => void
}

// Restores saved playback position, saves progress every 5s while playing and
// on each timeupdate, and clears saved progress when the video ends.
export function useVideoProgress(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  resolvedStorageKey: string,
  isPlaying: boolean,
  setCurrentTime: (time: number) => void,
  onTimeUpdate?: (time: number) => void,
  onEnded?: () => void
): UseVideoProgressResult {
  // Load saved progress
  useEffect(() => {
    const saved = localStorage.getItem(getVideoProgressStorageKey(resolvedStorageKey))
    if (saved && videoRef.current) {
      videoRef.current.currentTime = parseFloat(saved)
    }
  }, [videoRef, resolvedStorageKey])

  // Save progress periodically
  useEffect(() => {
    if (!isPlaying) return

    const interval = setInterval(() => {
      if (videoRef.current) {
        writeSavedVideoProgress(resolvedStorageKey, videoRef.current.currentTime)
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [videoRef, isPlaying, resolvedStorageKey])

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
      writeSavedVideoProgress(resolvedStorageKey, videoRef.current.currentTime)
      onTimeUpdate?.(videoRef.current.currentTime)
    }
  }, [videoRef, setCurrentTime, onTimeUpdate, resolvedStorageKey])

  const handleEnded = useCallback(() => {
    clearSavedVideoProgress(resolvedStorageKey)
    onEnded?.()
  }, [onEnded, resolvedStorageKey])

  return { handleTimeUpdate, handleEnded }
}
