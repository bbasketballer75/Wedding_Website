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
  PenSquare,
  Send,
  Sparkles,
  X,
} from 'lucide-react'

interface Message {
  id: string
  name: string
  content: string
  type: 'text' | 'voice' | 'video'
  timestamp: string
}

const INITIAL_VISIBLE_MESSAGES = 8

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
  return {
    id: message.id,
    name: message.name,
    content: message.content,
    type: message.type,
    timestamp: formatGuestbookDate(message.created_at),
  }
}

function getDisplayContent(message: Message) {
  if (message.type === 'voice' && message.content === 'Voice message') return ''
  if (message.type === 'video' && message.content === 'Video message') return ''
  return message.content
}

function MessageCard({
  message,
  isHighlighted = false,
}: {
  message: Message
  isHighlighted?: boolean
}) {
  const displayContent = getDisplayContent(message)

  return (
    <motion.article
      id={`guestbook-message-${message.id}`}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      className={cn(
        'relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-sm border border-gold-200/12 px-5 py-5 transition-all duration-300 sm:px-6 sm:py-6',
        isHighlighted && 'ring-2 ring-gold-400/40 shadow-[0_0_40px_-10px_rgba(198,156,78,0.25)]'
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar fallback={message.name} size="lg" className="ring-2 ring-gold-400/30" />
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-white">{message.name}</h3>
          <p className="mt-1 text-sm text-white/45">{message.timestamp}</p>
        </div>
      </div>

      {displayContent && (
        <div className="mt-5 rounded-xl bg-white/6 px-4 py-4">
          <p className="text-base leading-7 text-white/75">{displayContent}</p>
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
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null)
  const composerRef = useRef<HTMLDivElement | null>(null)
  const { addToast } = useToast()

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        setIsLoading(true)
        setLoadError(null)

        const { data, error } = await supabase
          .from('guestbook_messages')
          .select('id, name, content, type, created_at')
          .order('created_at', { ascending: false })

        if (error) {
          setLoadError('Having trouble loading notes right now — yours will still go through below.')
          setMessages([])
          return
        }

        setMessages((data || []).map((row) => mapSupabaseMessage(row as SupabaseMessage)))
      } catch {
        setLoadError('Having trouble reaching the guestbook — your note will still go through below.')
        setMessages([])
      } finally {
        setIsLoading(false)
      }
    }

    void fetchMessages()
  }, [])

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_MESSAGES)
  }, [messages.length])

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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    const clientRateCheck = rateLimiter.check('guestbook-submit', { maxRequests: 3, windowMs: 60000 })
    if (!clientRateCheck.canProceed) {
      addToast(`Give it a moment — you can leave another note in ${formatTimeRemaining(clientRateCheck.timeRemainingMs)}`, 'warning')
      return
    }

    if (!name || !content.trim()) return

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const normalizedContent = content.trim()

      const { data: rpcData, error: rpcError } = await supabase.rpc('submit_guestbook_message_with_rate_limit', {
        p_name: name,
        p_email: email,
        p_content: normalizedContent,
        p_type: 'text',
        p_media_url: null,
        p_max_requests: 3,
        p_window_minutes: 1,
      })

      if (!rpcError && rpcData) {
        const result = rpcData as { success: boolean; message_id: string; error_message: string }

        if (!result.success) {
          addToast(result.error_message || 'Just a moment before the next one.', 'warning')
          setIsSubmitting(false)
          return
        }

        setMessages((previous) => [
          { id: result.message_id, name, content: normalizedContent, type: 'text', timestamp: 'Just now' },
          ...previous,
        ])
      } else {
        const { data, error } = await supabase
          .from('guestbook_messages')
          .insert([{ name, email, content: normalizedContent, type: 'text', media_url: null }])
          .select()

        if (error) throw error
        if (data?.[0]) setMessages((previous) => [mapSupabaseMessage(data[0]), ...previous])
      }

      setVisibleCount(INITIAL_VISIBLE_MESSAGES)
      setIsSubmitted(true)

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

  const visibleMessages = messages.slice(0, visibleCount)
  const hasMoreMessages = messages.length > visibleCount
  const featuredMessage = messages[0]

  useEffect(() => {
    if (!highlightedMessageId) return

    const highlightedIndex = messages.findIndex((message) => message.id === highlightedMessageId)
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
  }, [messages, highlightedMessageId, visibleCount])

  return (
    <div className="min-h-screen bg-[linear-gradient(to_bottom,rgba(12,8,5,1),rgba(22,14,6,1))] pb-20 pt-28 sm:pt-32">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-gold-500/4 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 h-64 w-64 rounded-full bg-gold-400/3 blur-[100px]" />
      </div>
      <GuestbookSEO />

      {/* Hero */}
      <section className="px-4 pb-10">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="relative overflow-hidden rounded-2xl bg-white/6 backdrop-blur-md border border-gold-200/15 px-6 py-10 sm:px-10 sm:py-14"
          >
            <div className="absolute -right-16 top-10 h-44 w-44 rounded-full bg-gold-500/8 blur-3xl" />
            <div className="absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-gold-400/5 blur-3xl" />
            <div className="relative max-w-2xl">
              <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-gold-400"><BookHeart className="h-3.5 w-3.5" />After the film</span>
              <h1 className="mt-6 text-5xl text-white sm:text-6xl">Say something before you go.</h1>
              <p className="mt-5 text-base text-white/55 sm:text-lg">
                The guestbook is where the day settles. Whatever you felt, what you remember, or what you want us to carry forward — leave it here.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Button size="lg" onClick={() => openComposer()}>Leave a note</Button>
                {messages.length > 0 && (
                  <span className="text-sm text-white/35">{messages.length} {messages.length === 1 ? 'note' : 'notes'} so far</span>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Main content */}
      <section className="px-4">
        <div className="mx-auto grid max-w-6xl gap-6 xl:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] xl:items-start">

          {/* Sidebar */}
          <div className="grid gap-4 xl:sticky xl:top-28">
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-sm border border-gold-200/12 px-5 py-5">
              <p className="text-[10px] uppercase tracking-[0.3em] text-gold-400">Leave a note</p>
              <h2 className="mt-4 text-2xl text-white">Something to remember us by.</h2>
              <p className="mt-3 text-sm leading-6 text-white/55">A few words is plenty. Write what came to mind on the drive home.</p>
              <Button
                type="button"
                size="lg"
                variant={showForm ? 'secondary' : 'primary'}
                onClick={() => (showForm ? setShowForm(false) : openComposer())}
                className="mt-5 w-full"
                aria-expanded={showForm}
              >
                {showForm ? <><X className="h-4 w-4" />Close</> : <><Send className="h-4 w-4" />Write a note</>}
              </Button>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className="relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-sm border border-gold-200/12 px-5 py-5">
              <p className="text-[10px] uppercase tracking-[0.3em] text-gold-400">Newest note</p>
              {featuredMessage ? (
                <>
                  <p className="mt-3 text-lg font-semibold text-white">{featuredMessage.name}</p>
                  <p className="mt-2 text-sm text-white/45">{featuredMessage.timestamp}</p>
                  <p className="mt-4 text-sm leading-6 text-white/60">
                    {getDisplayContent(featuredMessage).slice(0, 120)}
                    {getDisplayContent(featuredMessage).length > 120 ? '…' : ''}
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm leading-6 text-white/55">
                  The first note will appear here once someone leaves a memory from the day.
                </p>
              )}
            </motion.div>
          </div>

          {/* Feed */}
          <div className="space-y-6">
            <AnimatePresence initial={false}>
              {showForm && (
                <motion.div
                  ref={composerRef}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  data-testid="guestbook-composer"
                  className="relative overflow-hidden rounded-2xl bg-white/6 backdrop-blur-md border border-gold-200/15 px-5 py-5 sm:px-6 sm:py-6 lg:px-8"
                >
                  {isSubmitted ? (
                    <div className="text-center">
                      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-green-400/25 bg-green-500/10 shadow-sm">
                        <CheckCircle className="h-10 w-10 text-green-400" />
                      </div>
                      <span className="flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-gold-400 mt-6"><Sparkles className="h-3.5 w-3.5" />Sent</span>
                      <h2 className="mt-6 text-4xl text-white sm:text-5xl">Your note is in the book.</h2>
                      <p className="mx-auto mt-4 max-w-2xl text-base text-white/55 sm:text-lg">
                        Thank you for leaving something with us. We'll carry it forward.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-gold-400"><PenSquare className="h-3.5 w-3.5" />Your note</span>
                          <h2 className="mt-5 text-3xl text-white sm:text-4xl">What's on your heart?</h2>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowForm(false)}
                          className="rounded-full border border-white/15 bg-white/8 p-2 text-white/50 shadow-sm transition-colors hover:text-white hover:bg-white/12"
                          aria-label="Close"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>

                      <div className="mt-6 grid gap-5 lg:grid-cols-2">
                        <div>
                          <Label htmlFor="guestbook-name" className="text-white/70">Your name</Label>
                          <Input id="guestbook-name" className="bg-white/8 border-white/12 text-white placeholder:text-white/30 focus:border-gold-400/50" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" required />
                        </div>
                        <div>
                          <Label htmlFor="guestbook-email" className="text-white/70">
                            Email <span className="font-normal text-white/35">(optional)</span>
                          </Label>
                          <Input id="guestbook-email" type="email" className="bg-white/8 border-white/12 text-white placeholder:text-white/30 focus:border-gold-400/50" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="your@email.com" />
                          <p className="mt-2 text-xs text-white/30">Just in case we want to follow up with you.</p>
                        </div>
                      </div>

                      <div className="mt-6">
                        <Label htmlFor="guestbook-message" className="text-white/70">Your message</Label>
                        <Textarea
                          id="guestbook-message"
                          className="bg-white/8 border-white/12 text-white placeholder:text-white/30 focus:border-gold-400/50"
                          value={content}
                          onChange={(event) => setContent(event.target.value)}
                          placeholder="Tell us what you felt, what you remember, or what you hope for us next."
                          rows={6}
                          required
                        />
                      </div>

                      {submitError && (
                        <div className="mt-5 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3">
                          <p className="text-sm text-rose-300">{submitError}</p>
                        </div>
                      )}

                      <div className="mt-6 flex justify-end border-t border-white/10 pt-5">
                        <Button type="submit" size="lg" disabled={isSubmitting || !name || !content.trim()}>
                          {isSubmitting
                            ? <><Loader2 className="h-4 w-4 animate-spin" />Sending…</>
                            : <><Send className="h-4 w-4" />Send your note</>}
                        </Button>
                      </div>
                    </form>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {loadError && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-amber-400/25 bg-amber-500/8 px-4 py-3 text-sm text-amber-300">
                {loadError}
              </motion.div>
            )}

            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} data-testid="guestbook-feed" className="relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-sm border border-gold-200/12 px-5 py-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-gold-400">Notes from the day</p>
                  <h2 className="mt-3 text-3xl text-white sm:text-4xl">
                    Everyone who left a note
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm text-white/60">
                    <BookHeart className="h-4 w-4 text-gold-400" />
                    {messages.length} {messages.length === 1 ? 'note' : 'notes'}
                  </div>
                </div>
              </div>
            </motion.div>

            {isLoading ? (
              <div className="relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-sm border border-white/8 px-6 py-12 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/8 text-gold-400">
                  <Loader2 className="h-7 w-7 animate-spin" />
                </div>
                <p className="mt-6 font-display text-2xl text-white">Gathering the notes</p>
                <p className="mt-2 text-white/40">Just a moment while we bring in everything from the day.</p>
              </div>
            ) : messages.length > 0 ? (
              <>
                <div className="grid gap-5 xl:grid-cols-2">
                  {visibleMessages.map((message) => (
                    <MessageCard
                      key={message.id}
                      message={message}
                      isHighlighted={highlightedMessageId === message.id}
                    />
                  ))}
                </div>
                {hasMoreMessages && (
                  <div className="flex justify-center pt-2">
                    <button
                      type="button"
                      onClick={() => setVisibleCount((current) => current + INITIAL_VISIBLE_MESSAGES)}
                      className="border border-white/12 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 rounded-full px-6 py-2.5 text-sm transition-all"
                    >
                      Read more notes
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-sm border border-white/8 px-6 py-12 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/8 text-gold-400">
                  <BookHeart className="h-7 w-7" />
                </div>
                <p className="mt-6 font-display text-2xl text-white">No notes yet — yours could be the first.</p>
                <p className="mx-auto mt-2 max-w-md text-white/40">Leave something small. It doesn't need to be a speech.</p>
                <Button className="mt-6" size="lg" onClick={() => openComposer()}>Leave the first note</Button>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
