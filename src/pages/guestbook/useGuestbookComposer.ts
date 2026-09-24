import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/context/ToastContext'
import { formatTimeRemaining, rateLimiter } from '@/utils/rateLimiter'
import type { Message } from './types'
import { mapSupabaseMessage } from './guestbookMapper'

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
  composerRef: React.RefObject<HTMLDivElement | null>
  openComposer: () => void
  handleSubmit: (event: React.FormEvent) => Promise<void>
  setName: (value: string) => void
  setEmail: (value: string) => void
  setContent: (value: string) => void
  setWebsite: (value: string) => void
}

export function useGuestbookComposer(
  prependMessage: (message: Message) => void,
  resetVisibleCount: () => void
): UseGuestbookComposerResult {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [content, setContent] = useState('')
  const [website, setWebsite] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const composerRef = useRef<HTMLDivElement | null>(null)
  const { addToast } = useToast()

  useEffect(() => {
    if (showForm && composerRef.current) {
      composerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [showForm])

  const openComposer = useCallback(() => {
    setShowForm(true)
    setSubmitError(null)
    setIsSubmitted(false)
  }, [])

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault()

      if (website) {
        setIsSubmitting(true)
        window.setTimeout(() => {
          setIsSubmitting(false)
          setIsSubmitted(true)
          addToast('Your note is part of the book now. Thank you.', 'success')
          window.setTimeout(() => {
            setShowForm(false)
            setIsSubmitted(false)
            setName('')
            setEmail('')
            setContent('')
            setWebsite('')
          }, 2200)
        }, 500)
        return
      }

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

          prependMessage({
            id: result.message_id,
            name,
            content: normalizedContent,
            timestamp: 'Just now',
            reactions: {},
            comments: [],
          })
        } else {
          const { data, error } = await supabase
            .from('guestbook_messages')
            .insert([{ name, email, content: normalizedContent, media_url: null }])
            .select()

          if (error) throw error
          if (data?.[0]) prependMessage(mapSupabaseMessage(data[0]))
        }

        resetVisibleCount()
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
    },
    [website, name, email, content, addToast, prependMessage, resetVisibleCount]
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
    composerRef,
    openComposer,
    handleSubmit,
    setName,
    setEmail,
    setContent,
    setWebsite,
  }
}
