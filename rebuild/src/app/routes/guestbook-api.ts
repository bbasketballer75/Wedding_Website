/**
 * App-layer wiring for the Guestbook feature (Wave 6).
 *
 * Keeps the feature's `GuestbookApi` seam and the typed `shared/data/guestbook`
 * module decoupled: the feature owns UI/behaviour, the data layer owns PostgREST
 * calls, and this file is the only place the two meet. When R17 is fixed at
 * cutover, only the data layer changes.
 */
import type { GuestbookApi } from '@/features/guestbook/types'
import {
  addGuestbookReply,
  fetchGuestbookMessages,
  submitGuestbookMessage,
  updateGuestbookReactions,
} from '@/shared/data/guestbook'

export const guestbookApi: GuestbookApi = {
  loadMessages: () => fetchGuestbookMessages(),
  submitMessage: input => submitGuestbookMessage(input),
  setReactions: (messageId, reactions) => updateGuestbookReactions(messageId, reactions),
  addReply: async input => {
    const row = await addGuestbookReply({
      messageId: input.messageId,
      author: input.author,
      content: input.content,
    })

    return {
      id: row.id,
      author: row.author,
      content: row.content,
      createdAt: row.created_at ?? '',
    }
  },
}
