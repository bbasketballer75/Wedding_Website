import { useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, CheckCircle, Copy, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { UploadSEO } from '@/components/seo/SEOHead'
import { describeUploadSummary, formatMediaCount } from './uploadText'

interface UploadSuccessPanelProps {
  completedPhotoCount: number
  completedVideoCount: number
  email: string
  shareToken: string | null
}

export function UploadSuccessPanel({
  completedPhotoCount,
  completedVideoCount,
  email,
  shareToken,
}: UploadSuccessPanelProps) {
  const [albumCopied, setAlbumCopied] = useState(false)

  const handleCopyAlbumLink = useCallback(async (albumUrl: string) => {
    await navigator.clipboard.writeText(albumUrl)
    setAlbumCopied(true)
    window.setTimeout(() => setAlbumCopied(false), 2000)
  }, [])

  const uploadSummary = describeUploadSummary(completedPhotoCount, completedVideoCount)

  return (
    <div className='min-h-screen bg-[linear-gradient(to_bottom,rgba(12,8,5,1),rgba(22,14,6,1))] px-4 pb-20 pt-32'>
      <div className='pointer-events-none fixed inset-0 overflow-hidden' aria-hidden='true'>
        <div className='absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-gold-500/4 blur-[120px]' />
        <div className='absolute bottom-1/4 right-1/4 h-64 w-64 rounded-full bg-gold-400/3 blur-[100px]' />
      </div>
      <UploadSEO />

      <div className='mx-auto max-w-3xl'>
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          data-testid='upload-success-panel'
          className='relative overflow-hidden rounded-2xl bg-white/6 backdrop-blur-md border border-gold-200/15 px-6 py-10 text-center sm:px-10'
        >
          <div className='absolute -right-10 top-6 h-28 w-28 rounded-full bg-gold-500/8 blur-3xl' />
          <div className='absolute -left-8 bottom-0 h-28 w-28 rounded-full bg-gold-400/5 blur-3xl' />

          <div className='relative'>
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
              className='mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-green-400/25 bg-green-500/10 shadow-sm'
            >
              <CheckCircle className='h-10 w-10 text-green-400' />
            </motion.div>

            <span className='flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-gold-400 mt-6'>
              <Sparkles className='h-3.5 w-3.5' />
              Upload received
            </span>

            <h1 className='mt-6 text-4xl text-white sm:text-5xl'>
              Thank you for adding to the archive.
            </h1>

            <p className='mx-auto mt-4 max-w-2xl text-base text-white/55 sm:text-lg'>
              Your {uploadSummary} {completedPhotoCount + completedVideoCount === 1 ? 'is' : 'are'}{' '}
              uploaded and pending review. We’ll take a look and add the approved moments to the
              shared archive after review.
            </p>

            <div className='mt-8 flex flex-wrap items-center justify-center gap-3 text-sm text-white/50'>
              <span className='rounded-full border border-white/12 bg-white/8 px-4 py-2'>
                {completedPhotoCount > 0
                  ? formatMediaCount(completedPhotoCount, 'photo')
                  : 'No photos'}
              </span>
              <span className='rounded-full border border-white/12 bg-white/8 px-4 py-2'>
                {completedVideoCount > 0
                  ? formatMediaCount(completedVideoCount, 'video')
                  : 'No videos'}
              </span>
              <span className='rounded-full border border-white/12 bg-white/8 px-4 py-2'>
                Contact saved for {email}
              </span>
            </div>

            {shareToken && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className='mt-8 p-6 rounded-xl border border-gold-400/30 bg-gradient-to-br from-gold-500/15 via-gold-500/5 to-transparent text-left relative overflow-hidden'
              >
                <div className='absolute -right-10 -bottom-10 h-32 w-32 rounded-full bg-gold-500/10 blur-2xl pointer-events-none' />
                <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
                  <div>
                    <span className='flex items-center gap-1.5 text-[9px] uppercase tracking-[0.25em] font-semibold text-gold-400'>
                      <Sparkles className='h-3 w-3' /> Your Memory Album Link
                    </span>
                    <h3 className='text-lg font-serif text-white mt-1'>
                      Share your contributions!
                    </h3>
                    <p className='text-white/60 text-xs mt-1 leading-relaxed max-w-md'>
                      This unique link compiles all your approved photo uploads and guestbook
                      messages in one gorgeous public showcase.
                    </p>
                  </div>
                  <div className='flex flex-col gap-2 shrink-0 sm:w-48'>
                    <button
                      type='button'
                      onClick={() =>
                        handleCopyAlbumLink(`${window.location.origin}/guest/${shareToken}`)
                      }
                      className='w-full shrink-0 flex items-center justify-center gap-1.5 rounded-lg bg-gold-500 hover:bg-gold-600 px-4 py-2.5 text-xs font-semibold text-cream-50 transition-all cursor-pointer'
                    >
                      {albumCopied ? (
                        <>
                          <Check className='h-3.5 w-3.5' />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className='h-3.5 w-3.5' />
                          Copy Album Link
                        </>
                      )}
                    </button>
                    <Button
                      to={`/guest/${shareToken}`}
                      variant='secondary'
                      size='sm'
                      className='w-full text-center border-white/10 hover:border-gold-400/30 text-xs py-2 bg-white/5 text-white flex items-center justify-center gap-1'
                    >
                      View My Album
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            <div className='mt-8 grid gap-3 sm:grid-cols-3'>
              <div className='rounded-xl border border-gold-200/15 bg-white/5 px-4 py-4'>
                <p className='text-[10px] uppercase tracking-[0.28em] text-gold-400'>Step 1</p>
                <p className='mt-3 text-sm font-semibold text-white'>We review it first.</p>
                <p className='mt-2 text-sm leading-6 text-white/55'>
                  Nothing goes public automatically. We sort through everything before it appears
                  anywhere on the site.
                </p>
              </div>
              <div className='rounded-xl border border-gold-200/15 bg-white/5 px-4 py-4'>
                <p className='text-[10px] uppercase tracking-[0.28em] text-gold-400'>Step 2</p>
                <p className='mt-3 text-sm font-semibold text-white'>
                  We tag it into the right story lane.
                </p>
                <p className='mt-2 text-sm leading-6 text-white/55'>
                  The best photos get captioned, tagged, and placed into the wedding-day,
                  engagement, or guest-upload collections.
                </p>
              </div>
              <div className='rounded-xl border border-gold-200/15 bg-white/5 px-4 py-4'>
                <p className='text-[10px] uppercase tracking-[0.28em] text-gold-400'>Step 3</p>
                <p className='mt-3 text-sm font-semibold text-white'>
                  The approved moments join the archive.
                </p>
                <p className='mt-2 text-sm leading-6 text-white/55'>
                  Photos can appear in the live gallery, and approved video clips can stay private,
                  join the guest-highlight lane, or become a featured moment later.
                </p>
              </div>
            </div>

            <div className='mt-8 flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center'>
              <Button to='/gallery?collection=Guest+Photos' variant='secondary' size='lg'>
                Guest Photos
              </Button>
              <Button to='/gallery' variant='secondary' size='lg'>
                View Gallery
              </Button>
              <Button onClick={() => window.location.reload()} size='lg'>
                Share more
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
