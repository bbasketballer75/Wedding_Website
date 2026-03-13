import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { GuestbookSEO } from '@/components/seo/SEOHead'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { ReactionPicker, type ReactionType } from '@/components/guestbook/ReactionPicker'
import { VideoRecorder } from '@/components/guestbook/VideoRecorder'
import { VoiceRecorder } from '@/components/guestbook/VoiceRecorder'
import { useToast } from '@/context/ToastContext'
import { supabase, type GuestbookMessage as SupabaseMessage } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { formatTimeRemaining, rateLimiter } from '@/utils/rateLimiter'
import {
  BookHeart,
  CheckCircle,
  Loader2,
  Mail,
  MessageCircle,
  Mic,
  Pause,
  PenSquare,
  Play,
  Send,
  Sparkles,
  Video,
  X,
} from 'lucide-react'

interface Comment {
  id: string
  author: string
  content: string
  timestamp: string
}

interface SupabaseCommentRecord {
  id: string
  message_id?: string
  author: string
  content: string
  timestamp?: string
  created_at?: string
}

interface Message {
  id: string
  name: string
  content: string
  type: 'text' | 'voice' | 'video'
  mediaUrl?: string
  reactions: Array<{ type: ReactionType; count: number; isActive: boolean }>
  comments: Comment[]
  timestamp: string
}

const EMPTY_CAPTIONS_TRACK = 'data:text/vtt,WEBVTT'
const INITIAL_VISIBLE_MESSAGES = 8

const composerModes = [
  { type: 'text', label: 'Text', description: 'Write a note, memory, or blessing.', icon: PenSquare },
  { type: 'voice', label: 'Voice', description: 'Record something more personal.', icon: Mic },
  { type: 'video', label: 'Video', description: 'Send a quick face-to-camera hello.', icon: Video },
] as const

const messageTypeMeta = {
  text: { label: 'Written note', icon: PenSquare, badgeClass: 'border-gold-200 bg-gold-50 text-gold-700' },
  voice: { label: 'Voice note', icon: Mic, badgeClass: 'border-rose-200 bg-rose-50 text-rose-600' },
  video: { label: 'Video note', icon: Video, badgeClass: 'border-sage-200 bg-sage-100 text-charcoal-700' },
} as const

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

function mapSupabaseMessage(message: SupabaseMessage & { comments?: SupabaseCommentRecord[] }): Message {
  const reactions: Message['reactions'] = []

  if (message.reactions) {
    Object.entries(message.reactions).forEach(([type, count]) => {
      if (typeof count === 'number' && count > 0) {
        reactions.push({ type: type as ReactionType, count, isActive: false })
      }
    })
  }

  return {
    id: message.id,
    name: message.name,
    content: message.content,
    type: message.type,
    mediaUrl: message.media_url || undefined,
    reactions,
    comments: (message.comments || []).map((comment) => ({
      id: comment.id,
      author: comment.author,
      content: comment.content,
      timestamp: formatGuestbookDate(comment.created_at ?? comment.timestamp),
    })),
    timestamp: formatGuestbookDate(message.created_at),
  }
}

function formatAudioTime(seconds: number) {
  const safe = Number.isFinite(seconds) ? seconds : 0
  return `${Math.floor(safe / 60)}:${Math.floor(safe % 60).toString().padStart(2, '0')}`
}

function createGuestMediaFileName(extension = 'webm') {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? `${crypto.randomUUID()}.${extension}`
    : `${Date.now()}_${Math.random().toString(36).slice(2)}.${extension}`
}

function getDisplayContent(message: Message) {
  if (message.type === 'voice' && message.content === 'Voice message') return ''
  if (message.type === 'video' && message.content === 'Video message') return ''
  return message.content
}

function AudioPlayer({ url }: { url?: string }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [bars] = useState(() => Array.from({ length: 18 }, (_, index) => 10 + ((index * 9) % 18)))

  if (!url) {
    return (
      <div className="rounded-[1.5rem] border border-rose-200/70 bg-rose-50/90 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white text-rose-500 shadow-sm">
            <Mic className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-charcoal-900">Voice note shared</p>
            <p className="text-sm text-charcoal-500">Playback preview is unavailable right now, but the voice note is still part of the guestbook.</p>
          </div>
        </div>
      </div>
    )
  }

  const activeBars = Math.max(1, Math.round((duration > 0 ? currentTime / duration : 0) * bars.length))

  return (
    <div className="rounded-[1.5rem] border border-rose-200/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(253,246,244,0.98)_55%,rgba(249,232,227,0.94))] px-4 py-4 shadow-sm">
      <audio
        ref={audioRef}
        src={url}
        onEnded={() => {
          setIsPlaying(false)
          setCurrentTime(0)
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
      >
        <track kind="captions" src={EMPTY_CAPTIONS_TRACK} srcLang="en" label="No captions available" />
      </audio>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => {
            if (!audioRef.current) return
            if (isPlaying) {
              audioRef.current.pause()
              setIsPlaying(false)
              return
            }
            void audioRef.current.play()
            setIsPlaying(true)
          }}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-gold-300/30 bg-[linear-gradient(145deg,rgba(58,42,33,0.98),rgba(77,58,44,0.96))] text-cinematic-primary shadow-[0_18px_36px_-24px_rgba(21,20,19,0.62)] transition-all hover:border-gold-300/45 hover:brightness-110"
          aria-label={isPlaying ? 'Pause voice message playback' : 'Play voice message'}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" fill="currentColor" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-charcoal-900">Voice note</p>
            <span className="text-xs uppercase tracking-[0.24em] text-charcoal-400">
              {formatAudioTime(isPlaying ? currentTime : duration || currentTime)}
            </span>
          </div>

          <div className="mt-3 flex h-10 items-end gap-1">
            {bars.map((height, index) => (
              <div
                key={index}
                className={cn(
                  'w-1 rounded-full transition-colors duration-300',
                  index < activeBars ? 'bg-rose-400' : 'bg-rose-200'
                )}
                style={{ height }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function MessageCard({
  message,
  isHighlighted = false,
  onReact,
  onReply,
}: {
  message: Message
  isHighlighted?: boolean
  onReact: (id: string, type: ReactionType) => void
  onReply: (id: string, content: string) => void
}) {
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [showAllReplies, setShowAllReplies] = useState(false)
  const [replyContent, setReplyContent] = useState('')
  const meta = messageTypeMeta[message.type]
  const TypeIcon = meta.icon
  const displayContent = getDisplayContent(message)
  const visibleComments = showAllReplies ? message.comments : message.comments.slice(0, 2)

  return (
    <motion.article
      id={`guestbook-message-${message.id}`}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      className={cn(
        'editorial-card px-5 py-5 transition-all duration-300 sm:px-6 sm:py-6',
        isHighlighted && 'ring-2 ring-gold-300/80 shadow-[0_24px_60px_-36px_rgba(173,129,49,0.45)]'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar fallback={message.name} size="lg" />
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold text-charcoal-900">{message.name}</h3>
            <p className="mt-1 text-sm text-charcoal-500">{message.timestamp}</p>
          </div>
        </div>

        <Badge variant="secondary" className={cn('gap-2 border px-3 py-1.5 text-[10px]', meta.badgeClass)}>
          <TypeIcon className="h-3.5 w-3.5" />
          {meta.label}
        </Badge>
      </div>

      <div className="mt-5 space-y-4">
        {message.type === 'video' &&
          (message.mediaUrl ? (
            <div className="overflow-hidden rounded-[1.5rem] border border-gold-200/14 bg-[linear-gradient(145deg,rgba(44,32,25,0.96),rgba(58,42,33,0.98)_52%,rgba(77,58,44,0.94))] shadow-[0_24px_56px_-32px_rgba(21,20,19,0.72)]">
              <video
                src={message.mediaUrl}
                controls
                className="aspect-video w-full object-cover"
                aria-label={`Video message from ${message.name}`}
              >
                <track kind="captions" src={EMPTY_CAPTIONS_TRACK} srcLang="en" label="No captions available" />
              </video>
            </div>
          ) : (
            <div className="rounded-[1.5rem] border border-sage-200/80 bg-sage-100/90 px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white text-charcoal-700 shadow-sm">
                  <Video className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-charcoal-900">Video note shared</p>
                  <p className="text-sm text-charcoal-500">Playback preview is unavailable right now, but the note is still part of the guestbook.</p>
                </div>
              </div>
            </div>
          ))}

        {message.type === 'voice' && <AudioPlayer url={message.mediaUrl} />}

        {displayContent && (
          <div className="rounded-[1.35rem] bg-white/74 px-4 py-4">
            <p className="text-base leading-7 text-charcoal-700">{displayContent}</p>
          </div>
        )}
      </div>

      {message.comments.length > 0 && (
        <div className="mt-5 rounded-[1.35rem] border border-white/75 bg-cream-50/88 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] uppercase tracking-[0.28em] text-charcoal-500">Replies</p>
            <span className="text-xs text-charcoal-400">{message.comments.length} total</span>
          </div>

          <div className="mt-4 space-y-3">
            {visibleComments.map((comment) => (
              <div key={comment.id} className="rounded-2xl bg-cream-50/90 px-4 py-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-charcoal-900">{comment.author}</span>
                  <span className="text-charcoal-400">{comment.timestamp}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-charcoal-600">{comment.content}</p>
              </div>
            ))}
          </div>

          {message.comments.length > 2 && (
            <button
              type="button"
              onClick={() => setShowAllReplies((current) => !current)}
              className="mt-4 text-xs font-medium uppercase tracking-[0.24em] text-gold-700 transition-colors hover:text-gold-600"
            >
              {showAllReplies ? 'Show fewer replies' : `Show all ${message.comments.length} replies`}
            </button>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3 border-t border-charcoal-900/8 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="rounded-full bg-cream-50/90 px-2 py-1">
          <ReactionPicker reactions={message.reactions} onReact={(type) => onReact(message.id, type)} />
        </div>

        <button
          type="button"
          onClick={() => setShowReplyForm((current) => !current)}
          className={cn(
            'inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition-colors',
            showReplyForm
              ? 'border-gold-300 bg-gold-50 text-gold-700'
              : 'border-white/70 bg-cream-50/88 text-charcoal-500 hover:text-charcoal-700'
          )}
          aria-expanded={showReplyForm}
        >
          <MessageCircle className="h-4 w-4" />
          Reply
          {message.comments.length > 0 && <span className="text-charcoal-400">({message.comments.length})</span>}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {showReplyForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={(event) => {
              event.preventDefault()
              if (!replyContent.trim()) return
              onReply(message.id, replyContent)
              setReplyContent('')
              setShowReplyForm(false)
            }}
            className="mt-4 overflow-hidden rounded-[1.35rem] border border-white/80 bg-white/72 px-4 py-4"
          >
            <Label htmlFor={`reply-${message.id}`}>Add a reply</Label>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <Input id={`reply-${message.id}`} value={replyContent} onChange={(event) => setReplyContent(event.target.value)} placeholder="Write a quick note back..." className="flex-1" />
              <Button type="submit" size="sm" disabled={!replyContent.trim()}>
                <Send className="h-4 w-4" />
                Send
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </motion.article>
  )
}
export default function Guestbook() {
  const [searchParams] = useSearchParams()
  const [messages, setMessages] = useState<Message[]>([])
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState<'text' | 'voice' | 'video'>('text')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [content, setContent] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [filter, setFilter] = useState<'all' | 'text' | 'voice' | 'video'>('all')
  const [mediaBlob, setMediaBlob] = useState<Blob | null>(null)
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

        const { data: rpcData, error: rpcError } = await supabase.rpc('get_guestbook_messages_with_comments')
        if (!rpcError && Array.isArray(rpcData)) {
          setMessages(rpcData.map(mapSupabaseMessage))
          return
        }

        const [{ data, error }, { data: commentsData, error: commentsError }] = await Promise.all([
          supabase
            .from('guestbook_messages')
            .select('*')
            .order('created_at', { ascending: false }),
          supabase
            .from('guestbook_comments')
            .select('*')
            .order('created_at', { ascending: true }),
        ])

        if (error) {
          setLoadError('Could not load live messages right now. New notes can still be added below.')
          setMessages([])
          return
        }

        const commentsByMessageId = new Map<string, SupabaseCommentRecord[]>()
        if (!commentsError) {
          for (const comment of commentsData || []) {
            if (!comment.message_id) {
              continue
            }
            const messageComments = commentsByMessageId.get(comment.message_id) || []
            messageComments.push(comment)
            commentsByMessageId.set(comment.message_id, messageComments)
          }
        }

        setMessages(
          (data || []).map((message) =>
            mapSupabaseMessage({
              ...message,
              comments: commentsByMessageId.get(message.id) || [],
            })
          )
        )
      } catch {
        setLoadError('Could not connect to the guestbook database. New notes can still be added below.')
        setMessages([])
      } finally {
        setIsLoading(false)
      }
    }

    void fetchMessages()
  }, [])

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_MESSAGES)
  }, [filter, messages.length])

  useEffect(() => {
    const requestedMessageId = searchParams.get('message')
    if (!requestedMessageId) {
      setHighlightedMessageId(null)
      return
    }

    setHighlightedMessageId(requestedMessageId)
    setFilter('all')
  }, [searchParams])

  useEffect(() => {
    if (showForm && composerRef.current) {
      composerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [showForm])

  const openComposer = (nextType?: 'text' | 'voice' | 'video') => {
    if (nextType) setFormType(nextType)
    setShowForm(true)
    setSubmitError(null)
    setIsSubmitted(false)
  }

  const handleReact = async (messageId: string, reactionType: ReactionType) => {
    const currentMessage = messages.find((message) => message.id === messageId)
    if (!currentMessage) return

    setMessages((previous) =>
      previous.map((message) => {
        if (message.id !== messageId) return message
        const existing = message.reactions.find((reaction) => reaction.type === reactionType)

        if (existing) {
          return {
            ...message,
            reactions: message.reactions
              .map((reaction) =>
                reaction.type === reactionType
                  ? { ...reaction, count: reaction.isActive ? reaction.count - 1 : reaction.count + 1, isActive: !reaction.isActive }
                  : reaction
              )
              .filter((reaction) => reaction.count > 0),
          }
        }

        return {
          ...message,
          reactions: [...message.reactions, { type: reactionType, count: 1, isActive: true }],
        }
      })
    )

    try {
      const existing = currentMessage.reactions.find((reaction) => reaction.type === reactionType)
      const updated: Record<string, number> = {}

      currentMessage.reactions.forEach((reaction) => {
        if (reaction.type === reactionType) {
          const nextCount = reaction.isActive ? reaction.count - 1 : reaction.count + 1
          if (nextCount > 0) updated[reaction.type] = nextCount
        } else if (reaction.count > 0) {
          updated[reaction.type] = reaction.count
        }
      })

      if (!existing) updated[reactionType] = 1
      await supabase.from('guestbook_messages').update({ reactions: updated }).eq('id', messageId)
    } catch {
      // Keep optimistic UI.
    }
  }

  const handleReply = async (messageId: string, replyContent: string) => {
    const newComment: Comment = { id: `comment-${Date.now()}`, author: 'Guest', content: replyContent, timestamp: 'Just now' }

    setMessages((previous) =>
      previous.map((message) =>
        message.id === messageId ? { ...message, comments: [...message.comments, newComment] } : message
      )
    )

    try {
      await supabase
        .from('guestbook_comments')
        .insert([{ message_id: messageId, author: 'Guest', content: replyContent }])
    } catch {
      // Keep optimistic UI.
    }
  }

  const uploadMedia = async (blob: Blob, type: 'voice' | 'video') => {
    try {
      const bucket = type === 'voice' ? 'guest-voice' : 'guest-videos'
      const fileName = createGuestMediaFileName('webm')

      const { error } = await supabase.storage.from(bucket).upload(fileName, blob, {
        contentType: type === 'voice' ? 'audio/webm' : 'video/webm',
      })

      if (error) return null

      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName)
      return publicUrl
    } catch {
      return null
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    const clientRateCheck = rateLimiter.check('guestbook-submit', { maxRequests: 3, windowMs: 60000 })
    if (!clientRateCheck.canProceed) {
      addToast(`Please wait ${formatTimeRemaining(clientRateCheck.timeRemainingMs)} before submitting another message`, 'warning')
      return
    }

    if (!name || !email || (formType === 'text' && !content.trim())) return

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      let mediaUrl: string | undefined

      if ((formType === 'voice' || formType === 'video') && mediaBlob) {
        const uploadedUrl = await uploadMedia(mediaBlob, formType)
        if (uploadedUrl) mediaUrl = uploadedUrl
      }

      const normalizedContent = content.trim()
      const fallbackContent = formType === 'voice' ? 'Voice message' : formType === 'video' ? 'Video message' : ''

      const { data: rpcData, error: rpcError } = await supabase.rpc('submit_guestbook_message_with_rate_limit', {
        p_name: name,
        p_email: email,
        p_content: normalizedContent || fallbackContent,
        p_type: formType,
        p_media_url: mediaUrl,
        p_max_requests: 3,
        p_window_minutes: 1,
      })

      if (!rpcError && rpcData) {
        const result = rpcData as { success: boolean; message_id: string; error_message: string }

        if (!result.success) {
          addToast(result.error_message || 'Rate limit exceeded. Please try again later.', 'warning')
          setIsSubmitting(false)
          return
        }

        setMessages((previous) => [
          { id: result.message_id, name, content: normalizedContent || fallbackContent, type: formType, mediaUrl, reactions: [], comments: [], timestamp: 'Just now' },
          ...previous,
        ])
      } else {
        const { data, error } = await supabase
          .from('guestbook_messages')
          .insert([{ name, email, content: normalizedContent || fallbackContent, type: formType, media_url: mediaUrl, reactions: {} }])
          .select()

        if (error) throw error
        if (data?.[0]) setMessages((previous) => [mapSupabaseMessage(data[0]), ...previous])
      }

      setFilter('all')
      setVisibleCount(INITIAL_VISIBLE_MESSAGES)
      setIsSubmitted(true)

      window.setTimeout(() => {
        setShowForm(false)
        setIsSubmitted(false)
        setName('')
        setEmail('')
        setContent('')
        setMediaBlob(null)
        setFormType('text')
      }, 2200)
    } catch {
      setSubmitError('Failed to submit your note. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredMessages = messages.filter((message) => (filter === 'all' ? true : message.type === filter))
  const visibleMessages = filteredMessages.slice(0, visibleCount)
  const hasMoreMessages = filteredMessages.length > visibleCount
  const totalReactions = messages.reduce((total, message) => total + message.reactions.reduce((sum, reaction) => sum + reaction.count, 0), 0)
  const totalReplies = messages.reduce((total, message) => total + message.comments.length, 0)
  const featuredMessage = messages[0]
  const counts = {
    all: messages.length,
    text: messages.filter((message) => message.type === 'text').length,
    voice: messages.filter((message) => message.type === 'voice').length,
    video: messages.filter((message) => message.type === 'video').length,
  }

  useEffect(() => {
    if (!highlightedMessageId) return

    const highlightedIndex = filteredMessages.findIndex((message) => message.id === highlightedMessageId)
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
    <div className="min-h-screen bg-cream-50 pb-20 pt-28 sm:pt-32">
      <GuestbookSEO />

      <section className="px-4 pb-8">
        <div className="mx-auto max-w-6xl">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} className="editorial-panel overflow-hidden px-6 py-8 sm:px-8 sm:py-10 lg:px-10">
            <div className="absolute -right-16 top-10 h-44 w-44 rounded-full bg-gold-200/30 blur-3xl" />
            <div className="absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-blush-200/35 blur-3xl" />
            <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(16rem,0.85fr)] xl:items-start">
              <div>
                <span className="eyebrow-chip"><BookHeart className="h-3.5 w-3.5" />The guestbook</span>
                <h1 className="mt-6 max-w-3xl text-5xl text-charcoal-900 sm:text-6xl">Leave the part of the day only you can tell back to us.</h1>
                <p className="mt-5 max-w-2xl text-base text-charcoal-600 sm:text-lg">This is the softer side of the archive: a written note from your table, a voice memo on the ride home, or a quick video hello that still sounds like the room felt.</p>
                <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-charcoal-500">
                  <span className="rounded-full border border-white/80 bg-white/76 px-4 py-2">{messages.length} notes collected</span>
                  <span className="rounded-full border border-white/80 bg-white/76 px-4 py-2">{totalReplies} replies tucked in</span>
                  <span className="rounded-full border border-white/80 bg-white/76 px-4 py-2">{totalReactions} reactions shared</span>
                </div>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button size="lg" onClick={() => openComposer('text')}>Leave a note</Button>
                  <Button size="lg" variant="secondary" onClick={() => openComposer('voice')}>Record a message</Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <div className="editorial-card px-5 py-5">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-gold-700">What belongs here</p>
                  <p className="mt-3 text-lg font-semibold text-charcoal-900">The emotional, funny, and in-between parts.</p>
                  <p className="mt-2 text-sm leading-6 text-charcoal-500">The guestbook works best when it sounds like you, not like a polished speech.</p>
                </div>
                <div className="editorial-card px-5 py-5">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-gold-700">Best formats</p>
                  <p className="mt-3 text-lg font-semibold text-charcoal-900">Text for a full thought, voice or video for tone.</p>
                  <p className="mt-2 text-sm leading-6 text-charcoal-500">Choose the format that feels easiest and send it through in one step.</p>
                </div>
                <div className="editorial-card px-5 py-5">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-gold-700">Good to know</p>
                  <p className="mt-3 text-lg font-semibold text-charcoal-900">You can still post even if the feed is loading slowly.</p>
                  <p className="mt-2 text-sm leading-6 text-charcoal-500">Your note goes straight into the archive, and the page refreshes around it.</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="px-4">
        <div className="mx-auto grid max-w-6xl gap-6 xl:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] xl:items-start">
          <div className="grid gap-4 xl:sticky xl:top-28">
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="editorial-card px-5 py-5">
              <p className="text-[10px] uppercase tracking-[0.3em] text-gold-700">Contribute</p>
              <h2 className="mt-4 text-2xl text-charcoal-900">Add your side of the day.</h2>
              <p className="mt-3 text-sm leading-6 text-charcoal-500">Pick the format that feels easiest and open the composer only when you are ready.</p>
              <div className="mt-5 grid gap-2">
                {composerModes.map((mode) => {
                  const Icon = mode.icon
                  const isActive = formType === mode.type
                  return (
                    <button key={mode.type} type="button" onClick={() => { setFormType(mode.type); setMediaBlob(null); openComposer(mode.type) }} className={cn('flex items-start gap-3 rounded-[1.25rem] border px-4 py-3 text-left transition-all', isActive ? 'border-gold-300 bg-gold-50/90' : 'border-white/80 bg-white/74 hover:border-gold-200 hover:bg-white')}>
                      <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border border-white/75 bg-white text-gold-600 shadow-sm"><Icon className="h-4 w-4" /></div>
                      <div>
                        <p className="text-sm font-semibold text-charcoal-900">{mode.label}</p>
                        <p className="mt-1 text-xs leading-5 text-charcoal-500">{mode.description}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
              <Button type="button" size="lg" variant={showForm ? 'secondary' : 'primary'} onClick={() => (showForm ? setShowForm(false) : openComposer(formType))} className="mt-5 w-full" aria-expanded={showForm}>
                {showForm ? <><X className="h-4 w-4" />Close composer</> : <><Send className="h-4 w-4" />Start your message</>}
              </Button>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} data-testid="guestbook-filters" className="editorial-card px-5 py-5">
              <p className="text-[10px] uppercase tracking-[0.3em] text-gold-700">Browse softly</p>
              <p className="mt-3 text-sm leading-6 text-charcoal-500">Use the filters when you want a specific format, or leave everything on and read straight through.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {[{ key: 'all', label: 'Everything' }, { key: 'text', label: 'Text' }, { key: 'voice', label: 'Voice' }, { key: 'video', label: 'Video' }].map((option) => (
                  <button key={option.key} type="button" onClick={() => setFilter(option.key as typeof filter)} className={cn('inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-all', filter === option.key ? 'cinematic-toggle-active' : 'bg-cream-50 text-charcoal-600 hover:bg-gold-50/80 hover:text-charcoal-800')} aria-pressed={filter === option.key}>
                    <span>{option.label}</span>
                    <span className={cn('text-xs', filter === option.key ? 'text-charcoal-700/80' : 'text-charcoal-400')}>{counts[option.key as keyof typeof counts]}</span>
                  </button>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="editorial-card px-5 py-5">
              <p className="text-[10px] uppercase tracking-[0.3em] text-gold-700">Newest note</p>
              {featuredMessage ? (
                <>
                  <p className="mt-3 text-lg font-semibold text-charcoal-900">{featuredMessage.name}</p>
                  <p className="mt-2 text-sm text-charcoal-500">{featuredMessage.timestamp}</p>
                  <p className="mt-4 text-sm leading-6 text-charcoal-600">
                    {getDisplayContent(featuredMessage).slice(0, 120)}
                    {getDisplayContent(featuredMessage).length > 120 ? '…' : ''}
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm leading-6 text-charcoal-500">
                  The first note will appear here once someone adds a memory, blessing, or little story from the day.
                </p>
              )}
            </motion.div>
          </div>

          <div className="space-y-6">
            <AnimatePresence initial={false}>
              {showForm && (
                <motion.div ref={composerRef} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} data-testid="guestbook-composer" className="editorial-panel px-5 py-5 sm:px-6 sm:py-6 lg:px-8">
                  {isSubmitted ? (
                    <div className="text-center">
                      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-green-200/80 bg-green-100/88 shadow-sm"><CheckCircle className="h-10 w-10 text-green-600" /></div>
                      <span className="eyebrow-chip mt-6"><Sparkles className="h-3.5 w-3.5" />Message sent</span>
                      <h2 className="mt-6 text-4xl text-charcoal-900 sm:text-5xl">Your note is part of the book now.</h2>
                      <p className="mx-auto mt-4 max-w-2xl text-base text-charcoal-600 sm:text-lg">Thank you for adding your voice to the day. We just tucked it into the archive.</p>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <span className="eyebrow-chip"><Send className="h-3.5 w-3.5" />Compose a message</span>
                          <h2 className="mt-5 text-3xl text-charcoal-900 sm:text-4xl">Share a note in the format that fits.</h2>
                          <p className="mt-3 max-w-2xl text-sm leading-6 text-charcoal-600 sm:text-base">Written notes are perfect for a full thought. Voice and video work best when tone matters more than polish.</p>
                        </div>
                        <button type="button" onClick={() => setShowForm(false)} className="rounded-full border border-gold-200/70 bg-cream-50/88 p-2 text-charcoal-500 shadow-sm transition-colors hover:border-gold-300/70 hover:text-charcoal-800" aria-label="Close composer"><X className="h-5 w-5" /></button>
                      </div>

                      <div className="mt-6 grid gap-2 md:grid-cols-3">
                        {composerModes.map((mode) => {
                          const Icon = mode.icon
                          const isActive = formType === mode.type
                          return (
                            <button key={mode.type} type="button" onClick={() => { setFormType(mode.type); setMediaBlob(null); setSubmitError(null) }} className={cn('rounded-[1.35rem] border px-4 py-4 text-left transition-all', isActive ? 'border-gold-300 bg-gold-50/90' : 'border-white/78 bg-white/76 hover:border-gold-200 hover:bg-white')} aria-pressed={isActive}>
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/75 bg-white text-gold-600 shadow-sm"><Icon className="h-4 w-4" /></div>
                                <div>
                                  <p className="text-sm font-semibold text-charcoal-900">{mode.label}</p>
                                  <p className="mt-1 text-xs uppercase tracking-[0.22em] text-charcoal-400">Guestbook mode</p>
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>

                      <div className="mt-6 grid gap-5 lg:grid-cols-2">
                        <div>
                          <Label htmlFor="guestbook-name">Your Name</Label>
                          <Input id="guestbook-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" required />
                        </div>
                        <div>
                          <Label htmlFor="guestbook-email">Email</Label>
                          <Input id="guestbook-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="your@email.com" required />
                          <p className="mt-2 text-xs text-charcoal-400">Only used if we ever need to reach you about your submission.</p>
                        </div>
                      </div>

                      <div className="mt-6">
                        {formType === 'text' && (
                          <div>
                            <Label htmlFor="guestbook-message">Your Message</Label>
                            <Textarea id="guestbook-message" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Tell us what you felt, what you remember, or what you hope for us next." rows={6} required />
                          </div>
                        )}
                        {formType === 'voice' && (
                          <div className="space-y-4">
                            <VoiceRecorder onRecordingComplete={setMediaBlob} maxDuration={60} />
                            <div>
                              <Label htmlFor="guestbook-voice-note">Add a Note (Optional)</Label>
                              <Textarea id="guestbook-voice-note" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Add context, a name, or a quick memory to sit alongside the recording." rows={3} />
                            </div>
                          </div>
                        )}
                        {formType === 'video' && (
                          <div className="space-y-4">
                            <VideoRecorder onRecordingComplete={setMediaBlob} maxDuration={30} />
                            <div>
                              <Label htmlFor="guestbook-video-note">Add a Note (Optional)</Label>
                              <Textarea id="guestbook-video-note" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Add context for the clip, or leave this blank and let the video speak for itself." rows={3} />
                            </div>
                          </div>
                        )}
                      </div>

                      {submitError && <div className="mt-5 rounded-[1.35rem] border border-rose-200 bg-rose-50 px-4 py-3"><p className="text-sm text-rose-600">{submitError}</p></div>}

                      <div className="mt-6 flex flex-col gap-4 border-t border-charcoal-900/8 pt-5 xl:flex-row xl:items-center xl:justify-between">
                        <div className="space-y-2 text-sm text-charcoal-500">
                          <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-gold-600" />We only need your name, email, and the message itself.</p>
                          <p className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-gold-600" />Voice and video entries upload exactly the same way they already do today.</p>
                        </div>
                        <Button type="submit" size="lg" disabled={isSubmitting || !name || !email || (formType === 'text' && !content.trim()) || (formType !== 'text' && !mediaBlob)}>
                          {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" />Sending...</> : <><Send className="h-4 w-4" />Post to the guestbook</>}
                        </Button>
                      </div>
                    </form>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {loadError && <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-[1.5rem] border border-amber-200/80 bg-amber-50/90 px-5 py-4 text-sm text-amber-700">{loadError}</motion.div>}

            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} data-testid="guestbook-feed" className="editorial-card px-5 py-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-gold-700">Now showing</p>
                  <h2 className="mt-3 text-3xl text-charcoal-900 sm:text-4xl">{filter === 'all' ? 'Every guestbook entry' : filter === 'text' ? 'Written notes' : filter === 'voice' ? 'Voice messages' : 'Video messages'}</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-charcoal-500 sm:text-base">Read straight through, react to a favorite note, or reply when a memory sparks another one.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-gold-200/70 bg-white/80 px-4 py-2 text-sm text-charcoal-500"><BookHeart className="h-4 w-4 text-gold-500" />{filteredMessages.length} matching entries</div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-gold-200/70 bg-white/80 px-4 py-2 text-sm text-charcoal-500"><MessageCircle className="h-4 w-4 text-gold-500" />{totalReplies} replies total</div>
                </div>
              </div>
            </motion.div>

            {isLoading ? (
              <div className="editorial-panel px-6 py-12 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold-100 text-gold-600"><Loader2 className="h-7 w-7 animate-spin" /></div>
                <p className="mt-6 font-display text-2xl text-charcoal-900">Gathering the guestbook</p>
                <p className="mt-2 text-charcoal-500">Pulling in notes, replies, and recordings from the people we love most.</p>
              </div>
            ) : filteredMessages.length > 0 ? (
              <>
                <div className="grid gap-5 xl:grid-cols-2">
                  {visibleMessages.map((message) => (
                    <MessageCard
                      key={message.id}
                      message={message}
                      isHighlighted={highlightedMessageId === message.id}
                      onReact={handleReact}
                      onReply={handleReply}
                    />
                  ))}
                </div>
                {hasMoreMessages && <div className="flex justify-center pt-2"><Button variant="secondary" size="lg" onClick={() => setVisibleCount((current) => current + INITIAL_VISIBLE_MESSAGES)}>Load more messages</Button></div>}
              </>
            ) : messages.length > 0 ? (
              <div className="editorial-panel px-6 py-12 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold-100 text-gold-600"><BookHeart className="h-7 w-7" /></div>
                <p className="mt-6 font-display text-2xl text-charcoal-900">Nothing matches this filter just yet.</p>
                <p className="mx-auto mt-2 max-w-md text-charcoal-500">Try switching formats or opening everything again to read straight through the guestbook.</p>
                <Button className="mt-6" size="lg" variant="secondary" onClick={() => setFilter('all')}>Show everything</Button>
              </div>
            ) : (
              <div className="editorial-panel px-6 py-12 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold-100 text-gold-600"><BookHeart className="h-7 w-7" /></div>
                <p className="mt-6 font-display text-2xl text-charcoal-900">The guestbook is ready for its first real note.</p>
                <p className="mx-auto mt-2 max-w-md text-charcoal-500">There are no demo messages here now. Start the page off with a written note, a voice memo, or a quick video hello.</p>
                <Button className="mt-6" size="lg" onClick={() => openComposer('text')}>Leave the first message</Button>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

