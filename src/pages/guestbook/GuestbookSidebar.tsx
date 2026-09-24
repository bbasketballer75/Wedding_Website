import { motion } from 'framer-motion'
import { Send, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface GuestbookSidebarProps {
  showForm: boolean
  onToggle: () => void
}

export function GuestbookSidebar({ showForm, onToggle }: GuestbookSidebarProps) {
  return (
    <div className='grid gap-4 xl:sticky xl:top-28'>
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className='relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-sm border border-gold-200/12 px-5 py-5'
      >
        <p className='text-[10px] uppercase tracking-[0.3em] text-gold-400'>Leave a note</p>
        <h2 className='mt-4 text-2xl text-white'>Something to remember us by.</h2>
        <p className='mt-3 text-sm leading-6 text-white/55'>
          A few words is plenty. Write what came to mind on the drive home.
        </p>
        <Button
          onClick={onToggle}
          variant='secondary'
          className='mt-5 w-full'
          aria-expanded={showForm}
        >
          {showForm ? (
            <>
              <X className='h-4 w-4' />
              Close
            </>
          ) : (
            <>
              <Send className='h-4 w-4' />
              Write a note
            </>
          )}
        </Button>
      </motion.div>
    </div>
  )
}
