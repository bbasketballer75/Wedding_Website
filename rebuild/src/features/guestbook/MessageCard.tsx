import { useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2, MessageSquare, Send, Smile } from 'lucide-react'
import { Avatar, Label, Textarea } from '@/shared/ui'
import { cn } from '@/shared/lib/cn'
import { REACTION_TYPES } from './constants'
import { formatGuestbookDate } from './guestbookText'
import type { GuestbookComment, GuestbookMessage } from './types'

export interface MessageCardProps {
  message: GuestbookMessage
  isHighlighted?: boolean
  localReactions?: Record<string, number>
  onAddReaction: (messageId: string) => void
  extraComments?: GuestbookComment[]
  onSubmitReply: (messageId: string, content: string) => Promise<void>
  staggerIndex?: number
  /** Per-browser reaction checks (masked through the hook so no storage leaks in). */
  hasOwnReaction?: (messageId: string, reactionKey: string) => boolean
  hasAnyOwnReaction?: (messageId: string) => boolean
  replyError?: string | null
}

/**
 * Frozen `MessageCard` (`src/pages/guestbook/MessageCard.tsx`) port.
 * Deltas: the entrance uses `initial/animate` instead of `whileInView` (no
 * IntersectionObserver in jsdom / reduced-motion parity captures), and the
 * per-(message,reaction) fingerprint check is injected by the page instead of
 * reading localStorage inside the card.
 */
export function MessageCard({
  message,
  isHighlighted = false,
  localReactions,
  onAddReaction,
  extraComments,
  onSubmitReply,
  staggerIndex = 0,
  hasOwnReaction,
  hasAnyOwnReaction,
  replyError,
}: MessageCardProps) {
  const reactions = localReactions ?? message.reactions
  const allComments = [...message.comments, ...(extraComments ?? [])]
  // Known reaction types first (frozen order), then unknown DB keys with their
  // stored label/emoji (e.g. the fixture's legacy "fire" reaction).
  const reactionEntries: ReadonlyArray<{ key: string; label: string; emoji: string }> = [
    ...REACTION_TYPES.filter(reaction => (reactions[reaction.key] ?? 0) > 0).map(reaction => ({
      key: reaction.key,
      label: reaction.label,
      emoji: reaction.emoji,
    })),
    ...Object.entries(reactions)
      .filter(([key]) => !REACTION_TYPES.some(reaction => reaction.key === key))
      .map(([key]) => ({ key, label: key, emoji: key })),
  ]
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [isSubmittingReply, setIsSubmittingReply] = useState(false)

  const handleSendReply = async () => {
    if (!replyText.trim()) return
    const text = replyText.trim()
    setReplyText('')
    setReplyOpen(false)
    setIsSubmittingReply(true)
    await onSubmitReply(message.id, text)
    setIsSubmittingReply(false)
  }

  return (
    <motion.article
      id={`guestbook-message-${message.id}`}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: Math.min(staggerIndex * 0.06, 0.4) }}
      data-testid='guestbook-message'
      className={cn(
        'relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-sm border border-gold-200/12 px-5 py-5 transition-all duration-300 sm:px-6 sm:py-6',
        isHighlighted && 'ring-2 ring-gold-400/40 shadow-[0_0_40px_-10px_rgba(198,156,78,0.25)]'
      )}
    >
      <div className='flex min-w-0 items-center gap-3'>
        <Avatar fallback={message.name} size='lg' className='ring-2 ring-gold-400/30' />
        <div className='min-w-0'>
          <h3 className='truncate text-lg font-semibold text-white'>{message.name}</h3>
          <p className='mt-1 text-sm text-white/60'>{formatGuestbookDate(message.createdAt)}</p>
        </div>
      </div>

      {message.content && (
        <div className='mt-5 rounded-xl bg-white/10 px-4 py-4'>
          <p className='text-base leading-7 text-white/85'>{message.content}</p>
        </div>
      )}

      {Object.keys(reactions).length > 0 && (
        <div className='mt-4 flex flex-wrap gap-2'>
          {reactionEntries.map(reaction => {
            const count = reactions[reaction.key] ?? 0
            const isOwn = hasOwnReaction?.(message.id, reaction.key) ?? false
            return (
              <button
                key={reaction.key}
                type='button'
                aria-label={`${reaction.label} reaction, ${count} votes`}
                className={cn(
                  'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors',
                  isOwn
                    ? 'border-gold-400/50 bg-gold-500/15 text-gold-300'
                    : 'border-white/15 bg-white/8 text-white/75 hover:bg-white/14'
                )}
              >
                <span aria-hidden='true'>{reaction.emoji}</span>
                <span>{count}</span>
              </button>
            )
          })}
        </div>
      )}

      <div className='mt-4 flex items-center gap-3 border-t border-white/10 pt-4'>
        {hasAnyOwnReaction?.(message.id) && (
          <span className='text-xs text-gold-400/70'>You reacted</span>
        )}
        <button
          type='button'
          onClick={() => onAddReaction(message.id)}
          aria-haspopup='dialog'
          aria-controls='reaction-picker'
          className='inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/14 hover:text-white/90'
        >
          <Smile className='h-3.5 w-3.5' aria-hidden='true' />
          Add a reaction
        </button>
        <button
          type='button'
          onClick={() => setReplyOpen(previous => !previous)}
          aria-expanded={replyOpen}
          className='inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/14 hover:text-white/90'
        >
          <MessageSquare className='h-3.5 w-3.5' aria-hidden='true' />
          {allComments.length > 0 ? `Reply (${allComments.length})` : 'Reply'}
        </button>
      </div>

      {allComments.length > 0 && (
        <div className='mt-4 space-y-3'>
          {allComments.map(comment => (
            <div key={comment.id} className='flex gap-3 rounded-xl bg-white/4 px-3 py-3'>
              <Avatar fallback={comment.author} size='sm' />
              <div>
                <p className='text-sm font-medium text-white/80'>{comment.author}</p>
                <p className='mt-1 text-sm text-white/60'>{comment.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {replyOpen && (
        <div className='mt-4 rounded-xl bg-white/4 px-4 py-4'>
          <Label htmlFor={`reply-${message.id}`} className='sr-only'>
            Add a reply
          </Label>
          <Textarea
            id={`reply-${message.id}`}
            aria-label='Add a reply'
            value={replyText}
            onChange={event => setReplyText(event.target.value)}
            placeholder='Add a reply...'
            rows={2}
            /* eslint-disable-next-line jsx-a11y/no-autofocus -- matches the oracle */
            autoFocus
            className='bg-white/8 border-white/12 text-white placeholder:text-white/30 focus:border-gold-400/50'
          />
          <div className='mt-3 flex justify-end'>
            <button
              type='button'
              onClick={() => void handleSendReply()}
              disabled={isSubmittingReply || !replyText.trim()}
              className='inline-flex items-center gap-1.5 rounded-full bg-gold-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50'
            >
              {isSubmittingReply ? (
                <Loader2 className='h-3.5 w-3.5 animate-spin' aria-hidden='true' />
              ) : (
                <Send className='h-3.5 w-3.5' aria-hidden='true' />
              )}
              Send
            </button>
          </div>
        </div>
      )}

      {replyError && (
        <p role='alert' className='mt-3 text-sm text-rose-300'>
          {replyError}
        </p>
      )}
    </motion.article>
  )
}
