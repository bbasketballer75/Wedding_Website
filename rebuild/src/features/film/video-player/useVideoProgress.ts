/**
 * Playback progress persistence, ported from the frozen
 * `src/components/video/useVideoProgress.ts`: restore saved position, write
 * every 5 s while playing and on every timeupdate, clear on end.
 */
import { useCallback, useEffect, type RefObject } from 'react'
import {
  clearSavedVideoProgress,
  getVideoProgressStorageKey,
  writeSavedVideoProgress,
} from '../videoProgress'

export interface UseVideoProgressResult {
  handleTimeUpdate: () => void
  handleEnded: () => void
}

export function useVideoProgress(
  videoRef: RefObject<HTMLVideoElement | null>,
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
      videoRef.current.currentTime = Number.parseFloat(saved)
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
