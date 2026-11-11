import { useCallback, useMemo } from 'react'
import { usePageMeta } from '@/app/seo/usePageMeta'
import { INITIAL_VISIBLE_MESSAGES, GUESTBOOK_COPY } from './constants'
import {
  createStubGuestbookApi,
  useGuestbookComposer,
  useGuestbookFeed,
  useGuestbookReactions,
  useGuestbookReplies,
} from './data'
import { GuestbookComposer } from './GuestbookComposer'
import { GuestbookEmptyState } from './GuestbookEmptyState'
import { GuestbookFeedHeader } from './GuestbookFeedHeader'
import { GuestbookHero } from './GuestbookHero'
import { GuestbookSidebar } from './GuestbookSidebar'
import { GuestbookSkeletons } from './GuestbookSkeletons'
import { MessageCard } from './MessageCard'
import { ReactionPicker } from './ReactionPicker'
import type { RateLimiter } from './rateLimit'
import { useGuestbookFeedView } from './useGuestbookFeedView'
import type { GuestbookApi, GuestbookStorage } from './types'

const GUESTBOOK_DESCRIPTION =
  'Leave a message for Austin and Jordyn. Share your favorite memories from our wedding day.'

function readSearchParams(search?: Record<string, unknown>): {
  messageId: string | null
  q: string
} {
  const source =
    search ??
    (typeof window === 'undefined'
      ? {}
      : Object.fromEntries(new URLSearchParams(window.location.search).entries()))
  const message = typeof source.message === 'string' ? source.message.trim() : ''
  const q = typeof source.q === 'string' ? source.q : ''
  return { messageId: message || null, q }
}

function defaultScrollToMessage(messageId: string): void {
  if (typeof document === 'undefined') return
  const element = document.getElementById(`guestbook-message-${messageId}`)
  element?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
}

export interface GuestbookPageProps {
  /** Route search params (TanStack Router passes `Route.useSearch()` here). */
  search?: Record<string, unknown>
  /** Data-layer seam (Lead swaps for `shared/data/guestbook.ts`). */
  api?: GuestbookApi
  /** Reaction fingerprint storage seam (tests inject an in-memory store). */
  storage?: GuestbookStorage
  /** Client limiter seam (tests inject a fixed-clock limiter). */
  limiter?: RateLimiter
  /** Clock seam for deterministic `createdAt` values in tests. */
  now?: () => number
  /** Scheduler seam for the frozen 2200 ms composer reset timing. */
  schedule?: (callback: () => void, delayMs: number) => unknown
  /** Deep-link scroll seam (defaults to `scrollIntoView` on the card). */
  scrollToMessage?: (messageId: string) => void
}

/**
 * `/guestbook` page — parity port of the frozen `src/pages/Guestbook.tsx`
 * composition layer (frozen file 125 lines; all behaviour lives in the hooks and
 * components of this feature folder).
 *
 * Wave-6 scope: hero count, composer (honeypot, client limiter, RPC + documented
 * fallback, optimistic prepend), feed with nested replies/reactions, search,
 * "Read more notes" pagination (8), `?message=` deep link, loading/empty/error
 * states and the accessibility contract. The lightbox-era frozen page had no
 * extra media; the frozen feed/grid layout and copy are preserved.
 */
export function GuestbookPage({
  search,
  api,
  storage,
  limiter,
  now,
  schedule,
  scrollToMessage,
}: GuestbookPageProps) {
  const { messageId, q } = useMemo(() => readSearchParams(search), [search])
  const client = useMemo(() => api ?? createStubGuestbookApi(), [api])

  const { messages, isLoading, loadError, prependMessage } = useGuestbookFeed({ api: client })
  const {
    searchQuery,
    setSearchQuery,
    visibleCount,
    setVisibleCount,
    filteredMessages,
    visibleMessages,
    hasMoreMessages,
    highlightedMessageId,
    resetVisibleCount,
  } = useGuestbookFeedView({
    messages,
    // A message deep link clears a conflicting search (deliverable #1).
    initialSearch: messageId ? '' : q,
    highlightedMessageId: messageId,
    scrollToMessage: scrollToMessage ?? defaultScrollToMessage,
  })

  const replies = useGuestbookReplies({ api: client, ...(now ? { now } : {}) })
  const reactions = useGuestbookReactions({
    messages,
    api: client,
    ...(storage ? { storage } : {}),
  })
  const composer = useGuestbookComposer({
    api: client,
    prependMessage,
    resetVisibleCount,
    ...(limiter ? { limiter } : {}),
    ...(now ? { now } : {}),
    ...(schedule ? { schedule } : {}),
  })
  const { openComposer } = composer

  usePageMeta({
    title: 'Guestbook',
    description: GUESTBOOK_DESCRIPTION,
    canonical: '/guestbook',
  })

  const handleAddReaction = useCallback(
    (messageIdToReact: string) => reactions.setReactionPickerForId(messageIdToReact),
    [reactions]
  )

  return (
    <div className='min-h-screen bg-[linear-gradient(to_bottom,rgba(12,8,5,1),rgba(22,14,6,1))] pb-20 pt-28 sm:pt-32'>
      <div className='pointer-events-none fixed inset-0 overflow-hidden' aria-hidden='true'>
        <div className='absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-gold-500/4 blur-[120px]' />
        <div className='absolute bottom-1/4 right-1/4 h-64 w-64 rounded-full bg-gold-400/3 blur-[100px]' />
      </div>

      {reactions.reactionPickerForId !== null && (
        <ReactionPicker
          messageId={reactions.reactionPickerForId}
          onSelect={(targetId, key) => void reactions.handleAddReaction(targetId, key)}
          onClose={() => reactions.setReactionPickerForId(null)}
        />
      )}

      <GuestbookHero messageCount={messages.length} onCompose={openComposer} />

      <section className='px-4'>
        <div className='mx-auto grid max-w-6xl gap-6 xl:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] xl:items-start'>
          <GuestbookSidebar
            showForm={composer.showForm}
            onToggle={() => composer.setShowForm(!composer.showForm)}
          />

          <div className='grid gap-5'>
            <GuestbookComposer composer={composer} />

            {loadError && (
              <div
                role='alert'
                className='rounded-xl border border-amber-400/25 bg-amber-500/8 px-4 py-3 text-sm text-amber-300'
              >
                {loadError}
              </div>
            )}

            <GuestbookFeedHeader
              filteredCount={filteredMessages.length}
              totalCount={messages.length}
              searchQuery={searchQuery}
              isLoading={isLoading}
              onSearchChange={setSearchQuery}
            />

            {isLoading ? (
              <GuestbookSkeletons />
            ) : visibleMessages.length > 0 ? (
              <>
                <div className='grid gap-5 xl:grid-cols-2'>
                  {visibleMessages.map((message, index) => (
                    <MessageCard
                      key={message.id}
                      message={message}
                      isHighlighted={highlightedMessageId === message.id}
                      localReactions={reactions.localReactions[message.id]}
                      onAddReaction={handleAddReaction}
                      extraComments={replies.extraComments[message.id]}
                      onSubmitReply={replies.handleSubmitReply}
                      staggerIndex={index}
                      hasOwnReaction={reactions.hasOwnReaction}
                      hasAnyOwnReaction={reactions.hasAnyOwnReaction}
                      replyError={
                        replies.replyErrorForMessageId === message.id ? replies.replyError : null
                      }
                    />
                  ))}
                </div>
                {hasMoreMessages && (
                  <div className='flex justify-center pt-2'>
                    <button
                      type='button'
                      onClick={() => setVisibleCount(visibleCount + INITIAL_VISIBLE_MESSAGES)}
                      className='cursor-pointer rounded-full border border-gold-400/25 bg-gold-500/8 px-6 py-2.5 text-sm font-medium text-gold-300 transition-colors hover:bg-gold-500/15'
                    >
                      {GUESTBOOK_COPY.readMore}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <GuestbookEmptyState onCompose={openComposer} />
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

export default GuestbookPage
