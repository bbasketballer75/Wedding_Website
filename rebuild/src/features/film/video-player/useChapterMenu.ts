/**
 * Chapter menu state, ported verbatim from the frozen
 * `src/components/video/useChapterMenu.ts`: open/close, outside-click and
 * Escape dismissal, active-chapter computation and seek-to-chapter.
 */
import { useCallback, useEffect, useState, type RefObject } from 'react'
import type { Chapter } from './types'
import { attemptPlay } from './playback'

export interface UseChapterMenuResult {
  showChapterMenu: boolean
  setShowChapterMenu: (show: boolean) => void
  activeChapter: number
  jumpToChapter: (chapter: Chapter, index: number) => void
}

export function useChapterMenu(
  videoRef: RefObject<HTMLVideoElement | null>,
  resolvedChapters: readonly Chapter[],
  currentTime: number,
  isPlaying: boolean,
  setIsPlaying: (playing: boolean) => void,
  shouldRequireLandscape: boolean
): UseChapterMenuResult {
  const [showChapterMenu, setShowChapterMenu] = useState(false)

  const activeChapter = resolvedChapters.findIndex((ch, i) => {
    const nextCh = resolvedChapters[i + 1]
    return currentTime >= ch.time && (!nextCh || currentTime < nextCh.time)
  })

  const jumpToChapter = useCallback(
    (chapter: Chapter, index: number) => {
      if (shouldRequireLandscape) {
        return
      }

      if (videoRef.current) {
        videoRef.current.currentTime = chapter.time
        setShowChapterMenu(false)
        if (index >= 0 && !isPlaying) {
          attemptPlay(videoRef.current)
          setIsPlaying(true)
        }
      }
    },
    [videoRef, isPlaying, setIsPlaying, shouldRequireLandscape]
  )

  useEffect(() => {
    if (!showChapterMenu) {
      return
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      const menu = document.getElementById('video-chapter-menu')
      const toggle = document.getElementById('video-chapter-toggle')

      if (!target) {
        return
      }

      if (menu?.contains(target) || toggle?.contains(target)) {
        return
      }

      setShowChapterMenu(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowChapterMenu(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [showChapterMenu])

  return { showChapterMenu, setShowChapterMenu, activeChapter, jumpToChapter }
}
