/**
 * Guestbook data boundary (Wave 6 W6-1).
 *
 * Deterministic stub hooks + fixtures so the page renders/tests parity before
 * the typed data layer is wired.
 *
 * TODO(Wave3): the Lead swaps this module for the real `shared/data/guestbook.ts`
 * exports. The injected `GuestbookApi` interface is a 1:1 mirror of:
 *   loadMessages   -> fetchGuestbookMessages()
 *   submitMessage  -> submitGuestbookMessage(input)         (RPC + documented fallback)
 *   setReactions   -> updateGuestbookReactions(messageId, reactions)
 *   addReply       -> addGuestbookReply({ messageId, author, content })
 * so wiring is mechanical; no component changes are needed.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { COMPOSER_LIMITS, CLIENT_RATE_LIMIT, GUESTBOOK_COPY } from './constants'
import { createRateLimiter, formatTimeRemaining, type RateLimiter } from './rateLimit'
import {
  getOrCreateReactionFingerprint,
  hasReacted,
  markReacted,
  unmarkReacted,
} from './reactionFingerprint'
import type {
  ComposerErrors,
  GuestbookApi,
  GuestbookComment,
  GuestbookMessage,
  GuestbookStorage,
} from './types'

/** Contract clock used by every deterministic fixture (contracts/ui.json fixedNow). */
export const GUESTBOOK_FIXED_NOW = '2026-11-08T17:00:00.000Z'

/* -------------------------------------------------------------------------- */
/* Fixtures (match contracts/content/rendered/guestbook.json + fixtures)      */
/* -------------------------------------------------------------------------- */

export const GUESTBOOK_FIXTURE: GuestbookMessage[] = [
  {
    id: 'message-1',
    name: 'Sarah Mitchell',
    content:
      'Your vows made the whole room disappear for a second. It felt like all of us were holding our breath with you.',
    createdAt: '2025-05-12T15:00:00.000Z',
    mediaUrl: null,
    reactions: { love: 12, clap: 4 },
    comments: [
      {
        id: 'comment-1',
        author: 'Austin',
        content: 'This is exactly how it felt. Thank you for being there.',
        createdAt: '2025-05-12T18:00:00.000Z',
      },
    ],
  },
  {
    id: 'message-2',
    name: 'Mike Chen',
    content: 'The dance floor was wild in the best way possible.',
    createdAt: '2025-05-13T16:00:00.000Z',
    mediaUrl: null,
    reactions: { fire: 8 },
    comments: [],
  },
  {
    id: 'message-3',
    name: 'Aunt Patricia',
    content: 'We sent a quick video hello from our table right after the toasts.',
    createdAt: '2025-05-14T14:00:00.000Z',
    mediaUrl: null,
    reactions: { love: 9 },
    comments: [],
  },
]

/* -------------------------------------------------------------------------- */
/* Stub API (deterministic; TODO(Wave3): replace with shared/data/guestbook)  */
/* -------------------------------------------------------------------------- */

export function createStubGuestbookApi(): GuestbookApi {
  let submittedCount = 0
  let replyCount = 0
  return {
    loadMessages: () =>
      Promise.resolve(
        GUESTBOOK_FIXTURE.map(message => ({
          ...message,
          reactions: { ...message.reactions },
          comments: message.comments.map(comment => ({ ...comment })),
        }))
      ),
    submitMessage: () => {
      submittedCount += 1
      return Promise.resolve({
        status: 'submitted',
        messageId: `stub-message-${submittedCount}`,
        rateLimitRemaining: null,
        viaFallback: false,
      })
    },
    setReactions: () => Promise.resolve(),
    addReply: ({ author, content }) => {
      replyCount += 1
      return Promise.resolve({
        id: `stub-reply-${replyCount}`,
        author,
        content,
        createdAt: GUESTBOOK_FIXED_NOW,
      })
    },
  }
}

/* -------------------------------------------------------------------------- */
/* useGuestbookFeed — load notes (frozen useGuestbookMessages)                */
/* -------------------------------------------------------------------------- */

export interface UseGuestbookFeedOptions {
  api?: GuestbookApi
}

export interface UseGuestbookFeedResult {
  messages: GuestbookMessage[]
  isLoading: boolean
  loadError: string | null
  prependMessage: (message: GuestbookMessage) => void
}

export function useGuestbookFeed({ api }: UseGuestbookFeedOptions = {}): UseGuestbookFeedResult {
  const client = useMemo(() => api ?? createStubGuestbookApi(), [api])
  const [messages, setMessages] = useState<GuestbookMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    client.loadMessages().then(
      loaded => {
        if (cancelled) return
        setMessages(loaded)
        setLoadError(null)
        setIsLoading(false)
      },
      () => {
        if (cancelled) return
        setMessages([])
        setLoadError(GUESTBOOK_COPY.loadError)
        setIsLoading(false)
      }
    )
    return () => {
      cancelled = true
    }
  }, [client])

  const prependMessage = useCallback((message: GuestbookMessage) => {
    setMessages(previous => [message, ...previous])
  }, [])

  return { messages, isLoading, loadError, prependMessage }
}

/* -------------------------------------------------------------------------- */
/* useGuestbookComposer — honeypot, limiter, RPC+fallback, optimistic prepend */
/* -------------------------------------------------------------------------- */

export interface UseGuestbookComposerOptions {
  api: GuestbookApi
  prependMessage: (message: GuestbookMessage) => void
  resetVisibleCount: () => void
  limiter?: RateLimiter
  /** Injectable clock (tests pin it; no fake timers needed). */
  now?: () => number
  /** Injectable scheduler for the frozen 2200 ms form-reset timing. */
  schedule?: (callback: () => void, delayMs: number) => unknown
}

export interface UseGuestbookComposerResult {
  showForm: boolean
  setShowForm: (show: boolean) => void
  name: string
  email: string
  content: string
  website: string
  isSubmitted: boolean
  isSubmitting: boolean
  submitError: string | null
  errors: ComposerErrors
  statusMessage: string | null
  /** True when the last accepted submit used the documented fallback path (R17). */
  lastSubmitViaFallback: boolean
  openComposer: () => void
  handleSubmit: (event: { preventDefault: () => void }) => Promise<void>
  setName: (value: string) => void
  setEmail: (value: string) => void
  setContent: (value: string) => void
  setWebsite: (value: string) => void
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateComposerFields(fields: {
  name: string
  email: string
  content: string
}): ComposerErrors {
  const errors: ComposerErrors = {}
  const name = fields.name.trim()
  if (name.length < COMPOSER_LIMITS.nameMin || name.length > COMPOSER_LIMITS.nameMax) {
    errors.name = `Your name needs to be between ${COMPOSER_LIMITS.nameMin} and ${COMPOSER_LIMITS.nameMax} characters.`
  }
  const content = fields.content.trim()
  if (content.length < COMPOSER_LIMITS.contentMin) {
    errors.content = `Your message needs to be at least ${COMPOSER_LIMITS.contentMin} characters.`
  } else if (content.length > COMPOSER_LIMITS.contentMax) {
    errors.content = `Your message needs to be ${COMPOSER_LIMITS.contentMax} characters or fewer.`
  }
  const email = fields.email.trim()
  if (email && !EMAIL_PATTERN.test(email)) {
    errors.email = 'Enter a valid email address.'
  }
  return errors
}

export function useGuestbookComposer({
  api,
  prependMessage,
  resetVisibleCount,
  limiter,
  now = Date.now,
  schedule = (callback, delayMs) => {
    if (typeof window === 'undefined') return undefined
    return window.setTimeout(callback, delayMs)
  },
}: UseGuestbookComposerOptions): UseGuestbookComposerResult {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [content, setContent] = useState('')
  const [website, setWebsite] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [errors, setErrors] = useState<ComposerErrors>({})
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [lastSubmitViaFallback, setLastSubmitViaFallback] = useState(false)
  const [rateLimiter] = useState<RateLimiter>(() => limiter ?? createRateLimiter(CLIENT_RATE_LIMIT))

  const resetForm = useCallback(() => {
    setShowForm(false)
    setIsSubmitted(false)
    setName('')
    setEmail('')
    setContent('')
    setWebsite('')
  }, [])

  const openComposer = useCallback(() => {
    setShowForm(true)
    setSubmitError(null)
    setStatusMessage(null)
    setIsSubmitted(false)
  }, [])

  const handleSubmit = useCallback(
    async (event: { preventDefault: () => void }) => {
      event.preventDefault()

      // Honeypot: a filled hidden field means a bot. Silently "succeed" without
      // touching the API (frozen behavior), so scrapers cannot learn the signal.
      if (website) {
        setIsSubmitting(true)
        schedule(() => {
          setIsSubmitting(false)
          setIsSubmitted(true)
          schedule(resetForm, 2200)
        }, 500)
        return
      }

      const validationErrors = validateComposerFields({ name, email, content })
      setErrors(validationErrors)
      if (Object.keys(validationErrors).length > 0) return

      const rateCheck = rateLimiter.check()
      if (!rateCheck.canProceed) {
        setStatusMessage(
          `Give it a moment — you can leave another note in ${formatTimeRemaining(rateCheck.timeRemainingMs)}`
        )
        return
      }

      setIsSubmitting(true)
      setSubmitError(null)
      setStatusMessage(null)

      try {
        const result = await api.submitMessage({
          name: name.trim(),
          email: email.trim(),
          content: content.trim(),
        })

        if (result.status === 'submitted') {
          prependMessage({
            id: result.messageId,
            name: name.trim(),
            content: content.trim(),
            createdAt: new Date(now()).toISOString(),
            mediaUrl: null,
            reactions: {},
            comments: [],
          })
          setLastSubmitViaFallback(result.viaFallback)
          setIsSubmitted(true)
          setStatusMessage(GUESTBOOK_COPY.submitSuccess)
          resetVisibleCount()
          schedule(resetForm, 2200)
        } else if (result.status === 'rate-limited') {
          setStatusMessage(result.message || GUESTBOOK_COPY.submitRateLimited)
        } else {
          setSubmitError(result.error.message || GUESTBOOK_COPY.submitError)
        }
      } catch {
        setSubmitError(GUESTBOOK_COPY.submitError)
      } finally {
        setIsSubmitting(false)
      }
    },
    [
      api,
      content,
      email,
      name,
      prependMessage,
      rateLimiter,
      resetForm,
      resetVisibleCount,
      now,
      schedule,
      website,
    ]
  )

  return {
    showForm,
    setShowForm,
    name,
    email,
    content,
    website,
    isSubmitted,
    isSubmitting,
    submitError,
    errors,
    statusMessage,
    lastSubmitViaFallback,
    openComposer,
    handleSubmit,
    setName,
    setEmail,
    setContent,
    setWebsite,
  }
}

/* -------------------------------------------------------------------------- */
/* useGuestbookReactions — 4 types, fingerprint dedupe, optimistic rollback    */
/* -------------------------------------------------------------------------- */

export interface UseGuestbookReactionsOptions {
  messages: GuestbookMessage[]
  api: GuestbookApi
  storage?: GuestbookStorage
  createFingerprint?: () => string
}

export interface UseGuestbookReactionsResult {
  fingerprint: string
  localReactions: Record<string, Record<string, number>>
  reactionPickerForId: string | null
  setReactionPickerForId: (id: string | null) => void
  hasOwnReaction: (messageId: string, reactionKey: string) => boolean
  hasAnyOwnReaction: (messageId: string) => boolean
  handleAddReaction: (messageId: string, reactionKey: string) => Promise<void>
}

export function useGuestbookReactions({
  messages,
  api,
  storage,
  createFingerprint,
}: UseGuestbookReactionsOptions): UseGuestbookReactionsResult {
  const [fingerprint] = useState(() => getOrCreateReactionFingerprint(storage, createFingerprint))
  const [localReactions, setLocalReactions] = useState<Record<string, Record<string, number>>>({})
  const [reactionPickerForId, setReactionPickerForId] = useState<string | null>(null)

  const hasOwnReaction = useCallback(
    (messageId: string, reactionKey: string) =>
      hasReacted(messageId, reactionKey, fingerprint, storage),
    [fingerprint, storage]
  )

  const hasAnyOwnReaction = useCallback(
    (messageId: string) => {
      const message = messages.find(candidate => candidate.id === messageId)
      const keys = new Set([
        ...Object.keys(message?.reactions ?? {}),
        ...Object.keys(localReactions[messageId] ?? {}),
        'love',
        'clap',
        'laugh',
        'wow',
      ])
      return [...keys].some(key => hasReacted(messageId, key, fingerprint, storage))
    },
    [fingerprint, localReactions, messages, storage]
  )

  const handleAddReaction = useCallback(
    async (messageId: string, reactionKey: string) => {
      setReactionPickerForId(null)
      const message = messages.find(candidate => candidate.id === messageId)
      if (!message) return

      const currentReactions = localReactions[messageId] ?? { ...message.reactions }
      const previouslyReacted = hasReacted(messageId, reactionKey, fingerprint, storage)
      const previousReactions = { ...currentReactions }
      const nextReactions = {
        ...currentReactions,
        [reactionKey]: Math.max(
          0,
          (currentReactions[reactionKey] ?? 0) - (previouslyReacted ? 1 : -1)
        ),
      }

      // Optimistic update + dedupe marker.
      setLocalReactions(previous => ({ ...previous, [messageId]: nextReactions }))
      if (previouslyReacted) {
        unmarkReacted(messageId, reactionKey, fingerprint, storage)
      } else {
        markReacted(messageId, reactionKey, fingerprint, storage)
      }

      try {
        await api.setReactions(messageId, nextReactions)
      } catch {
        // Rollback optimistic count and the fingerprint marker.
        setLocalReactions(previous => ({ ...previous, [messageId]: previousReactions }))
        if (previouslyReacted) {
          markReacted(messageId, reactionKey, fingerprint, storage)
        } else {
          unmarkReacted(messageId, reactionKey, fingerprint, storage)
        }
      }
    },
    [api, fingerprint, localReactions, messages, storage]
  )

  return {
    fingerprint,
    localReactions,
    reactionPickerForId,
    setReactionPickerForId,
    hasOwnReaction,
    hasAnyOwnReaction,
    handleAddReaction,
  }
}

/* -------------------------------------------------------------------------- */
/* useGuestbookReplies — optimistic append + rollback                         */
/* -------------------------------------------------------------------------- */

export interface UseGuestbookRepliesOptions {
  api: GuestbookApi
  now?: () => number
}

export interface UseGuestbookRepliesResult {
  extraComments: Record<string, GuestbookComment[]>
  replyError: string | null
  replyErrorForMessageId: string | null
  handleSubmitReply: (messageId: string, content: string) => Promise<void>
}

export function useGuestbookReplies({
  api,
  now = Date.now,
}: UseGuestbookRepliesOptions): UseGuestbookRepliesResult {
  const [extraComments, setExtraComments] = useState<Record<string, GuestbookComment[]>>({})
  const [replyError, setReplyError] = useState<string | null>(null)
  const [replyErrorForMessageId, setReplyErrorForMessageId] = useState<string | null>(null)
  const replyCounterRef = useRef(0)

  const handleSubmitReply = useCallback(
    async (messageId: string, content: string) => {
      const trimmed = content.trim()
      if (!trimmed) return
      replyCounterRef.current += 1
      const optimisticId = `optimistic-reply-${replyCounterRef.current}`
      const optimistic: GuestbookComment = {
        id: optimisticId,
        author: 'Guest',
        content: trimmed,
        createdAt: new Date(now()).toISOString(),
      }
      setReplyError(null)
      setReplyErrorForMessageId(null)
      setExtraComments(previous => ({
        ...previous,
        [messageId]: [...(previous[messageId] ?? []), optimistic],
      }))

      try {
        const saved = await api.addReply({ messageId, author: 'Guest', content: trimmed })
        setExtraComments(previous => ({
          ...previous,
          [messageId]: (previous[messageId] ?? []).map(comment =>
            comment.id === optimisticId ? saved : comment
          ),
        }))
      } catch {
        // Roll back the optimistic reply.
        setExtraComments(previous => ({
          ...previous,
          [messageId]: (previous[messageId] ?? []).filter(comment => comment.id !== optimisticId),
        }))
        setReplyError('Your reply could not be saved — please try again.')
        setReplyErrorForMessageId(messageId)
      }
    },
    [api, now]
  )

  return { extraComments, replyError, replyErrorForMessageId, handleSubmitReply }
}
