/**
 * Playback state machine, ported verbatim from the frozen
 * `src/components/video/useVideoPlayback.ts`: play/pause, time, duration,
 * volume, fullscreen, captions track mode, keyboard shortcuts, landscape-lock
 * pause.
 */
import { useCallback, useEffect, useState, type ChangeEvent, type RefObject } from 'react'
import { attemptPlay } from './playback'

export interface UseVideoPlaybackResult {
  isPlaying: boolean
  setIsPlaying: (playing: boolean) => void
  currentTime: number
  setCurrentTime: (time: number) => void
  duration: number
  volume: number
  setVolume: (vol: number) => void
  isMuted: boolean
  setIsMuted: (muted: boolean) => void
  isFullscreen: boolean
  isLoading: boolean
  hasStartedPlayback: boolean
  setHasStartedPlayback: (started: boolean) => void
  captionsEnabled: boolean
  setCaptionsEnabled: (enabled: boolean) => void
  togglePlay: () => void
  handleLoadedMetadata: () => void
  handleSeek: (event: ChangeEvent<HTMLInputElement>) => void
  skip: (seconds: number) => void
  toggleMute: () => void
  handleVolumeChange: (event: ChangeEvent<HTMLInputElement>) => void
  toggleFullscreen: () => Promise<void>
}

export function useVideoPlayback(
  videoRef: RefObject<HTMLVideoElement | null>,
  containerRef: RefObject<HTMLDivElement | null>,
  src: string,
  captionsSrc: string | undefined,
  shouldRequireLandscape: boolean
): UseVideoPlaybackResult {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [hasStartedPlayback, setHasStartedPlayback] = useState(false)
  const [captionsEnabled, setCaptionsEnabled] = useState(false)

  const togglePlay = useCallback(() => {
    if (shouldRequireLandscape) {
      return
    }

    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        setHasStartedPlayback(true)
        attemptPlay(videoRef.current)
      }
      setIsPlaying(!isPlaying)
    }
  }, [isPlaying, shouldRequireLandscape, videoRef])

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
      setIsLoading(false)
    }
  }, [videoRef])

  const handleSeek = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const time = Number.parseFloat(event.target.value)
      if (videoRef.current) {
        videoRef.current.currentTime = time
        setCurrentTime(time)
      }
    },
    [videoRef]
  )

  const skip = useCallback(
    (seconds: number) => {
      if (videoRef.current) {
        videoRef.current.currentTime += seconds
      }
    },
    [videoRef]
  )

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }, [isMuted, videoRef])

  const handleVolumeChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextVolume = Number.parseFloat(event.target.value)
      if (videoRef.current) {
        videoRef.current.volume = nextVolume
        setVolume(nextVolume)
        setIsMuted(nextVolume === 0)
      }
    },
    [videoRef]
  )

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return

    try {
      if (!isFullscreen) {
        await containerRef.current.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
      setIsFullscreen(!isFullscreen)
    } catch (error) {
      console.error('Fullscreen error:', error)
    }
  }, [isFullscreen, containerRef])

  // Pause when the landscape lock engages
  useEffect(() => {
    if (!shouldRequireLandscape || !videoRef.current) {
      return
    }

    if (!videoRef.current.paused) {
      videoRef.current.pause()
    }
  }, [shouldRequireLandscape, videoRef])

  // Sync captions track mode with the toggle
  useEffect(() => {
    const video = videoRef.current

    if (!video || video.textTracks.length === 0) {
      return
    }

    Array.from(video.textTracks).forEach((track, index) => {
      track.mode = index === 0 && captionsEnabled ? 'showing' : 'hidden'
    })
  }, [captionsEnabled, src, captionsSrc, videoRef])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return

      switch (event.key) {
        case ' ':
        case 'k':
          event.preventDefault()
          togglePlay()
          break
        case 'ArrowLeft':
          event.preventDefault()
          skip(-10)
          break
        case 'ArrowRight':
          event.preventDefault()
          skip(10)
          break
        case 'ArrowUp':
          event.preventDefault()
          if (videoRef.current) {
            const newVol = Math.min(1, videoRef.current.volume + 0.1)
            videoRef.current.volume = newVol
            setVolume(newVol)
          }
          break
        case 'ArrowDown':
          event.preventDefault()
          if (videoRef.current) {
            const newVol = Math.max(0, videoRef.current.volume - 0.1)
            videoRef.current.volume = newVol
            setVolume(newVol)
          }
          break
        case 'f':
          event.preventDefault()
          void toggleFullscreen()
          break
        case 'm':
          event.preventDefault()
          toggleMute()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePlay, skip, toggleFullscreen, toggleMute, videoRef])

  return {
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    duration,
    volume,
    setVolume,
    isMuted,
    setIsMuted,
    isFullscreen,
    isLoading,
    hasStartedPlayback,
    setHasStartedPlayback,
    captionsEnabled,
    setCaptionsEnabled,
    togglePlay,
    handleLoadedMetadata,
    handleSeek,
    skip,
    toggleMute,
    handleVolumeChange,
    toggleFullscreen,
  }
}
