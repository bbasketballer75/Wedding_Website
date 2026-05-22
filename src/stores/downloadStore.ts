import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { useUIStore } from './uiStore'

export interface QueuedPhoto {
  id: string
  url: string
  thumbnail: string
  caption?: string
  downloadUrl?: string
  collection?: string
}

export interface DownloadState {
  queue: QueuedPhoto[]
  isPanelOpen: boolean
  isDownloading: boolean
  progress: number
  progressStatus: string

  // Actions
  addToQueue: (photo: QueuedPhoto) => boolean
  removeFromQueue: (photoId: string) => void
  clearQueue: () => void
  setPanelOpen: (isOpen: boolean) => void
  togglePanel: () => void
  setDownloading: (isDownloading: boolean) => void
  setProgress: (progress: number) => void
  setProgressStatus: (status: string) => void
}

const safeSessionStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window === 'undefined') return null
      return window.sessionStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(key, value)
      }
    } catch (e) {
      console.warn('sessionStorage setItem failed:', e)
    }
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(key)
      }
    } catch {}
  },
}

export const useDownloadStore = create<DownloadState>()(
  persist(
    (set, get) => ({
      queue: [],
      isPanelOpen: false,
      isDownloading: false,
      progress: 0,
      progressStatus: '',

      addToQueue: (photo: QueuedPhoto) => {
        const { queue } = get()
        
        // Prevent duplicate queue items
        if (queue.some(p => p.id === photo.id)) {
          return false
        }

        // Hard cap of 50 items
        if (queue.length >= 50) {
          useUIStore.getState().addToast({
            type: 'warning',
            title: 'Limit Exceeded',
            message: 'Maximum 50 photos can be downloaded as a batch.',
            duration: 4000,
          })
          return false
        }

        set({ queue: [...queue, photo] })
        return true
      },

      removeFromQueue: (photoId: string) => {
        set(state => ({
          queue: state.queue.filter(p => p.id !== photoId),
        }))
      },

      clearQueue: () => {
        set({ queue: [] })
      },

      setPanelOpen: (isOpen: boolean) => {
        set({ isPanelOpen: isOpen })
      },

      togglePanel: () => {
        set(state => ({ isPanelOpen: !state.isPanelOpen }))
      },

      setDownloading: (isDownloading: boolean) => {
        set({ isDownloading })
      },

      setProgress: (progress: number) => {
        set({ progress })
      },

      setProgressStatus: (progressStatus: string) => {
        set({ progressStatus })
      },
    }),
    {
      name: 'download-queue-store',
      storage: createJSONStorage(() => safeSessionStorage),
      partialize: state => ({
        queue: state.queue,
      }),
    }
  )
)
