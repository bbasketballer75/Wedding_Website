import { Button } from '@/components/ui/Button'

interface GuestbookEmptyStateProps {
  onCompose: () => void
}

export function GuestbookEmptyState({ onCompose }: GuestbookEmptyStateProps) {
  return (
    <div className='relative overflow-hidden rounded-2xl border border-gold-200/15 bg-white/5 px-6 py-16 text-center'>
      <svg
        viewBox='0 0 48 48'
        className='mx-auto h-16 w-16 text-gold-400/50'
        fill='none'
        aria-hidden='true'
      >
        <path
          d='M38 10c-6 0-16 4-22 12-4 5-6 10-6 16 0 2 1 3 3 3 6 0 11-2 16-6 8-6 12-16 12-22 0-2-1-3-3-3z'
          stroke='currentColor'
          strokeWidth='1.5'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
        <path
          d='M12 38c2-4 4-6 6-6'
          stroke='currentColor'
          strokeWidth='1.2'
          strokeLinecap='round'
        />
      </svg>
      <p className='font-script text-5xl text-gold-300/75'>Leave a note</p>
      <p className='mt-4 font-display text-xl text-white/70'>
        No notes yet — yours could be the first.
      </p>
      <p className='mx-auto mt-2 max-w-md text-sm text-white/35'>
        Leave something small. It doesn't need to be a speech.
      </p>
      <Button className='mt-8' size='lg' onClick={() => onCompose()}>
        Leave the first note
      </Button>
    </div>
  )
}
