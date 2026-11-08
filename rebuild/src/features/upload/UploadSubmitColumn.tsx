import { motion } from 'framer-motion'
import { AlertCircle, ArrowRight, Clock3, Loader2, Mail, ShieldCheck } from 'lucide-react'
import { Button, Input, Label, Textarea } from '@/shared/ui'
import { describeSubmitLabel } from './uploadText'

export interface UploadSubmitColumnProps {
  name: string
  email: string
  message: string
  filesCount: number
  completedFiles: number
  completedPhotoCount: number
  completedVideoCount: number
  isSubmitting: boolean
  submitError: string | null
  onNameChange: (value: string) => void
  onEmailChange: (value: string) => void
  onMessageChange: (value: string) => void
}

/** Frozen `UploadSubmitColumn` (`src/pages/upload/UploadSubmitColumn.tsx`) port. */
export function UploadSubmitColumn({
  name,
  email,
  message,
  filesCount,
  completedFiles,
  completedPhotoCount,
  completedVideoCount,
  isSubmitting,
  submitError,
  onNameChange,
  onEmailChange,
  onMessageChange,
}: UploadSubmitColumnProps) {
  const isBlocked = filesCount === 0 || !name || !email || isSubmitting || completedFiles === 0

  return (
    <div className='grid gap-6 xl:sticky xl:top-28 xl:self-start'>
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14 }}
        className='relative overflow-hidden rounded-2xl bg-white/6 backdrop-blur-md border border-gold-200/15 px-6 py-6'
      >
        <span className='inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.28em] text-gold-400'>
          <Mail className='h-3.5 w-3.5' aria-hidden='true' />
          Your details
        </span>

        <h2 className='mt-5 text-3xl text-white'>Tell us who this upload came from.</h2>

        <p className='mt-3 text-sm leading-6 text-white/55'>
          We only need enough information to credit the memories and send you a quick note when they
          are approved.
        </p>

        <div className='mt-6 space-y-5'>
          <div>
            <Label htmlFor='upload-name' className='text-white/70'>
              Your Name
            </Label>
            <Input
              id='upload-name'
              className='bg-white/8 border-white/12 text-white placeholder:text-white/30 focus:border-gold-400/50'
              value={name}
              onChange={event => onNameChange(event.target.value)}
              placeholder='e.g., Sarah Johnson'
              autoComplete='name'
              required
            />
          </div>

          <div>
            <Label htmlFor='upload-email' className='text-white/70'>
              Email
            </Label>
            <Input
              id='upload-email'
              type='email'
              className='bg-white/8 border-white/12 text-white placeholder:text-white/30 focus:border-gold-400/50'
              value={email}
              onChange={event => onEmailChange(event.target.value)}
              placeholder='your@email.com'
              autoComplete='email'
              required
            />
            <p className='mt-2 text-xs text-white/50'>
              We keep this in case we need to reach you about your photos.
            </p>
          </div>

          <div>
            <Label htmlFor='upload-message' className='text-white/70'>
              Add a Note (Optional)
            </Label>
            <Textarea
              id='upload-message'
              className='bg-white/8 border-white/12 text-white placeholder:text-white/30 focus:border-gold-400/50'
              value={message}
              onChange={event => onMessageChange(event.target.value)}
              placeholder='Tell us where these were taken, who shared them, or leave a little note from the day.'
              rows={4}
            />
          </div>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className='relative overflow-hidden rounded-2xl bg-white/6 backdrop-blur-md border border-gold-200/15 px-5 py-5'
      >
        <p className='text-[10px] uppercase tracking-[0.3em] text-gold-400'>Before you send</p>
        <p className='mt-3 text-lg font-semibold text-white'>A few reassurance points</p>
        <ul className='mt-4 space-y-3 text-sm leading-6 text-white/55'>
          <li className='flex items-start gap-3'>
            <ShieldCheck className='mt-0.5 h-4 w-4 shrink-0 text-gold-600' aria-hidden='true' />
            Only Austin & Jordyn can see these until they are approved.
          </li>
          <li className='flex items-start gap-3'>
            <Clock3 className='mt-0.5 h-4 w-4 shrink-0 text-gold-600' aria-hidden='true' />
            Uploads stay in review until we sort and caption them for the gallery.
          </li>
          <li className='flex items-start gap-3'>
            <Mail className='mt-0.5 h-4 w-4 shrink-0 text-gold-600' aria-hidden='true' />
            Your contact details stay with the submission in case we need context while reviewing
            it.
          </li>
          <li className='flex items-start gap-3'>
            <AlertCircle className='mt-0.5 h-4 w-4 shrink-0 text-gold-600' aria-hidden='true' />
            Duplicates and oversized files are called out before submission so the queue stays
            honest.
          </li>
        </ul>
      </motion.section>

      {submitError && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className='rounded-xl border border-rose-400/25 bg-rose-500/8 px-4 py-3'
        >
          <p role='alert' className='flex items-center gap-2 text-sm text-rose-300'>
            <AlertCircle className='h-4 w-4' aria-hidden='true' />
            {submitError}
          </p>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.24 }}
        className='relative overflow-hidden rounded-2xl bg-white/6 backdrop-blur-md border border-gold-200/15 px-5 py-5'
      >
        <div className='flex items-start justify-between gap-4'>
          <div>
            <p className='text-[10px] uppercase tracking-[0.3em] text-gold-400'>Final step</p>
            <p className='mt-3 text-lg font-semibold text-white'>
              Send everything through for review.
            </p>
          </div>
          <ArrowRight className='mt-1 h-5 w-5 text-gold-600' aria-hidden='true' />
        </div>

        <p className='mt-3 text-sm leading-6 text-white/55'>
          You can submit once at least one file is marked ready and your contact details are filled
          in. Files that failed will stay out until you retry or remove them.
        </p>

        <div className='mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-4'>
          <p className='text-[10px] uppercase tracking-[0.28em] text-gold-400'>What happens next</p>
          <p className='mt-3 text-sm leading-6 text-white/55'>
            After you send, the upload enters a private review queue. Approved photos can be
            published into the live gallery, while approved video clips can be kept private, added
            to guest highlights, or featured later.
          </p>
        </div>

        <Button type='submit' size='lg' className='mt-6 w-full' disabled={isBlocked}>
          {isSubmitting ? (
            <>
              <Loader2 className='mr-2 h-4 w-4 animate-spin' aria-hidden='true' />
              Submitting…
            </>
          ) : completedFiles === 0 && filesCount > 0 ? (
            'Wait for uploads…'
          ) : (
            describeSubmitLabel(completedPhotoCount, completedVideoCount)
          )}
        </Button>
      </motion.div>
    </div>
  )
}
