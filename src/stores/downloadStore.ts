import { create } from 'zustand'
import { devtools, subscribeWithSelector } from 'zustand/middleware'
import { persist, createJSONStorage } from 'zustand/middleware'

// Safe sessionStorage wrapper per D-01
const safeSessionStorage = {
  getItem: (name: string): string | null => {
    try {
      return sessionStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      sessionStorage.setItem(name, value)
    } catch {
      // Quota exceeded - skip caching, fallback to memory-only
    }
  },
  removeItem: (name: string): void => {
    try {
      sessionStorage.removeItem(name)
    } catch {}
  },
}

export interface QueuedPhoto {
  id: string
  url: string
  thumbnail: string
  caption?: string
}

export interface DownloadState {
  queuedPhotos: QueuedPhoto[]
  isPanelOpen: boolean
  isDownloading: boolean
  downloadProgress: number
  addToQueue: (photo: QueuedPhoto) => void
  removeFromQueue: (photoId: string) => void
  clearQueue: () => void
  togglePanel: () => void
  setDownloading: (downloading: boolean) => void
  setProgress: (progress: number) => void
}

const SOFT_LIMIT = 50
const HARD_LIMIT = 100

export const useDownloadStore = create<DownloadState>()(
  devtools(
    subscribeWithSelector(
      persist(
        (set, _get) => ({
          // Initial state - NOT persisted
          queuedPhotos: [],
          isPanelOpen: false,
          isDownloading: false,
          downloadProgress: 0,

          addToQueue: photo => {
            set(state => {
              const currentLength = state.queuedPhotos.length

              // Hard limit - block adding
              if (currentLength >= HARD_LIMIT) {
                console.warn(`Download queue hard limit reached (${HARD_LIMIT})`)
                return state
              }

              // Soft limit - warn
              if (currentLength >= SOFT_LIMIT) {
                console.warn(`Download queue approaching limit (${currentLength}/${SOFT_LIMIT})`)
              }

              // Don't add duplicates
              if (state.queuedPhotos.some(p => p.id === photo.id)) {
                return state
              }

              return {
                queuedPhotos: [...state.queuedPhotos, photo],
                isPanelOpen: true,
              }
            })
          },

          removeFromQueue: photoId =>
            set(state => ({
              queuedPhotos: state.queuedPhotos.filter(p => p.id !== photoId),
            })),

          clearQueue: () =>
            set({
              queuedPhotos: [],
              isPanelOpen: false,
            }),

          togglePanel: () =>
            set(state => ({
              isPanelOpen: !state.isPanelOpen,
            })),

          setDownloading: downloading =>
            set({
              isDownloading: downloading,
              downloadProgress: downloading ? 0 : 100,
            }),

          setProgress: progress =>
            set({
              downloadProgress: progress,
            }),
        }),
        {
          name: 'download-store',
          storage: createJSONStorage(() => safeSessionStorage),
          // Only persist queue state, NOT ephemeral download state
          partialize: state => ({
            queuedPhotos: state.queuedPhotos,
            isPanelOpen: state.isPanelOpen,
          }),
        }
      )
    ),
    { name: 'download-store' }
  )
)