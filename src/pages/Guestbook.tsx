import { GuestbookSEO } from '@/components/seo/SEOHead'
import { useGuestbookMessages } from './guestbook/useGuestbookMessages'
import { useGuestbookReplies } from './guestbook/useGuestbookReplies'
import { useGuestbookReactions } from './guestbook/useGuestbookReactions'
import { useGuestbookComposer } from './guestbook/useGuestbookComposer'
import { useGuestbookFeed } from './guestbook/useGuestbookFeed'
import { INITIAL_VISIBLE_MESSAGES } from './guestbook/constants'
import { GuestbookHero } from './guestbook/GuestbookHero'
import { GuestbookSidebar } from './guestbook/GuestbookSidebar'
import { ReactionPicker } from './guestbook/ReactionPicker'
import { GuestbookComposer } from './guestbook/GuestbookComposer'
import { GuestbookFeedHeader } from './guestbook/GuestbookFeedHeader'
import { GuestbookSkeletons } from './guestbook/GuestbookSkeletons'
import { GuestbookEmptyState } from './guestbook/GuestbookEmptyState'
import { MessageCard } from './guestbook/MessageCard'

export default function Guestbook() {
  const { messages, isLoading, loadError, prependMessage } = useGuestbookMessages()
  const { extraComments, handleSubmitReply } = useGuestbookReplies()
  const {
    fingerprint,
    localReactions,
    reactionPickerForId,
    setReactionPickerForId,
    handleAddReaction,
  } = useGuestbookReactions(messages)
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
  } = useGuestbookFeed(messages)
  const composer = useGuestbookComposer(prependMessage, resetVisibleCount)
  const { openComposer } = composer

  return (
    <div className='min-h-screen bg-[linear-gradient(to_bottom,rgba(12,8,5,1),rgba(22,14,6,1))] pb-20 pt-28 sm:pt-32'>
      <div className='pointer-events-none fixed inset-0 overflow-hidden' aria-hidden='true'>
        <div className='absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-gold-500/4 blur-[120px]' />
        <div className='absolute bottom-1/4 right-1/4 h-64 w-64 rounded-full bg-gold-400/3 blur-[100px]' />
      </div>
      <GuestbookSEO />

      {/* Global reaction picker */}
      {reactionPickerForId !== null && (
        <ReactionPicker
          messageId={reactionPickerForId}
          onSelect={(id, key) => void handleAddReaction(id, key)}
          onClose={() => setReactionPickerForId(null)}
        />
      )}

      <GuestbookHero messageCount={messages.length} onCompose={openComposer} />

      {/* Main content */}
      <section className='px-4'>
        <div className='mx-auto grid max-w-6xl gap-6 xl:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] xl:items-start'>
          <GuestbookSidebar
            showForm={composer.showForm}
            onToggle={() => composer.setShowForm(!composer.showForm)}
          />

          {/* Feed */}
          <div className='grid gap-5'>
            <GuestbookComposer composer={composer} />

            {loadError && (
              <div className='rounded-xl border border-amber-400/25 bg-amber-500/8 px-4 py-3 text-sm text-amber-300'>
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
                      localReactions={localReactions[message.id]}
                      onAddReaction={setReactionPickerForId}
                      extraComments={extraComments[message.id]}
                      onSubmitReply={handleSubmitReply}
                      staggerIndex={index}
                      fingerprint={fingerprint}
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
                      Read more notes
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
