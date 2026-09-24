import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { GuestbookMessage as SupabaseMessage } from '@/lib/supabase'
import type { Message } from './types'
import { mapSupabaseMessage } from './guestbookMapper'

export interface UseGuestbookMessagesResult {
  messages: Message[]
  isLoading: boolean
  loadError: string | null
  prependMessage: (message: Message) => void
}

export function useGuestbookMessages(): UseGuestbookMessagesResult {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        setIsLoading(true)
        setLoadError(null)

        const { data, error } = await supabase
          .from('guestbook_messages')
          .select(
            'id, name, content, created_at, reactions, comments:guestbook_comments(id, author, content, created_at)'
          )
          .order('created_at', { ascending: false })

        if (error) {
          setLoadError(
            'Having trouble loading notes right now — yours will still go through below.'
          )
          setMessages([])
          return
        }

        setMessages((data || []).map(row => mapSupabaseMessage(row as SupabaseMessage)))
      } catch {
        setLoadError(
          'Having trouble reaching the guestbook — your note will still go through below.'
        )
        setMessages([])
      } finally {
        setIsLoading(false)
      }
    }

    void fetchMessages()
  }, [])

  const prependMessage = useCallback((message: Message) => {
    setMessages(previous => [message, ...previous])
  }, [])

  return { messages, isLoading, loadError, prependMessage }
}
