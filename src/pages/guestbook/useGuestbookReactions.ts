import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Message } from './types'
import { getOrCreateReactionFingerprint, reactionMarkerKey } from './reactionFingerprint'
import storage from '@/utils/storage'

export interface UseGuestbookReactionsResult {
  fingerprint: string
  localReactions: Record<string, Record<string, number>>
  reactionPickerForId: string | null
  setReactionPickerForId: (id: string | null) => void
  handleAddReaction: (messageId: string, reactionKey: string) => Promise<void>
}

export function useGuestbookReactions(messages: Message[]): UseGuestbookReactionsResult {
  const [fingerprint] = useState<string>(getOrCreateReactionFingerprint)
  const [localReactions, setLocalReactions] = useState<Record<string, Record<string, number>>>({})
  const [reactionPickerForId, setReactionPickerForId] = useState<string | null>(null)

  const handleAddReaction = useCallback(
    async (messageId: string, reactionKey: string) => {
      setReactionPickerForId(null)

      // Get or create session fingerprint for this browser
      const fp = getOrCreateReactionFingerprint()
      const msg = messages.find(m => m.id === messageId)
      if (!msg) return

      // Get current reactions state (from localReactions or from message)
      const currentReactions = localReactions[messageId] ?? { ...msg.reactions }

      // For deduplication: track fingerprints in localStorage
      const reactedKey = reactionMarkerKey(messageId, reactionKey, fp)
      const previouslyReacted = storage.getItem(reactedKey) === fp

      // Determine optimistic update
      const previousReactions = { ...currentReactions }
      let optimisticReactions: Record<string, number>

      if (previouslyReacted) {
        // Toggle off: decrement the count
        optimisticReactions = {
          ...currentReactions,
          [reactionKey]: Math.max(0, (currentReactions[reactionKey] ?? 0) - 1),
        }
      } else {
        // Toggle on: increment the count
        optimisticReactions = {
          ...currentReactions,
          [reactionKey]: (currentReactions[reactionKey] ?? 0) + 1,
        }
      }

      // Apply optimistic update immediately
      setLocalReactions(prev => ({
        ...prev,
        [messageId]: optimisticReactions,
      }))

      // If toggling on, mark fingerprint as having reacted
      if (!previouslyReacted) {
        storage.setItem(reactedKey, fp)
      } else {
        // If toggling off, remove the fingerprint marker
        storage.removeItem(reactedKey)
      }

      // Now update the database
      try {
        const { error } = await supabase
          .from('guestbook_messages')
          .update({ reactions: optimisticReactions })
          .eq('id', messageId)

        if (error) throw error
      } catch {
        // Rollback on failure: restore previous state
        setLocalReactions(prev => ({
          ...prev,
          [messageId]: previousReactions,
        }))

        // Also rollback the fingerprint marker
        if (!previouslyReacted) {
          storage.removeItem(reactedKey)
        } else {
          storage.setItem(reactedKey, fp)
        }
      }
    },
    [messages, localReactions]
  )

  return {
    fingerprint,
    localReactions,
    reactionPickerForId,
    setReactionPickerForId,
    handleAddReaction,
  }
}
