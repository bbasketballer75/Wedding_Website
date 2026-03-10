import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useMemoriesStore } from '@/stores/memoriesStore'

export const useMemories = (filter) => {
  const {
    memories,
    isLoading: loading,
    isSubmitting: submitting,
    pagination,
    fetchMemories,
    submitMemory,
    setFormField,
    addMemory,
  } = useMemoriesStore()

  const hasMore = pagination.hasMore

  // Initial fetch and real-time subscription
  useEffect(() => {
    fetchMemories(0, true, filter)

    // Real-time subscription for new user memories
    const channel = supabase
      .channel('shared_memories_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'shared_memories' },
        payload => {
          // Optimistically add new user memory to top
          const newMemory = {
            id: payload.new.id,
            name: payload.new.name,
            message: payload.new.message || undefined,
            photo_url: payload.new.photo_url || undefined,
            type: payload.new.type,
            created_at: payload.new.created_at,
            source: 'user',
            tags: payload.new.tags || [],
          }
          addMemory(newMemory)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchMemories, addMemory, filter])

  const loadMore = () => {
    if (!loading && hasMore) {
      fetchMemories(pagination.page + 1, false, filter)
    }
  }

  const addMemoryAction = async ({ name, message, photo, tags }) => {
    setFormField('name', name)
    setFormField('message', message)
    if (photo) setFormField('photo', photo)
    if (tags) setFormField('tags', tags)

    return await submitMemory()
  }

  return {
    memories,
    loading,
    submitting,
    hasMore,
    loadMore,
    addMemory: addMemoryAction,
  }
}
