import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle, Loader2, PenSquare, Send, Sparkles, X } from 'lucide-react'
import { Button, Input, Label, Textarea } from '@/shared/ui'
import { COMPOSER_LIMITS, GUESTBOOK_COPY } from './constants'
import type { UseGuestbookComposerResult } from './data'

/** Frozen `GuestbookComposer` (`src/pages/guestbook/GuestbookComposer.tsx`) port. */
export function GuestbookComposer({ composer }: { composer: UseGuestbookComposerResult }) {
  const {
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
    handleSubmit,
    setName,
    setEmail,
    setContent,
    setWebsite,
  } = composer
  const composerRef = useRef<HTMLDivElement | null>(null)
  const successHeadingRef = useRef<HTMLHeadingElement | null>(null)

  // Focus management after submit (deliverable #7): move focus to the success
  // message so screen-reader users hear the confirmation.
  useEffect(() => {
    if (isSubmitted) successHeadingRef.current?.focus()
  }, [isSubmitted])

  return (
    <AnimatePresence>
      {showForm && (
        <motion.div
          ref={composerRef}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          data-testid='guestbook-composer'
          data-submit-fallback={lastSubmitViaFallback ? 'true' : 'false'}
          className='relative overflow-hidden rounded-2xl bg-white/6 backdrop-blur-md border border-gold-200/15 px-5 py-5 sm:px-6 sm:py-6 lg:px-8'
        >
          {isSubmitted ? (
            <div className='text-center'>
              <div className='mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-green-400/25 bg-green-500/10 shadow-sm'>
                <CheckCircle className='h-10 w-10 text-green-400' aria-hidden='true' />
              </div>
              <span className='mt-6 flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-gold-400'>
                <Sparkles className='h-3.5 w-3.5' aria-hidden='true' />
                {GUESTBOOK_COPY.successEyebrow}
              </span>
              <h2
                ref={successHeadingRef}
                tabIndex={-1}
                className='mt-6 text-4xl text-white outline-none sm:text-5xl'
              >
                {GUESTBOOK_COPY.successTitle}
              </h2>
              <p className='mx-auto mt-4 max-w-2xl text-base text-white/55 sm:text-lg'>
                {GUESTBOOK_COPY.successBody}
              </p>
            </div>
          ) : (
            <form onSubmit={event => void handleSubmit(event)} noValidate>
              <div className='flex items-start justify-between gap-4'>
                <div>
                  <span className='flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-gold-400'>
                    <PenSquare className='h-3.5 w-3.5' aria-hidden='true' />
                    {GUESTBOOK_COPY.composerEyebrow}
                  </span>
                  <h2 className='mt-5 text-3xl text-white sm:text-4xl'>
                    {GUESTBOOK_COPY.composerTitle}
                  </h2>
                </div>
                <button
                  type='button'
                  onClick={() => setShowForm(false)}
                  className='rounded-full border border-white/15 bg-white/8 p-2 text-white/50 shadow-sm transition-colors hover:bg-white/12 hover:text-white'
                  aria-label={GUESTBOOK_COPY.composerCloseLabel}
                  aria-expanded='true'
                >
                  <X className='h-5 w-5' aria-hidden='true' />
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
                    aria-invalid={errors.name ? 'true' : undefined}
                    aria-describedby={errors.name ? 'guestbook-name-error' : undefined}
                    required
                  />
                  {errors.name && (
                    <p
                      id='guestbook-name-error'
                      role='alert'
                      className='mt-2 text-xs text-rose-300'
                    >
                      {errors.name}
                    </p>
                  )}
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
                    aria-invalid={errors.email ? 'true' : undefined}
                    aria-describedby={errors.email ? 'guestbook-email-error' : undefined}
                  />
                  {errors.email ? (
                    <p
                      id='guestbook-email-error'
                      role='alert'
                      className='mt-2 text-xs text-rose-300'
                    >
                      {errors.email}
                    </p>
                  ) : (
                    <p className='mt-2 text-xs text-white/30'>
                      Just in case we want to follow up with you.
                    </p>
                  )}
                </div>
                {/* Honeypot: hidden from users and assistive tech; a filled value
                    silently "succeeds" without touching the API (frozen behavior). */}
                <div className='hidden' aria-hidden='true'>
                  <Label htmlFor='website'>Leave this blank</Label>
                  <Input
                    id='website'
                    type='text'
                    value={website}
                    onChange={event => setWebsite(event.target.value)}
                    tabIndex={-1}
                    autoComplete='off'
                  />
                </div>
              </div>

              <div className='mt-6'>
                <div className='flex items-baseline justify-between'>
                  <Label htmlFor='guestbook-message' className='text-white/70'>
                    Your message
                  </Label>
                  <span
                    className={`text-xs tabular-nums transition-colors ${content.length > COMPOSER_LIMITS.contentMax ? 'text-amber-400' : 'text-white/30'}`}
                  >
                    {content.length}/{COMPOSER_LIMITS.contentMax}
                  </span>
                </div>
                <Textarea
                  id='guestbook-message'
                  className='mt-1.5 bg-white/8 border-white/12 text-white placeholder:text-white/30 focus:border-gold-400/50'
                  value={content}
                  onChange={event =>
                    setContent(event.target.value.slice(0, COMPOSER_LIMITS.contentMax))
                  }
                  placeholder='Tell us what you felt, what you remember, or what you hope for us next.'
                  rows={6}
                  maxLength={COMPOSER_LIMITS.contentMax}
                  aria-invalid={errors.content ? 'true' : undefined}
                  aria-describedby={errors.content ? 'guestbook-message-error' : undefined}
                  required
                />
                {errors.content && (
                  <p
                    id='guestbook-message-error'
                    role='alert'
                    className='mt-2 text-xs text-rose-300'
                  >
                    {errors.content}
                  </p>
                )}
              </div>

              {submitError && (
                <div className='mt-5 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3'>
                  <p role='alert' className='text-sm text-rose-300'>
                    {submitError}
                  </p>
                </div>
              )}

              <div className='mt-6 flex justify-end border-t border-white/10 pt-5'>
                <Button type='submit' size='lg' disabled={isSubmitting || !name || !content.trim()}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className='h-4 w-4 animate-spin' aria-hidden='true' />
                      Sending…
                    </>
                  ) : (
                    <>
                      <Send className='h-4 w-4' aria-hidden='true' />
                      {GUESTBOOK_COPY.submitLabel}
                    </>
                  )}
                </Button>
              </div>
              {/* aria-live status for limiter / success announcements. */}
              <div role='status' aria-live='polite' className='sr-only'>
                {statusMessage ?? ''}
              </div>
            </form>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
