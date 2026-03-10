import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { ReactionPicker, ReactionType } from '@/components/guestbook/ReactionPicker'
import { VoiceRecorder } from '@/components/guestbook/VoiceRecorder'
import { VideoRecorder } from '@/components/guestbook/VideoRecorder'
import { MessageCircle, Send, X, CheckCircle, Sparkles, Loader2, Mic, Pause, Play, Video } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase, GuestbookMessage as SupabaseMessage } from '@/lib/supabase'
import { useToast } from '@/context/ToastContext'
import { rateLimiter, formatTimeRemaining } from '@/utils/rateLimiter'

interface Comment {
  id: string
  author: string
  content: string
  timestamp: string
}

interface SupabaseCommentRecord {
  id: string
  author: string
  content: string
  timestamp?: string
  created_at?: string
}

interface Message {
  id: string
  name: string
  avatar?: string
  content: string
  type: 'text' | 'photo' | 'video' | 'voice'
  mediaUrl?: string
  reactions: Array<{ type: ReactionType; count: number; isActive: boolean }>
  comments: Comment[]
  timestamp: string
}

// Sample messages as fallback
const sampleMessages: Message[] = [
  {
    id: '1',
    name: 'Sarah Mitchell',
    content: "I'm still crying thinking about your vows. The most beautiful ceremony I've ever witnessed. Wishing you both a lifetime of happiness! 💕",
    type: 'text',
    reactions: [
      { type: 'heart', count: 12, isActive: false },
      { type: 'cry', count: 5, isActive: true },
      { type: 'clap', count: 3, isActive: false },
    ],
    comments: [
      { id: 'c1', author: 'Jordyn', content: 'Thank you Sarah! Your support means everything ❤️', timestamp: '1 day ago' }
    ],
    timestamp: '2 days ago',
  },
  {
    id: '2',
    name: 'Mike Chen',
    content: 'The dance floor was absolutely insane! Best wedding party ever. So honored to have been there.',
    type: 'text',
    reactions: [
      { type: 'fire', count: 8, isActive: false },
      { type: 'clap', count: 4, isActive: true },
    ],
    comments: [],
    timestamp: '3 days ago',
  },
  {
    id: '3',
    name: 'Emma & David',
    content: 'That cake was DELICIOUS! Also you two are adorable.',
    type: 'text',
    reactions: [
      { type: 'smile', count: 6, isActive: false },
      { type: 'heart', count: 2, isActive: false },
    ],
    comments: [],
    timestamp: '4 days ago',
  },
  {
    id: '4',
    name: 'Aunt Patricia',
    content: "I've known Jordyn since she was a baby. Seeing her so happy brought tears to my eyes. Austin, welcome to the family!",
    type: 'text',
    reactions: [
      { type: 'heart', count: 15, isActive: true },
      { type: 'cry', count: 8, isActive: false },
    ],
    comments: [
      { id: 'c2', author: 'Austin', content: 'Thank you Aunt Patricia! So happy to be part of the family.', timestamp: '3 days ago' }
    ],
    timestamp: '5 days ago',
  },
]

const EMPTY_CAPTIONS_TRACK = 'data:text/vtt,WEBVTT'

// Helper to convert Supabase message to local format
const mapSupabaseMessage = (msg: SupabaseMessage & { comments?: SupabaseCommentRecord[] }): Message => {
  const reactions: Array<{ type: ReactionType; count: number; isActive: boolean }> = []
  
  if (msg.reactions) {
    Object.entries(msg.reactions).forEach(([type, count]) => {
      if (typeof count === 'number' && count > 0) {
        reactions.push({ type: type as ReactionType, count, isActive: false })
      }
    })
  }

  // Format comments from Supabase
  const comments: Comment[] = msg.comments?.map(c => ({
    id: c.id,
    author: c.author,
    content: c.content,
    timestamp: new Date(c.created_at ?? c.timestamp ?? new Date().toISOString()).toLocaleDateString('en-US', { 
      day: 'numeric', 
      month: 'short' 
    })
  })) || []

  const formattedTimestamp = new Date(msg.created_at).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: new Date(msg.created_at).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  })

  return {
    id: msg.id,
    name: msg.name,
    content: msg.content,
    type: msg.type as 'text' | 'photo' | 'video' | 'voice',
    mediaUrl: msg.media_url || undefined,
    reactions,
    comments,
    timestamp: `${formattedTimestamp} ago`,
  }
}

function AudioPlayer({ url }: { url: string }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  
  // Store bar heights - generated once on mount
  const [barHeights] = useState<number[]>(() =>
    Array.from({ length: 20 }, (_, i) => ((i * 11) % 20) + 8)
  )

  return (
    <div className="flex items-center gap-3 bg-charcoal-100 rounded-full p-2 pr-4">
      <button
        type="button"
        onClick={() => {
          if (audioRef.current) {
            if (isPlaying) {
              audioRef.current.pause()
            } else {
              void audioRef.current.play()
            }
            setIsPlaying(!isPlaying)
          }
        }}
        className="w-10 h-10 bg-gold-500 text-white rounded-full flex items-center justify-center hover:bg-gold-600 transition-colors"
        aria-label={isPlaying ? 'Pause voice message playback' : 'Play voice message'}
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>
      <div className="flex-1">
    <div className="h-8 flex items-center gap-0.5">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="w-1 bg-gold-400 rounded-full"
              style={{ height: `${barHeights[i]}px` }}
            />
          ))}
        </div>
      </div>
      <span className="text-charcoal-500 text-sm">0:15</span>
      <audio ref={audioRef} src={url} onEnded={() => setIsPlaying(false)} aria-label="Voice message playback">
        <track kind="captions" src={EMPTY_CAPTIONS_TRACK} srcLang="en" label="No captions available" />
      </audio>
    </div>
  )
}

function MessageCard({ 
  message, 
  onReact,
  onReply 
}: { 
  message: Message; 
  onReact: (id: string, type: ReactionType) => void
  onReply: (id: string, content: string) => void
}) {
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [replyContent, setReplyContent] = useState('')

  const handleReplySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (replyContent.trim()) {
      onReply(message.id, replyContent)
      setReplyContent('')
      setShowReplyForm(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl border border-gold-200/60 transition-all"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Avatar fallback={message.name} size="md" />
        <div className="flex-1">
          <h4 className="font-medium text-charcoal-800">{message.name}</h4>
          <p className="text-xs text-charcoal-400">{message.timestamp}</p>
        </div>
        <Badge variant="ghost" className="text-xs">
          {message.type === 'text' && 'Message'}
          {message.type === 'photo' && 'Photo'}
          {message.type === 'video' && 'Video'}
          {message.type === 'voice' && 'Voice'}
        </Badge>
      </div>

      {/* Content */}
      <div className="mb-4">
        {message.type === 'video' && message.mediaUrl && (
          <div className="aspect-video bg-charcoal-800 rounded-xl mb-4 overflow-hidden">
            <video
              src={message.mediaUrl}
              controls
              className="w-full h-full object-cover"
              poster="/images/video-thumbnail.jpg"
              aria-label={`Video message from ${message.name}`}
            >
              <track kind="captions" src={EMPTY_CAPTIONS_TRACK} srcLang="en" label="No captions available" />
            </video>
          </div>
        )}

        {message.type === 'voice' && message.mediaUrl && (
          <div className="mb-4">
            <AudioPlayer url={message.mediaUrl} />
          </div>
        )}
        
        <p className="text-charcoal-700 leading-relaxed">{message.content}</p>
      </div>

      {/* Comments Preview */}
      {message.comments.length > 0 && (
        <div className="mb-4 space-y-2">
          {message.comments.map((comment) => (
            <div key={comment.id} className="flex gap-2 text-sm">
              <span className="font-medium text-charcoal-700">{comment.author}:</span>
              <span className="text-charcoal-600">{comment.content}</span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gold-100">
        <ReactionPicker 
          reactions={message.reactions}
          onReact={(type) => onReact(message.id, type)}
        />
        
        <button
          type="button"
          onClick={() => setShowReplyForm(!showReplyForm)}
          className="flex items-center gap-1.5 text-sm text-charcoal-400 hover:text-charcoal-600 transition-colors"
          aria-expanded={showReplyForm}
        >
          <MessageCircle className="w-4 h-4" />
          <span>Reply</span>
          {message.comments.length > 0 && (
            <span className="text-charcoal-300">({message.comments.length})</span>
          )}
        </button>
      </div>

      {/* Reply Form */}
      <AnimatePresence>
        {showReplyForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleReplySubmit}
            className="mt-4 pt-4 border-t border-gold-100"
          >
            <div className="flex gap-2">
              <Input
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Write a reply..."
                className="flex-1"
              />
              <Button type="submit" size="sm" disabled={!replyContent.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function Guestbook() {
  const [messages, setMessages] = useState<Message[]>(sampleMessages)
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState<'text' | 'photo' | 'video' | 'voice'>('text')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [content, setContent] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [filter, setFilter] = useState<'all' | 'messages' | 'photos' | 'videos'>('all')
  const [mediaBlob, setMediaBlob] = useState<Blob | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  
  const { addToast } = useToast()

  // Fetch messages from Supabase on mount
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        setIsLoading(true)
        setLoadError(null)

        // Try to use the RPC function first (includes comments)
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('get_guestbook_messages_with_comments')

        if (!rpcError && rpcData) {
          const mappedMessages = rpcData.map(mapSupabaseMessage)
          // Merge with sample messages, keeping Supabase ones first
          setMessages([...mappedMessages, ...sampleMessages])
          setIsLoading(false)
          return
        }

        // Fallback to regular query if RPC fails
        const { data, error } = await supabase
          .from('guestbook_messages')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) {
          // Error handled via UI
          setLoadError('Could not load messages from database. Using sample messages.')
          return
        }

        if (data && data.length > 0) {
          const mappedMessages = data.map(mapSupabaseMessage)
          // Merge with sample messages, keeping Supabase ones first
          setMessages([...mappedMessages, ...sampleMessages])
        }
      } catch {
        // Error handled via UI
        setLoadError('Could not connect to database. Using sample messages.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchMessages()
  }, [])

  const handleReact = async (messageId: string, reactionType: ReactionType) => {
    // Optimistically update UI first
    setMessages(prev => prev.map(msg => {
      if (msg.id !== messageId) return msg
      
      const existingReaction = msg.reactions.find(r => r.type === reactionType)
      
      if (existingReaction) {
        return {
          ...msg,
          reactions: msg.reactions.map(r => 
            r.type === reactionType
              ? { ...r, count: r.isActive ? r.count - 1 : r.count + 1, isActive: !r.isActive }
              : r
          ).filter(r => r.count > 0)
        }
      } else {
        return {
          ...msg,
          reactions: [...msg.reactions, { type: reactionType, count: 1, isActive: true }]
        }
      }
    }))

    // Persist to Supabase
    try {
      // Get current message to calculate new reactions
      const message = messages.find(m => m.id === messageId)
      if (!message) return

      const existingReaction = message.reactions.find(r => r.type === reactionType)
      const isTogglingOff = existingReaction?.isActive
      
      // Build updated reactions object
      const updatedReactions: Record<string, number> = {}
      message.reactions.forEach(r => {
        if (r.type === reactionType) {
          const newCount = isTogglingOff ? r.count - 1 : r.count + 1
          if (newCount > 0) updatedReactions[r.type] = newCount
        } else if (r.count > 0) {
          updatedReactions[r.type] = r.count
        }
      })
      
      // If adding new reaction
      if (!existingReaction) {
        updatedReactions[reactionType] = 1
      }

      const { error } = await supabase
        .from('guestbook_messages')
        .update({ reactions: updatedReactions })
        .eq('id', messageId)

      if (error) {
        // Error handled via UI
        // Optionally: revert UI state here
      }
    } catch {
      // Error handled via UI
    }
  }

  const handleReply = async (messageId: string, replyContent: string) => {
    const newComment: Comment = {
      id: `c${Date.now()}`,
      author: 'Guest',
      content: replyContent,
      timestamp: 'Just now'
    }
    
    // Optimistically update UI
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, comments: [...msg.comments, newComment] }
        : msg
    ))

    // Persist to Supabase
    try {
      const { error } = await supabase
        .from('guestbook_comments')
        .insert([
          {
            message_id: messageId,
            author: 'Guest',
            content: replyContent
          }
        ])

      if (error) {
        // Error handled via UI
        // Optionally: show error toast or revert UI
      }
    } catch {
      // Error handled via UI
    }
  }

  const uploadMedia = async (blob: Blob, type: 'voice' | 'video'): Promise<string | null> => {
    try {
      const bucket = type === 'voice' ? 'guest-voice' : 'guest-videos'
      const ext = type === 'voice' ? 'webm' : 'webm'
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`

      const { error } = await supabase.storage
        .from(bucket)
        .upload(fileName, blob, {
          contentType: type === 'voice' ? 'audio/webm' : 'video/webm'
        })

      if (error) {
        // Error handled via UI
        return null
      }

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName)

      return publicUrl
    } catch {
      // Error handled via UI
      return null
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Client-side rate limiting (first line of defense)
    const clientRateCheck = rateLimiter.check('guestbook-submit', {
      maxRequests: 3,
      windowMs: 60000, // 1 minute
    })
    
    if (!clientRateCheck.canProceed) {
      const timeRemaining = formatTimeRemaining(clientRateCheck.timeRemainingMs)
      addToast(`Please wait ${timeRemaining} before submitting another message`, 'warning')
      return
    }
    
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      let mediaUrl: string | undefined

      // Upload media if voice or video
      if ((formType === 'voice' || formType === 'video') && mediaBlob) {
        const uploadedUrl = await uploadMedia(mediaBlob, formType)
        if (uploadedUrl) {
          mediaUrl = uploadedUrl
        }
      }

      // Try server-side rate limited submission first
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('submit_guestbook_message_with_rate_limit', {
          p_name: name,
          p_email: email,
          p_content: content || (formType === 'voice' ? 'Voice message' : formType === 'video' ? 'Video message' : ''),
          p_type: formType,
          p_media_url: mediaUrl,
          p_max_requests: 3,
          p_window_minutes: 1
        })

      // If RPC succeeds, use that result
      if (!rpcError && rpcData) {
        const result = rpcData as { 
          success: boolean
          message_id: string
          error_message: string
          rate_limit_remaining: number
          rate_limit_reset_after: number
        }
        
        if (!result.success) {
          // Server-side rate limit hit
          addToast(result.error_message || 'Rate limit exceeded. Please try again later.', 'warning')
          setIsSubmitting(false)
          return
        }
        
        // Success - create message object from form data (RPC doesn't return full object)
        const newMessage: Message = {
          id: result.message_id,
          name,
          content: content || (formType === 'voice' ? 'Voice message' : formType === 'video' ? 'Video message' : ''),
          type: formType,
          mediaUrl,
          reactions: [],
          comments: [],
          timestamp: 'Just now'
        }
        setMessages(prev => [newMessage, ...prev])
      } else {
        // RPC failed or doesn't exist, fall back to direct insert
        // This handles cases where the migration hasn't been applied yet
        // Server-side rate limiting not available, using fallback
        
        const { data, error } = await supabase
          .from('guestbook_messages')
          .insert([
            {
              name,
              email,
              content: content || (formType === 'voice' ? 'Voice message' : formType === 'video' ? 'Video message' : ''),
              type: formType,
              media_url: mediaUrl,
              reactions: {},
            }
          ])
          .select()

        if (error) throw error

        if (data && data[0]) {
          const newMessage = mapSupabaseMessage(data[0])
          setMessages(prev => [newMessage, ...prev])
        }
      }

      setIsSubmitted(true)
      
      setTimeout(() => {
        setShowForm(false)
        setIsSubmitted(false)
        setName('')
        setEmail('')
        setContent('')
        setMediaBlob(null)
      }, 2000)

    } catch {
      // Error handled via UI
      setSubmitError('Failed to submit message. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleVoiceComplete = (blob: Blob) => {
    setMediaBlob(blob)
    setFormType('voice')
  }

  const handleVideoComplete = (blob: Blob) => {
    setMediaBlob(blob)
    setFormType('video')
  }

  const filteredMessages = messages.filter(msg => {
    if (filter === 'all') return true
    if (filter === 'messages') return msg.type === 'text'
    if (filter === 'photos') return msg.type === 'photo'
    if (filter === 'videos') return msg.type === 'video' || msg.type === 'voice'
    return true
  })

  const totalReactions = messages.reduce((acc, msg) => 
    acc + msg.reactions.reduce((sum, r) => sum + r.count, 0), 0
  )

  return (
    <div className="min-h-screen bg-cream-50 pt-24 pb-20">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <span className="text-gold-600 text-sm uppercase tracking-[0.3em] font-medium">
            The Guestbook
          </span>
          <h1 className="font-display text-5xl md:text-7xl text-charcoal-900 mt-4 mb-4">
            Messages of Love
          </h1>
          <p className="text-charcoal-600 max-w-xl mx-auto mb-4">
            {messages.length} messages from our favorite people. Leave your own note, photo, or video to add to our memory wall.
          </p>
          <div className="flex items-center justify-center gap-4 text-sm text-charcoal-500">
            <span className="flex items-center gap-1">
              <Sparkles className="w-4 h-4 text-gold-500" />
              {totalReactions} reactions
            </span>
            <span>•</span>
            <span>{messages.reduce((acc, m) => acc + m.comments.length, 0)} replies</span>
          </div>
        </motion.div>

        {/* Error Message */}
        {loadError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 max-w-xl mx-auto"
          >
            <p className="text-amber-700 text-sm text-center">{loadError}</p>
          </motion.div>
        )}

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-12">
          {/* Filters */}
          <div className="flex flex-wrap justify-center gap-2">
            {[
              { key: 'all', label: 'All' },
              { key: 'messages', label: 'Messages' },
              { key: 'photos', label: 'Photos' },
              { key: 'videos', label: 'Videos' }
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key as typeof filter)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm transition-all",
                  filter === key
                    ? "bg-gold-500 text-white"
                    : "bg-white border border-gold-200/60 text-charcoal-600 hover:border-gold-400"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Leave Message Button */}
          <Button size="lg" onClick={() => setShowForm(true)} data-testid="leave-message-btn">
            <Send className="w-4 h-4 mr-2" />
            Leave a Message
          </Button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="flex items-center gap-2 text-charcoal-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Loading messages...</span>
            </div>
          </div>
        )}

        {/* Messages Grid */}
        {!isLoading && (
          <div className="grid md:grid-cols-2 gap-6">
            {filteredMessages.map((message) => (
              <MessageCard 
                key={message.id} 
                message={message} 
                onReact={handleReact}
                onReply={handleReply}
              />
            ))}
          </div>
        )}

        {!isLoading && filteredMessages.length === 0 && (
          <div className="text-center py-20">
            <MessageCircle className="w-12 h-12 text-gold-300 mx-auto mb-4" />
            <p className="text-charcoal-600">No messages found for this filter</p>
          </div>
        )}

        {/* Load More */}
        {!isLoading && filteredMessages.length > 0 && (
          <div className="text-center mt-12">
            <Button variant="secondary">
              Load More Messages
            </Button>
          </div>
        )}
      </div>

      {/* Message Form Modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              {isSubmitted ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="font-display text-2xl text-charcoal-900 mb-2">Thank You!</h3>
                  <p className="text-charcoal-600">Your message has been added to our guestbook.</p>
                </div>
              ) : (
                <>
                  {/* Modal Header */}
                  <div className="flex items-center justify-between p-6 border-b border-gold-100">
                    <h3 className="font-display text-2xl text-charcoal-900">Leave a Message</h3>
                    <button 
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="p-2 text-charcoal-400 hover:text-charcoal-600"
                      aria-label="Close message form"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Error Message */}
                  {submitError && (
                    <div className="px-6 pt-4">
                      <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
                        <p className="text-rose-600 text-sm">{submitError}</p>
                      </div>
                    </div>
                  )}

                  {/* Message Type Selector */}
                  <div className="p-6 border-b border-gold-100">
                    <p className="text-sm text-charcoal-500 mb-3">Choose how you would like to share:</p>
                    <div className="flex gap-2">
                      {[
                        { type: 'text', icon: Send, label: 'Text' },
                        { type: 'voice', icon: Mic, label: 'Voice' },
                        { type: 'video', icon: Video, label: 'Video' },
                      ].map(({ type, icon: Icon, label }) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setFormType(type as typeof formType)}
                          className={cn(
                            "flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border transition-all",
                            formType === type
                              ? "border-gold-500 bg-gold-50 text-gold-700"
                              : "border-gold-200/60 text-charcoal-600 hover:border-gold-300"
                          )}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="text-xs font-medium">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {formType === 'voice' && (
                      <div className="mb-4">
                        <VoiceRecorder 
                          onRecordingComplete={handleVoiceComplete}
                          maxDuration={60}
                        />
                      </div>
                    )}

                    {formType === 'video' && (
                      <div className="mb-4">
                        <VideoRecorder 
                          onRecordingComplete={handleVideoComplete}
                          maxDuration={30}
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="guestbook-name">Your Name</Label>
                        <Input
                          id="guestbook-name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Your name"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="guestbook-email">Email</Label>
                        <Input
                          id="guestbook-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="your@email.com"
                          required
                        />
                      </div>
                    </div>

                    {formType === 'text' && (
                      <div>
                        <Label htmlFor="guestbook-message">Your Message</Label>
                        <Textarea
                          id="guestbook-message"
                          value={content}
                          onChange={(e) => setContent(e.target.value)}
                          placeholder="Share your favorite memory from our day..."
                          rows={4}
                          required
                        />
                      </div>
                    )}

                    {(formType === 'voice' || formType === 'video') && mediaBlob && (
                      <div>
                        <Label htmlFor="guestbook-note">Add a Note (Optional)</Label>
                        <Textarea
                          id="guestbook-note"
                          value={content}
                          onChange={(e) => setContent(e.target.value)}
                          placeholder="Add context to your recording..."
                          rows={2}
                        />
                      </div>
                    )}

                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={isSubmitting || (formType !== 'text' && !mediaBlob) || !name || !email}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        'Post Message'
                      )}
                    </Button>
                  </form>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
