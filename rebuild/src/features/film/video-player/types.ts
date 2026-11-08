/**
 * Video player prop types, ported verbatim from the frozen
 * `src/components/video/types.ts`.
 */

export interface Chapter {
  label: string
  time: number
  thumbnail?: string
}

export type RemotePlaybackState = 'connecting' | 'connected' | 'disconnected'

export interface RemotePlaybackController {
  state: RemotePlaybackState
  prompt: () => Promise<void>
  addEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void
  removeEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void
}

export type CastableVideoElement = HTMLVideoElement & {
  remote?: RemotePlaybackController
  webkitShowPlaybackTargetPicker?: () => void
  webkitCurrentPlaybackTargetIsWireless?: boolean
  disableRemotePlayback?: boolean
}

export interface VideoPlayerProps {
  src: string
  title?: string
  chapters?: readonly Chapter[]
  poster?: string
  captionsSrc?: string
  previewStartTime?: number
  storageKey?: string
  onTimeUpdate?: (time: number) => void
  onEnded?: () => void
  className?: string
  requireLandscapeOnPhone?: boolean
}
