import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { GuestUpload } from '@/lib/supabase'
import {
  fetchGuestUploadsByStatus,
  approveGuestUpload,
  rejectGuestUpload,
  bulkApproveGuestUploads,
  bulkRejectGuestUploads,
} from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

type UploadStatus = 'pending' | 'approved' | 'rejected'

interface ModerationState {
  // State
  uploads: GuestUpload[]
  selectedUploadIds: Set<string>
  loading: boolean
  savingIds: Set<string>
  activeFilter: UploadStatus

  // Actions
  loadUploads: (filter?: UploadStatus) => Promise<void>
  selectUpload: (id: string) => void
  deselectUpload: (id: string) => void
  selectAll: () => void
  deselectAll: () => void
  approveUpload: (id: string) => Promise<void>
  rejectUpload: (id: string, reason?: string) => Promise<void>
  bulkApprove: () => Promise<void>
  bulkReject: (reason?: string) => Promise<void>
  setActiveFilter: (filter: UploadStatus) => void
}

export const useModerationStore = create<ModerationState>()(
  devtools(
    (set, get) => ({
      // Initial state
      uploads: [],
      selectedUploadIds: new Set(),
      loading: false,
      savingIds: new Set(),
      activeFilter: 'pending',

      // Actions
      loadUploads: async (filter) => {
        const status = filter ?? get().activeFilter
        set({ loading: true })
        try {
          const uploads = await fetchGuestUploadsByStatus(status)
          set({ uploads, loading: false })
        } catch {
          set({ loading: false })
        }
      },

      setActiveFilter: (filter) => {
        set({ activeFilter: filter, selectedUploadIds: new Set() })
        void get().loadUploads(filter)
      },

      selectUpload: (id) => set((state) => ({
        selectedUploadIds: new Set([...state.selectedUploadIds, id])
      })),

      deselectUpload: (id) => set((state) => {
        const next = new Set(state.selectedUploadIds)
        next.delete(id)
        return { selectedUploadIds: next }
      }),

      selectAll: () => set((state) => ({
        selectedUploadIds: new Set(state.uploads.map(u => u.id))
      })),

      deselectAll: () => set({ selectedUploadIds: new Set() }),

      approveUpload: async (id) => {
        set((state) => ({ savingIds: new Set([...state.savingIds, id]) }))
        try {
          const actor = useAuthStore.getState().user
            ? { userId: useAuthStore.getState().user?.id, email: useAuthStore.getState().user?.email }
            : undefined
          await approveGuestUpload(id, actor)
          set((state) => ({
            uploads: state.uploads.map(u => u.id === id ? { ...u, status: 'approved' as const } : u),
            savingIds: (() => { const s = new Set(state.savingIds); s.delete(id); return s })(),
          }))
        } catch {
          set((state) => ({
            savingIds: (() => { const s = new Set(state.savingIds); s.delete(id); return s })(),
          }))
        }
      },

      rejectUpload: async (id, reason) => {
        set((state) => ({ savingIds: new Set([...state.savingIds, id]) }))
        try {
          const actor = useAuthStore.getState().user
            ? { userId: useAuthStore.getState().user?.id, email: useAuthStore.getState().user?.email }
            : undefined
          await rejectGuestUpload(id, reason, actor)
          set((state) => ({
            uploads: state.uploads.map(u => u.id === id ? { ...u, status: 'rejected' as const, rejection_reason: reason ?? null } : u),
            savingIds: (() => { const s = new Set(state.savingIds); s.delete(id); return s })(),
          }))
        } catch {
          set((state) => ({
            savingIds: (() => { const s = new Set(state.savingIds); s.delete(id); return s })(),
          }))
        }
      },

bulkApprove: async () => {
        const { selectedUploadIds } = get()
        const ids = [...selectedUploadIds]
        set((state) => ({ savingIds: new Set([...state.savingIds, ...ids]) }))
        try {
          const actor = useAuthStore.getState().user
            ? { userId: useAuthStore.getState().user?.id, email: useAuthStore.getState().user?.email }
            : undefined
          await bulkApproveGuestUploads(ids, actor)
          set((state) => ({
            uploads: state.uploads.map(u => ids.includes(u.id) ? { ...u, status: 'approved' as const } : u),
            selectedUploadIds: new Set(),
            savingIds: (() => { const s = new Set(state.savingIds); ids.forEach(id => s.delete(id)); return s })(),
          }))
        } catch {
          set((state) => ({
            savingIds: (() => { const s = new Set(state.savingIds); ids.forEach(id => s.delete(id)); return s })(),
          }))
        }
      },

      bulkReject: async (reason) => {
        const { selectedUploadIds, uploads } = get()
        const ids = [...selectedUploadIds]
        set((state) => ({ savingIds: new Set([...state.savingIds, ...ids]) }))
        try {
          const actor = useAuthStore.getState().user
            ? { userId: useAuthStore.getState().user?.id, email: useAuthStore.getState().user?.email }
            : undefined
          await bulkRejectGuestUploads(ids, reason, actor)
          set((state) => ({
            uploads: state.uploads.map(u => ids.includes(u.id) ? { ...u, status: 'rejected' as const, rejection_reason: reason ?? null } : u),
            selectedUploadIds: new Set(),
            savingIds: (() => { const s = new Set(state.savingIds); ids.forEach(id => s.delete(id)); return s })(),
          }))
        } catch {
          set((state) => ({
            savingIds: (() => { const s = new Set(state.savingIds); ids.forEach(id => s.delete(id)); return s })(),
          }))
        }
      },
    }),
    { name: 'moderation-store' }
  )
)