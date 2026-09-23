import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Comment } from './types'

export interface UseGuestbookRepliesResult {
  extraComments: Record<string, Comment[]>
  handleSubmitReply: (messageId: string, replyContent: string) => Promise<void>
}

export function useGuestbookReplies(): UseGuestbookRepliesResult {
  const [extraComments, setExtraComments] = useState<Record<string, Comment[]>>({})

  const handleSubmitReply = useCallback(
    async (messageId: string, replyContent: string): Promise<void> => {
      const newComment: Comment = {
        id: `local-${Date.now()}`,
        author: 'You',
        content: replyContent,
        created_at: new Date().toISOString(),
      }
      setExtraComments(prev => ({ ...prev, [messageId]: [...(prev[messageId] ?? []), newComment] }))
      try {
        await supabase
          .from('guestbook_comments')
          .insert([{ message_id: messageId, author: 'Guest', content: replyContent }])
      } catch {
        // optimistic update already applied
      }
    },
    []
  )

  return { extraComments, handleSubmitReply }
}
