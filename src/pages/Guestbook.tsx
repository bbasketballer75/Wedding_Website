import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { GuestbookSEO } from '@/components/seo/SEOHead'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/context/ToastContext'
import { supabase, type GuestbookMessage as SupabaseMessage } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { formatTimeRemaining, rateLimiter } from '@/utils/rateLimiter'
import {
  BookHeart,
  CheckCircle,
  Loader2,
  MessageSquare,
  PenSquare,
  Search,
  Send,
  Smile,
  Sparkles,
  X,
} from 'lucide-react'

import storage from '@/utils/storage'

const REACTION_FINGERPRINT_KEY = 'wedding-guestbook-session-id'

function getOrCreateReactionFingerprint(): string {
  // Check if fingerprint already exists in localStorage
  const stored = storage.getItem(REACTION_FINGERPRINT_KEY)
  if (stored) return stored

  // Generate new UUID using crypto API
  const fingerprint =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2)}`

  // Persist to localStorage
  storage.setItem(REACTION_FINGERPRINT_KEY, fingerprint)
  return fingerprint
}

interface Comment {
  id: string
  author: string
  content: string
  created_at: string
}

interface Message {
  id: string
  name: string
  content: string
  timestamp: string
  reactions: Record<string, number>
  comments: Comment[]
}

const INITIAL_VISIBLE_MESSAGES = 8

const REACTION_TYPES = [
  { key: 'love', label: 'Love', emoji: '\u2764\uFE0F' },
  { key: 'clap', label: 'Clap', emoji: '\uD83D\uDC4F' },
  { key: 'laugh', label: 'Laugh', emoji: '\uD83D\uDE02' },
  { key: 'wow', label: 'Wow', emoji: '\uD83D\uDE2E' },
]

function formatGuestbookDate(timestamp?: string) {
  if (!timestamp) return 'Just now'
  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) return timestamp
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: parsed.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  })
}

function mapSupabaseMessage(message: SupabaseMessage): Message {
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

function MessageCard({
  message,
  isHighlighted = false,
  localReactions,
  onAddReaction,
  extraComments,
  onSubmitReply,
  staggerIndex = 0,
  fingerprint,
}: {
  message: Message
  isHighlighted?: boolean
  localReactions?: Record<string, number>
  onAddReaction: (messageId: string) => void
  extraComments?: Comment[]
  onSubmitReply: (messageId: string, content: string) => Promise<void>
  staggerIndex?: number
  fingerprint?: string
}) {
  const displayContent = message.content
  const reactions = localReactions ?? message.reactions
  const allComments = [...message.comments, ...(extraComments ?? [])]
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
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.45, delay: Math.min(staggerIndex * 0.06, 0.4) }}
      className={cn(
        'relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-sm border border-gold-200/12 px-5 py-5 transition-all duration-300 sm:px-6 sm:py-6',
        isHighlighted && 'ring-2 ring-gold-400/40 shadow-[0_0_40px_-10px_rgba(198,156,78,0.25)]'
      )}
    >
      <div className='flex min-w-0 items-center gap-3'>
        <Avatar fallback={message.name} size='lg' className='ring-2 ring-gold-400/30' />
        <div className='min-w-0'>
          <h3 className='truncate text-lg font-semibold text-white'>{message.name}</h3>
          <p className='mt-1 text-sm text-white/60'>{message.timestamp}</p>
        </div>
      </div>

      {displayContent && (
        <div className='mt-5 rounded-xl bg-white/10 px-4 py-4'>
          <p className='text-base leading-7 text-white/85'>{displayContent}</p>
        </div>
      )}

      {Object.keys(reactions).length > 0 && (
        <div className='mt-4 flex flex-wrap gap-2'>
          {Object.entries(reactions).map(([key, count]) => {
            const rType = REACTION_TYPES.find(r => r.key === key)
            const isOwnReaction = fingerprint
              ? storage.getItem(`wedding-reacted:${message.id}:${key}`) === fingerprint
              : false
            return (
              <button
                key={key}
                type='button'
                aria-label={`${rType?.label ?? key} reaction, ${count} votes`}
                className={cn(
                  'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors',
                  isOwnReaction
                    ? 'border-gold-400/50 bg-gold-500/15 text-gold-300'
                    : 'border-white/15 bg-white/8 text-white/75 hover:bg-white/14'
                )}
              >
                <span aria-hidden='true'>{rType?.emoji ?? key}</span>
                <span>{count}</span>
              </button>
            )
          })}
        </div>
      )}

      <div className='mt-4 flex items-center gap-3 border-t border-white/10 pt-4'>
        {fingerprint &&
          REACTION_TYPES.some(
            r => storage.getItem(`wedding-reacted:${message.id}:${r.key}`) === fingerprint
          ) && <span className='text-xs text-gold-400/70'>You reacted</span>}
        <button
          type='button'
          onClick={() => onAddReaction(message.id)}
          aria-haspopup='dialog'
          aria-controls='reaction-picker'
          className='inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/14 hover:text-white/90'
        >
          <Smile className='h-3.5 w-3.5' />
          Add a reaction
        </button>
        <button
          type='button'
          onClick={() => setReplyOpen(prev => !prev)}
          className='inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/14 hover:text-white/90'
        >
          <MessageSquare className='h-3.5 w-3.5' />
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
            onChange={e => setReplyText(e.target.value)}
            placeholder='Add a reply...'
            rows={2}
            // eslint-disable-next-line jsx-a11y/no-autofocus
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
                <Loader2 className='h-3.5 w-3.5 animate-spin' />
              ) : (
                <Send className='h-3.5 w-3.5' />
              )}
              Send
            </button>
          </div>
        </div>
      )}
    </motion.article>
  )
}

export default function Guestbook() {
  const [searchParams] = useSearchParams()
  const [messages, setMessages] = useState<Message[]>([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [content, setContent] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_MESSAGES)
  const [searchQuery, setSearchQuery] = useState('')
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null)
  const [reactionPickerForId, setReactionPickerForId] = useState<string | null>(null)
  const [localReactions, setLocalReactions] = useState<Record<string, Record<string, number>>>({})
  const [extraComments, setExtraComments] = useState<Record<string, Comment[]>>({})
  const composerRef = useRef<HTMLDivElement | null>(null)
  const { addToast } = useToast()
  const [fingerprint] = useState<string>(getOrCreateReactionFingerprint)

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

  useEffect(() => {
    const requestedMessageId = searchParams.get('message')
    if (!requestedMessageId) {
      setHighlightedMessageId(null)
      return
    }
    setHighlightedMessageId(requestedMessageId)
  }, [searchParams])

  useEffect(() => {
    if (showForm && composerRef.current) {
      composerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [showForm])

  const openComposer = () => {
    setShowForm(true)
    setSubmitError(null)
    setIsSubmitted(false)
  }

  const handleAddReaction = async (messageId: string, reactionKey: string) => {
    setReactionPickerForId(null)

    // Get or create session fingerprint for this browser
    const fingerprint = getOrCreateReactionFingerprint()
    const msg = messages.find(m => m.id === messageId)
    if (!msg) return

    // Get current reactions state (from localReactions or from message)
    const currentReactions = localReactions[messageId] ?? { ...msg.reactions }

    // For deduplication: track fingerprints in localStorage
    const reactedKey = `wedding-reacted:${messageId}:${reactionKey}`
    const previouslyReacted = storage.getItem(reactedKey) === fingerprint

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
      storage.setItem(reactedKey, fingerprint)
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
        storage.setItem(reactedKey, fingerprint)
      }
    }
  }

  const handleSubmitReply = async (messageId: string, replyContent: string): Promise<void> => {
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
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    const clientRateCheck = rateLimiter.check('guestbook-submit', {
      maxRequests: 3,
      windowMs: 60000,
    })
    if (!clientRateCheck.canProceed) {
      addToast(
        `Give it a moment — you can leave another note in ${formatTimeRemaining(clientRateCheck.timeRemainingMs)}`,
        'warning'
      )
      return
    }

    if (!name || !content.trim()) return

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const normalizedContent = content.trim()

      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'submit_guestbook_message_with_rate_limit',
        {
          p_name: name,
          p_email: email,
          p_content: normalizedContent,
          p_media_url: null,
          p_max_requests: 3,
          p_window_minutes: 1,
        }
      )

      if (!rpcError && rpcData) {
        const result = rpcData as { success: boolean; message_id: string; error_message: string }

        if (!result.success) {
          addToast(result.error_message || 'Just a moment before the next one.', 'warning')
          setIsSubmitting(false)
          return
        }

        setMessages(previous => [
          {
            id: result.message_id,
            name,
            content: normalizedContent,
            timestamp: 'Just now',
            reactions: {},
            comments: [],
          },
          ...previous,
        ])
      } else {
        const { data, error } = await supabase
          .from('guestbook_messages')
          .insert([{ name, email, content: normalizedContent, media_url: null }])
          .select()

        if (error) throw error
        if (data?.[0]) setMessages(previous => [mapSupabaseMessage(data[0]), ...previous])
      }

      setVisibleCount(INITIAL_VISIBLE_MESSAGES)
      setIsSubmitted(true)
      addToast('Your note is part of the book now. Thank you.', 'success')

      window.setTimeout(() => {
        setShowForm(false)
        setIsSubmitted(false)
        setName('')
        setEmail('')
        setContent('')
      }, 2200)
    } catch {
      setSubmitError("Something didn't go through — give it another try.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredMessages = searchQuery.trim()
    ? messages.filter(m => {
        const q = searchQuery.toLowerCase()
        return m.name.toLowerCase().includes(q) || m.content.toLowerCase().includes(q)
      })
    : messages
  // Cap slice synchronously so visibleCount being stale for one frame never shows
  // more items than exist in the current filtered set.
  const visibleMessages = filteredMessages.slice(0, Math.min(visibleCount, filteredMessages.length))
  const hasMoreMessages = filteredMessages.length > visibleCount

  // Reset visible count when search changes so pagination stays accurate
  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_MESSAGES)
  }, [searchQuery])

  useEffect(() => {
    if (!highlightedMessageId) return

    const highlightedIndex = filteredMessages.findIndex(
      message => message.id === highlightedMessageId
    )
    if (highlightedIndex === -1) return

    if (highlightedIndex >= visibleCount) {
      setVisibleCount(highlightedIndex + 1)
      return
    }

    const timeoutId = window.setTimeout(() => {
      const element = document.getElementById(`guestbook-message-${highlightedMessageId}`)
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 220)

    return () => window.clearTimeout(timeoutId)
  }, [filteredMessages, highlightedMessageId, visibleCount])

  return (
    <div className='min-h-screen bg-[linear-gradient(to_bottom,rgba(12,8,5,1),rgba(22,14,6,1))] pb-20 pt-28 sm:pt-32'>
      <div className='pointer-events-none fixed inset-0 overflow-hidden' aria-hidden='true'>
        <div className='absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-gold-500/4 blur-[120px]' />
        <div className='absolute bottom-1/4 right-1/4 h-64 w-64 rounded-full bg-gold-400/3 blur-[100px]' />
      </div>
      <GuestbookSEO />

      {/* Global reaction picker */}
      {reactionPickerForId !== null && (
        <div
          id='reaction-picker'
          className='fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-2xl border border-white/15 bg-[rgba(22,14,6,0.95)] px-4 py-3 shadow-2xl backdrop-blur-md'
        >
          <div className='flex items-center gap-2'>
            {REACTION_TYPES.map(r => (
              <button
                key={r.key}
                type='button'
                onClick={() => void handleAddReaction(reactionPickerForId, r.key)}
                aria-label={r.label}
                className='flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-2xl transition-transform hover:scale-110 hover:bg-white/8'
              >
                {r.emoji}
                <span className='text-[10px] text-white/50'>{r.label}</span>
              </button>
            ))}
            <button
              type='button'
              onClick={() => setReactionPickerForId(null)}
              aria-label='Close reaction picker'
              className='ml-2 rounded-full border border-white/15 bg-white/8 p-1.5 text-white/50 hover:text-white'
            >
              <X className='h-3.5 w-3.5' />
            </button>
          </div>
        </div>
      )}

      {/* Hero */}
      <section className='px-4 pb-10'>
        <div className='mx-auto max-w-6xl'>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className='relative overflow-hidden rounded-2xl bg-white/6 backdrop-blur-md border border-gold-200/15 px-6 py-10 sm:px-10 sm:py-14'
          >
            <div className='absolute -right-16 top-10 h-44 w-44 rounded-full bg-gold-500/8 blur-3xl' />
            <div className='absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-gold-400/5 blur-3xl' />
            <div className='relative max-w-2xl'>
              <span className='flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-gold-400'>
                <BookHeart className='h-3.5 w-3.5' />
                After the film
              </span>
              <h1 className='mt-6 text-5xl text-white sm:text-6xl'>Say something before you go.</h1>
              <p className='mt-5 text-base text-white/55 sm:text-lg'>
                The guestbook is where the day settles. Whatever you felt, what you remember, or
                what you want us to carry forward — leave it here.
              </p>
              <div className='mt-8 flex flex-wrap items-center gap-4'>
                <Button size='lg' onClick={() => openComposer()}>
                  Start your message
                </Button>
                {messages.length > 0 && (
                  <span className='text-sm text-white/35'>
                    {messages.length} {messages.length === 1 ? 'note' : 'notes'} so far
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Main content */}
      <section className='px-4'>
        <div className='mx-auto grid max-w-6xl gap-6 xl:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] xl:items-start'>
          {/* Sidebar */}
          <div className='grid gap-4 xl:sticky xl:top-28'>
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className='relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-sm border border-gold-200/12 px-5 py-5'
            >
              <p className='text-[10px] uppercase tracking-[0.3em] text-gold-400'>Leave a note</p>
              <h2 className='mt-4 text-2xl text-white'>Something to remember us by.</h2>
              <p className='mt-3 text-sm leading-6 text-white/55'>
                A few words is plenty. Write what came to mind on the drive home.
              </p>
              <Button
                onClick={() => {
                  setShowForm(prev => !prev)
                }}
                variant='secondary'
                className='mt-5 w-full'
                aria-expanded={showForm}
              >
                {showForm ? (
                  <>
                    <X className='h-4 w-4' />
                    Close
                  </>
                ) : (
                  <>
                    <Send className='h-4 w-4' />
                    Write a note
                  </>
                )}
              </Button>
            </motion.div>
          </div>

          {/* Feed */}
          <div className='grid gap-5'>
            <AnimatePresence>
              {showForm && (
                <motion.div
                  ref={composerRef}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  data-testid='guestbook-composer'
                  className='relative overflow-hidden rounded-2xl bg-white/6 backdrop-blur-md border border-gold-200/15 px-5 py-5 sm:px-6 sm:py-6 lg:px-8'
                >
                  {isSubmitted ? (
                    <div className='text-center'>
                      <div className='mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-green-400/25 bg-green-500/10 shadow-sm'>
                        <CheckCircle className='h-10 w-10 text-green-400' />
                      </div>
                      <span className='flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-gold-400 mt-6'>
                        <Sparkles className='h-3.5 w-3.5' />
                        Sent
                      </span>
                      <h2 className='mt-6 text-4xl text-white sm:text-5xl'>
                        Your note is part of the book now.
                      </h2>
                      <p className='mx-auto mt-4 max-w-2xl text-base text-white/55 sm:text-lg'>
                        Thank you for leaving something with us. We'll carry it forward.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit}>
                      <div className='flex items-start justify-between gap-4'>
                        <div>
                          <span className='flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-gold-400'>
                            <PenSquare className='h-3.5 w-3.5' />
                            Your note
                          </span>
                          <h2 className='mt-5 text-3xl text-white sm:text-4xl'>
                            What's on your heart?
                          </h2>
                        </div>
                        <button
                          type='button'
                          onClick={() => setShowForm(false)}
                          className='rounded-full border border-white/15 bg-white/8 p-2 text-white/50 shadow-sm transition-colors hover:text-white hover:bg-white/12'
                          aria-label='Close composer'
                          aria-expanded='true'
                        >
                          <X className='h-5 w-5' />
                        </button>
                      </div>

                      <div className='mt-6 grid gap-5 lg:grid-cols-2'>
                        <div>
                          <Label htmlFor='guestbook-name' className='text-white/70'>
                            Your name
                          </Label>
                          <Input
                            id='guestbook-name'
                            className='bg-white/8 border-white/12 text-white placeholder:text-white/30 focus:border-gold-400/50'
                            value={name}
                            onChange={event => setName(event.target.value)}
                            placeholder='Your name'
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor='guestbook-email' className='text-white/70'>
                            Email <span className='font-normal text-white/35'>(optional)</span>
                          </Label>
                          <Input
                            id='guestbook-email'
                            type='email'
                            className='bg-white/8 border-white/12 text-white placeholder:text-white/30 focus:border-gold-400/50'
                            value={email}
                            onChange={event => setEmail(event.target.value)}
                            placeholder='your@email.com'
                          />
                          <p className='mt-2 text-xs text-white/30'>
                            Just in case we want to follow up with you.
                          </p>
                        </div>
                      </div>

                      <div className='mt-6'>
                        <div className='flex items-baseline justify-between'>
                          <Label htmlFor='guestbook-message' className='text-white/70'>
                            Your message
                          </Label>
                          <span
                            className={`text-xs tabular-nums transition-colors ${content.length > 900 ? 'text-amber-400' : 'text-white/30'}`}
                          >
                            {content.length}/1000
                          </span>
                        </div>
                        <Textarea
                          id='guestbook-message'
                          className='mt-1.5 bg-white/8 border-white/12 text-white placeholder:text-white/30 focus:border-gold-400/50'
                          value={content}
                          onChange={event => setContent(event.target.value.slice(0, 1000))}
                          placeholder='Tell us what you felt, what you remember, or what you hope for us next.'
                          rows={6}
                          maxLength={1000}
                          required
                        />
                      </div>

                      {submitError && (
                        <div className='mt-5 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3'>
                          <p className='text-sm text-rose-300'>{submitError}</p>
                        </div>
                      )}

                      <div className='mt-6 flex justify-end border-t border-white/10 pt-5'>
                        <Button
                          type='submit'
                          size='lg'
                          disabled={isSubmitting || !name || !content.trim()}
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className='h-4 w-4 animate-spin' />
                              Sending…
                            </>
                          ) : (
                            <>
                              <Send className='h-4 w-4' />
                              Post to the guestbook
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {loadError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className='rounded-xl border border-amber-400/25 bg-amber-500/8 px-4 py-3 text-sm text-amber-300'
              >
                {loadError}
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              data-testid='guestbook-feed'
              className='relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-sm border border-gold-200/12 px-5 py-5'
            >
              <div className='flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between'>
                <div>
                  <p className='text-[10px] uppercase tracking-[0.3em] text-gold-400'>
                    Notes from the day
                  </p>
                  <h2 className='mt-3 text-3xl text-white sm:text-4xl'>Every guestbook entry</h2>
                </div>
                <div className='inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm text-white/60'>
                  <BookHeart className='h-4 w-4 text-gold-400' />
                  {filteredMessages.length} {filteredMessages.length === 1 ? 'note' : 'notes'}
                </div>
              </div>

              {/* Search bar */}
              {messages.length > 0 && (
                <div className='relative mt-4'>
                  <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35' />
                  <input
                    type='search'
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder='Search by name or message…'
                    aria-label='Search guestbook messages'
                    className='w-full rounded-xl border border-white/12 bg-white/6 py-2.5 pl-9 pr-9 text-sm text-white placeholder:text-white/30 focus:border-gold-400/60 focus:outline-none focus:ring-1 focus:ring-gold-400/40'
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      aria-label='Clear search'
                      className='absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors'
                    >
                      <X className='h-4 w-4' />
                    </button>
                  )}
                </div>
              )}

              {/* No-results state */}
              {searchQuery && filteredMessages.length === 0 && !isLoading && (
                <p className='mt-4 text-sm text-white/40 text-center py-8'>
                  No notes matching &ldquo;{searchQuery}&rdquo;
                </p>
              )}
            </motion.div>

            {isLoading ? (
              <div className='grid gap-5 xl:grid-cols-2'>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className='relative overflow-hidden rounded-2xl border border-white/8 bg-white/5 px-5 py-5 sm:px-6 sm:py-6'
                    style={{ animationDelay: `${i * 0.06}s` }}
                    aria-hidden='true'
                  >
                    {/* Avatar + name row */}
                    <div className='flex items-center gap-3'>
                      <div className='skeleton-dark h-11 w-11 shrink-0 rounded-full' />
                      <div className='flex-1 space-y-2'>
                        <div
                          className='skeleton-dark h-4 w-2/5 rounded-full'
                          style={{ animationDelay: `${i * 0.06 + 0.05}s` }}
                        />
                        <div
                          className='skeleton-dark h-3 w-1/4 rounded-full'
                          style={{ animationDelay: `${i * 0.06 + 0.1}s` }}
                        />
                      </div>
                    </div>
                    {/* Message body */}
                    <div className='mt-5 space-y-2 rounded-xl bg-white/4 px-4 py-4'>
                      <div
                        className='skeleton-dark h-3 w-full rounded-full'
                        style={{ animationDelay: `${i * 0.06 + 0.12}s` }}
                      />
                      <div
                        className='skeleton-dark h-3 w-full rounded-full'
                        style={{ animationDelay: `${i * 0.06 + 0.16}s` }}
                      />
                      <div
                        className='skeleton-dark h-3 w-3/5 rounded-full'
                        style={{ animationDelay: `${i * 0.06 + 0.2}s` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
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
                      onClick={() => setVisibleCount(current => current + INITIAL_VISIBLE_MESSAGES)}
                      className='cursor-pointer rounded-full border border-white/15 bg-white/8 px-6 py-2.5 text-sm text-white/70 transition-all hover:bg-white/14 hover:text-white'
                    >
                      Read more notes
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className='relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-sm border border-white/8 px-6 py-16 text-center'>
                {/* Feather quill SVG */}
                <svg
                  className='mx-auto mb-6 h-12 w-12 text-gold-400/55'
                  viewBox='0 0 48 48'
                  fill='none'
                  aria-hidden='true'
                >
                  <path
                    d='M38 4C28 4 14 18 12 38M12 38c4-8 10-13 18-15M12 38l4-4'
                    stroke='currentColor'
                    strokeWidth='1.5'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  />
                  <path
                    d='M12 38c2-4 4-6 6-6'
                    stroke='currentColor'
                    strokeWidth='1.2'
                    strokeLinecap='round'
                  />
                </svg>
                <p className='font-script text-5xl text-gold-300/75'>Leave a note</p>
                <p className='mt-4 font-display text-xl text-white/70'>
                  No notes yet — yours could be the first.
                </p>
                <p className='mx-auto mt-2 max-w-md text-sm text-white/35'>
                  Leave something small. It doesn't need to be a speech.
                </p>
                <Button className='mt-8' size='lg' onClick={() => openComposer()}>
                  Leave the first note
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
