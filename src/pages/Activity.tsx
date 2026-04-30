import { useEffect } from 'react'
import { ActivityFeed } from '@/components/activity/ActivityFeed'
import { fetchActivityFeed } from '@/lib/supabase'
import { activityFeedStore } from '@/stores/activityFeedStore'

export default function ActivityPage() {
  const setItems = activityFeedStore((state) => state.setItems)
  const setIsLoading = activityFeedStore((state) => state.setIsLoading)
  const items = activityFeedStore((state) => state.items)
  const isLoading = activityFeedStore((state) => state.isLoading)

  useEffect(() => {
    async function loadActivity() {
      if (items.length > 0) return // Already loaded

      setIsLoading(true)
      try {
        const data = await fetchActivityFeed(100)
        setItems(data)
      } catch (error) {
        console.error('Failed to load activity:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadActivity()
  }, [items.length, setItems, setIsLoading])

  return (
    <div className="min-h-screen bg-cream-50 pb-16">
      <div className="px-4 pt-8">
        <h1 className="font-display text-2xl text-charcoal-800 mb-6">Activity</h1>
        <ActivityFeed />
      </div>
    </div>
  )
}