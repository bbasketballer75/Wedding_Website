import { useCallback, useEffect, useState } from 'react'

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
  handleSeek: (e: React.ChangeEvent<HTMLInputElement>) => void
  skip: (seconds: number) => void
  toggleMute: () => void
  handleVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  toggleFullscreen: () => Promise<void>
}

// Core playback state machine: play/pause, time, duration, volume, fullscreen,
// captions track mode, keyboard shortcuts, and landscape-lock pause.
export function useVideoPlayback(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  containerRef: React.RefObject<HTMLDivElement | null>,
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
        videoRef.current.play()
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
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = parseFloat(e.target.value)
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
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const vol = parseFloat(e.target.value)
      if (videoRef.current) {
        videoRef.current.volume = vol
        setVolume(vol)
        setIsMuted(vol === 0)
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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault()
          togglePlay()
          break
        case 'ArrowLeft':
          e.preventDefault()
          skip(-10)
          break
        case 'ArrowRight':
          e.preventDefault()
          skip(10)
          break
        case 'ArrowUp':
          e.preventDefault()
          if (videoRef.current) {
            const newVol = Math.min(1, videoRef.current.volume + 0.1)
            videoRef.current.volume = newVol
            setVolume(newVol)
          }
          break
        case 'ArrowDown':
          e.preventDefault()
          if (videoRef.current) {
            const newVol = Math.max(0, videoRef.current.volume - 0.1)
            videoRef.current.volume = newVol
            setVolume(newVol)
          }
          break
        case 'f':
          e.preventDefault()
          toggleFullscreen()
          break
        case 'm':
          e.preventDefault()
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
