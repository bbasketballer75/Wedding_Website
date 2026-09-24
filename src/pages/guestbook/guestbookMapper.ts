import type { GuestbookMessage as SupabaseMessage } from '@/lib/supabase'
import type { Comment, Message } from './types'
import { formatGuestbookDate } from './guestbookText'

export function mapSupabaseMessage(message: SupabaseMessage): Message {
  const raw = message as SupabaseMessage & {
    reactions?: Record<string, number>
    comments?: Comment[]
  }
  return {
    id: message.id,
    name: message.name,
    content: message.content,
    timestamp: formatGuestbookDate(message.created_at),
    reactions: raw.reactions ?? {},
    comments: raw.comments ?? [],
  }
}
