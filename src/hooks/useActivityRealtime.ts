import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { activityFeedStore } from '@/stores/activityFeedStore'
import type { ActivityLogItem } from '@/lib/supabase'

export function useActivityRealtime() {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const addNewItems = activityFeedStore(state => state.addNewItems)

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).__E2E__) {
      console.log('[E2E sandbox] Bypassing realtime activity feed subscription.')
      return
    }

    // Clean up any existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    // Create new realtime subscription
    channelRef.current = supabase
      .channel('activity_feed')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_log',
        },
        payload => {
          addNewItems([payload.new as ActivityLogItem])
        }
      )
      .subscribe()

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [addNewItems])
}
