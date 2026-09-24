import { useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

export const EMPTY_CAPTIONS_TRACK = 'data:text/vtt,WEBVTT'

export interface GuestVideoHighlight {
  id: string
  uploadId: string
  guestName: string
  title: string
  description: string
  videoUrl: string
  createdAt: string
  badge?: string
  trail?: string
}

export function GuestVideoHighlightCard({
  clip,
  onOpen,
}: {
  clip: GuestVideoHighlight
  onOpen: (clip: GuestVideoHighlight) => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  return (
    <button
      type='button'
      onClick={() => onOpen(clip)}
      onMouseEnter={() => {
        if (!videoRef.current) return
        videoRef.current.currentTime = 0
        void videoRef.current.play().catch(() => {})
      }}
      onMouseLeave={() => {
        if (!videoRef.current) return
        videoRef.current.pause()
        videoRef.current.currentTime = 0
      }}
      onFocus={() => {
        if (!videoRef.current) return
        videoRef.current.currentTime = 0
        void videoRef.current.play().catch(() => {})
      }}
      onBlur={() => {
        if (!videoRef.current) return
        videoRef.current.pause()
        videoRef.current.currentTime = 0
      }}
      className='group cinematic-card min-h-[19rem] overflow-hidden p-0 text-left transition-transform duration-300 hover:-translate-y-1'
    >
      <div className='relative aspect-[4/5] overflow-hidden'>
        <video
          ref={videoRef}
          src={clip.videoUrl}
          muted
          playsInline
          preload='metadata'
          loop
          className='h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]'
        >
          <track
            kind='captions'
            src={EMPTY_CAPTIONS_TRACK}
            srcLang='en'
            label='No captions available'
          />
        </video>
        <div className='absolute inset-0 bg-[linear-gradient(to_top,rgba(24,17,14,0.92),rgba(24,17,14,0.12)_58%)]' />
        <div className='absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-[#f5e2bf]/30 bg-[rgba(64,44,34,0.68)] px-3 py-1.5 text-[10px] uppercase tracking-[0.26em] text-[#fff7eb] backdrop-blur-sm'>
          {clip.badge || 'From your phones'}
        </div>
      </div>

      <div className='p-5 sm:p-6'>
        <p className='text-[10px] uppercase tracking-[0.28em] text-gold-300/78'>
          {clip.trail || clip.guestName}
        </p>
        <h3 className='mt-3 font-display text-[1.8rem] leading-none text-cinematic-primary'>
          {clip.title}
        </h3>
        <p className='mt-3 text-sm leading-6 text-cinematic-secondary'>{clip.description}</p>
      </div>
    </button>
  )
}

export function GuestVideoHighlightModal({
  clip,
  onClose,
}: {
  clip: GuestVideoHighlight | null
  onClose: () => void
}) {
  if (!clip) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className='fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(18,12,10,0.82)] p-4 backdrop-blur-md'
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.98 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className='cinematic-panel w-full max-w-4xl overflow-hidden'
          onClick={event => event.stopPropagation()}
        >
          <div className='flex items-center justify-between border-b border-gold-200/14 px-5 py-4 sm:px-6'>
            <div>
              <p className='text-[10px] uppercase tracking-[0.32em] text-gold-300/82'>
                Guest highlight
              </p>
              <h3 className='mt-2 font-display text-3xl text-cinematic-primary'>{clip.title}</h3>
            </div>
            <button
              type='button'
              onClick={onClose}
              className='flex h-11 w-11 items-center justify-center rounded-full border border-gold-200/18 bg-[rgba(255,247,235,0.08)] text-cinematic-primary transition-colors hover:border-gold-300/35 hover:text-gold-300'
              aria-label='Close guest highlight video'
            >
              <X className='h-5 w-5' />
            </button>
          </div>

          <div className='grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]'>
            <div className='overflow-hidden rounded-[1.75rem] border border-gold-200/16 bg-black/20'>
              <video
                src={clip.videoUrl}
                controls
                autoPlay
                playsInline
                className='aspect-video w-full object-cover'
              >
                <track
                  kind='captions'
                  src={EMPTY_CAPTIONS_TRACK}
                  srcLang='en'
                  label='No captions available'
                />
              </video>
            </div>

            <div className='cinematic-card px-5 py-5'>
              <p className='text-[10px] uppercase tracking-[0.3em] text-gold-300/82'>
                {clip.badge || 'Shared by'}
              </p>
              <p className='mt-4 font-display text-3xl text-cinematic-primary'>{clip.guestName}</p>
              <p className='mt-4 text-base leading-7 text-cinematic-secondary'>
                {clip.description}
              </p>
              <div className='mt-6 rounded-2xl border border-gold-200/14 bg-[rgba(255,247,235,0.06)] px-4 py-3'>
                <span className='text-[10px] uppercase tracking-[0.28em] text-gold-300/78'>
                  Added
                </span>
                <p className='mt-2 text-cinematic-secondary'>
                  {new Date(clip.createdAt).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
