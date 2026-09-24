import { X } from 'lucide-react'
import { REACTION_TYPES } from './constants'

interface ReactionPickerProps {
  messageId: string
  onSelect: (messageId: string, reactionKey: string) => void
  onClose: () => void
}

export function ReactionPicker({ messageId, onSelect, onClose }: ReactionPickerProps) {
  return (
    <div
      id='reaction-picker'
      className='fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-2xl border border-white/15 bg-[rgba(22,14,6,0.95)] px-4 py-3 shadow-2xl backdrop-blur-md'
    >
      <div className='flex items-center gap-2'>
        {REACTION_TYPES.map(r => (
          <button
            key={r.key}
            type='button'
            onClick={() => onSelect(messageId, r.key)}
            aria-label={r.label}
            className='flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-2xl transition-transform hover:scale-110 hover:bg-white/8'
          >
            {r.emoji}
            <span className='text-[10px] text-white/50'>{r.label}</span>
          </button>
        ))}
        <button
          type='button'
          onClick={onClose}
          aria-label='Close reaction picker'
          className='ml-2 rounded-full border border-white/15 bg-white/8 p-1.5 text-white/50 hover:text-white'
        >
          <X className='h-3.5 w-3.5' />
        </button>
      </div>
    </div>
  )
}
