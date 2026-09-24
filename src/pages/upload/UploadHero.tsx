import { motion } from 'framer-motion'
import { ArrowRight, ShieldCheck, Sparkles } from 'lucide-react'
import { useClaimStore } from '@/stores/claimStore'
import { formatMediaCount } from './uploadText'

interface UploadHeroProps {
  selectedPhotoCount: number
  selectedVideoCount: number
}

export function UploadHero({ selectedPhotoCount, selectedVideoCount }: UploadHeroProps) {
  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className='relative overflow-hidden rounded-2xl bg-white/6 backdrop-blur-md border border-gold-200/15 px-6 py-8 sm:px-8 sm:py-10'
      >
        <div className='absolute -right-16 top-10 h-44 w-44 rounded-full bg-gold-500/8 blur-3xl' />
        <div className='absolute -left-10 bottom-0 h-28 w-28 rounded-full bg-gold-400/5 blur-3xl' />

        <div className='relative'>
          <span className='flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-gold-400'>
            <Sparkles className='h-3.5 w-3.5' />
            Contribute to the Archive
          </span>

          <h1 className='mt-6 text-5xl text-white sm:text-6xl'>
            Preserve the moments from your perspective.
          </h1>

          <p className='mt-5 max-w-2xl text-base text-white/55 sm:text-lg'>
            Phone photos, shaky dance-floor videos, ceremony candids, quiet table moments: the whole
            archive gets better when your side of the day is part of it too.
          </p>

          <div className='mt-8 flex flex-wrap items-center gap-3 text-sm text-white/50'>
            <span className='rounded-full border border-white/12 bg-white/8 px-4 py-2'>
              {selectedPhotoCount > 0
                ? formatMediaCount(selectedPhotoCount, 'selected photo')
                : 'Photos welcome'}
            </span>
            <span className='rounded-full border border-white/12 bg-white/8 px-4 py-2'>
              {selectedVideoCount > 0
                ? formatMediaCount(selectedVideoCount, 'selected video')
                : 'Videos welcome'}
            </span>
            <span className='rounded-full border border-white/12 bg-white/8 px-4 py-2'>
              Reviewed before posting
            </span>
          </div>
        </div>
      </motion.section>

      {/* Photo Claiming Banner */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.05 }}
        className='mt-8 relative overflow-hidden rounded-2xl bg-gradient-to-r from-gold-500/15 via-gold-500/5 to-transparent backdrop-blur-md border border-gold-500/20 px-6 py-6 sm:px-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'
      >
        <div className='absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gold-500/10 blur-2xl pointer-events-none' />
        <div className='relative flex items-start gap-4'>
          <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gold-400/30 bg-gold-500/10 text-gold-400'>
            <ShieldCheck className='h-6 w-6' />
          </div>
          <div>
            {/* h2 (was h3) — this is a major section banner, not nested under another heading. */}
            <h2 className='text-xl font-serif text-white'>Already uploaded memories?</h2>
            <p className='mt-1 text-sm text-white/70 max-w-xl'>
              Claim ownership of your uploaded photos or face clusters you appear in. Get your name
              verified and beautifully displayed in gold italics across the gallery.
            </p>
          </div>
        </div>
        <button
          type='button'
          onClick={() => useClaimStore.getState().openWizard()}
          className='relative shrink-0 overflow-hidden rounded-lg bg-gold-500 hover:bg-gold-600 px-5 py-2.5 text-sm font-semibold text-charcoal-900 shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5'
        >
          Claim My Photos
          <ArrowRight className='h-4 w-4' />
        </button>
      </motion.section>
    </>
  )
}
