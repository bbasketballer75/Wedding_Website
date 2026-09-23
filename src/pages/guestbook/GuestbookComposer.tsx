import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle, Loader2, PenSquare, Send, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import type { UseGuestbookComposerResult } from './useGuestbookComposer'

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
    composerRef,
    handleSubmit,
    setName,
    setEmail,
    setContent,
    setWebsite,
  } = composer

  return (
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
                  <h2 className='mt-5 text-3xl text-white sm:text-4xl'>What's on your heart?</h2>
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
                <Button type='submit' size='lg' disabled={isSubmitting || !name || !content.trim()}>
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
  )
}
