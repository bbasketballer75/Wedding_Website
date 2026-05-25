import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ActivityLogItem } from '@/lib/supabase'

export type ActivityFilterType = 'all' | 'photos' | 'guestbook' | 'moments'

interface ActivityFeedState {
  // Feed data
  items: ActivityLogItem[]
  setItems: (items: ActivityLogItem[]) => void
  prependItems: (newItems: ActivityLogItem[]) => void

  // Pagination
  hasMore: boolean
  setHasMore: (hasMore: boolean) => void

  // Loading states
  isLoading: boolean
  setIsLoading: (loading: boolean) => void

  // Filter state (persisted to sessionStorage per D-13)
  activeFilter: ActivityFilterType
  setActiveFilter: (filter: ActivityFilterType) => void

  // New activity banner
  newItemsCount: number
  newItems: ActivityLogItem[]
  addNewItems: (items: ActivityLogItem[]) => void
  clearNewItems: () => void
}

export const activityFeedStore = create<ActivityFeedState>()(
  persist(
    set => ({
      items: [],
      setItems: items => set({ items }),
      prependItems: newItems => set(state => ({ items: [...newItems, ...state.items] })),

      hasMore: true,
      setHasMore: hasMore => set({ hasMore }),

      isLoading: false,
      setIsLoading: isLoading => set({ isLoading }),

      activeFilter: 'all',
      setActiveFilter: activeFilter => set({ activeFilter }),

      newItemsCount: 0,
      newItems: [],
      addNewItems: items =>
        set(state => ({
          newItems: [...items, ...state.newItems],
          newItemsCount: state.newItemsCount + items.length,
        })),
      clearNewItems: () => set({ newItems: [], newItemsCount: 0 }),
    }),
    {
      name: 'activity-feed-filter',
      storage: {
        getItem: name => {
          const value = sessionStorage.getItem(name)
          return value ? JSON.parse(value) : null
        },
        setItem: (name, value) => {
          sessionStorage.setItem(name, JSON.stringify(value))
        },
        removeItem: name => {
          sessionStorage.removeItem(name)
        },
      },
      partialize: state => ({ activeFilter: state.activeFilter }) as unknown as ActivityFeedState,
    }
  )
)
