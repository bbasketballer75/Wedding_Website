import { motion } from 'framer-motion'
import { BookHeart } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface GuestbookHeroProps {
  messageCount: number
  onCompose: () => void
}

export function GuestbookHero({ messageCount, onCompose }: GuestbookHeroProps) {
  return (
    <section className='px-4 pb-10'>
      <div className='mx-auto max-w-6xl'>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className='relative overflow-hidden rounded-2xl bg-white/6 backdrop-blur-md border border-gold-200/15 px-6 py-10 sm:px-10 sm:py-14'
        >
          <div className='absolute -right-16 top-10 h-44 w-44 rounded-full bg-gold-500/8 blur-3xl' />
          <div className='absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-gold-400/5 blur-3xl' />
          <div className='relative max-w-2xl'>
            <span className='flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-gold-400'>
              <BookHeart className='h-3.5 w-3.5' />
              After the film
            </span>
            <h1 className='mt-6 text-5xl text-white sm:text-6xl'>Say something before you go.</h1>
            <p className='mt-5 text-base text-white/55 sm:text-lg'>
              The guestbook is where the day settles. Whatever you felt, what you remember, or what
              you want us to carry forward — leave it here.
            </p>
            <div className='mt-8 flex flex-wrap items-center gap-4'>
              <Button size='lg' onClick={() => onCompose()}>
                Start your message
              </Button>
              {messageCount > 0 && (
                <span className='text-sm text-white/35'>
                  {messageCount} {messageCount === 1 ? 'note' : 'notes'} so far
                </span>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
