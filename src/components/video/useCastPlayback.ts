import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CastableVideoElement } from './types'

export interface UseCastPlaybackResult {
  canCast: boolean
  isCasting: boolean
  handleCast: () => Promise<void>
}

// AirPlay / Remote Playback (Chromecast) support detection, state sync, and picker prompt.
export function useCastPlayback(
  videoRef: React.RefObject<HTMLVideoElement | null>
): UseCastPlaybackResult {
  const [isCasting, setIsCasting] = useState(false)

  const canCast = useMemo(() => {
    if (typeof window === 'undefined') {
      return false
    }

    const supportsAirPlay =
      'WebKitPlaybackTargetAvailabilityEvent' in window ||
      'webkitShowPlaybackTargetPicker' in HTMLMediaElement.prototype
    const supportsRemotePlayback =
      'remote' in HTMLMediaElement.prototype || 'RemotePlayback' in window

    return supportsAirPlay || supportsRemotePlayback
  }, [])

  useEffect(() => {
    const video = videoRef.current as CastableVideoElement | null

    if (!video) {
      return
    }

    video.disableRemotePlayback = false
    video.setAttribute('x-webkit-airplay', 'allow')
    video.setAttribute('airplay', 'allow')

    const syncCastState = () => {
      const remoteState = video.remote?.state
      const wirelessTarget = Boolean(video.webkitCurrentPlaybackTargetIsWireless)
      setIsCasting(wirelessTarget || remoteState === 'connecting' || remoteState === 'connected')
    }

    syncCastState()

    const remote = video.remote
    remote?.addEventListener?.('connecting', syncCastState)
    remote?.addEventListener?.('connect', syncCastState)
    remote?.addEventListener?.('disconnect', syncCastState)
    video.addEventListener(
      'webkitcurrentplaybacktargetiswirelesschanged',
      syncCastState as EventListener
    )

    return () => {
      remote?.removeEventListener?.('connecting', syncCastState)
      remote?.removeEventListener?.('connect', syncCastState)
      remote?.removeEventListener?.('disconnect', syncCastState)
      video.removeEventListener(
        'webkitcurrentplaybacktargetiswirelesschanged',
        syncCastState as EventListener
      )
    }
  }, [videoRef])

  const handleCast = useCallback(async () => {
    const video = videoRef.current as CastableVideoElement | null

    if (!video) {
      return
    }

    try {
      if (typeof video.webkitShowPlaybackTargetPicker === 'function') {
        video.webkitShowPlaybackTargetPicker()
        return
      }

      if (typeof video.remote?.prompt === 'function') {
        await video.remote.prompt()
      }
    } catch (error) {
      console.error('Remote playback error:', error)
    }
  }, [videoRef])

  return { canCast, isCasting, handleCast }
}
