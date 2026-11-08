/**
 * Frozen dual-tab strip (`src/pages/GuestShare.tsx:338-380`) with the Wave-6
 * accessibility contract:
 *
 * - `role='tablist'` + `role='tab'` buttons, `aria-selected`, `aria-controls`;
 * - roving `tabIndex` (active tab is the only tab stop);
 * - ArrowLeft/ArrowRight wrap, Home/End jump, focus follows selection
 *   (automatic activation, per WAI-ARIA tabs pattern);
 * - the frozen animated underline (`motion.div layoutId`) is preserved.
 */
import { motion } from 'framer-motion'
import { BookOpen, Image as ImageIcon } from 'lucide-react'
import type { KeyboardEvent, ReactNode } from 'react'
import { useRef } from 'react'
import { cn } from '@/shared/lib/cn'
import { GUEST_SHARE_COPY } from './constants'
import type { GuestShareTab } from './types'

const TAB_ORDER: readonly GuestShareTab[] = ['photos', 'guestbook']

export interface GuestShareTabsProps {
  activeTab: GuestShareTab
  photoCount: number
  noteCount: number
  onChange: (tab: GuestShareTab) => void
}

export function GuestShareTabs({
  activeTab,
  photoCount,
  noteCount,
  onChange,
}: GuestShareTabsProps) {
  const tabRefs = useRef<Record<GuestShareTab, HTMLButtonElement | null>>({
    photos: null,
    guestbook: null,
  })

  const moveFocus = (next: GuestShareTab) => {
    onChange(next)
    tabRefs.current[next]?.focus()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = TAB_ORDER.indexOf(activeTab)
    let nextIndex = currentIndex

    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % TAB_ORDER.length
        break
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + TAB_ORDER.length) % TAB_ORDER.length
        break
      case 'Home':
        nextIndex = 0
        break
      case 'End':
        nextIndex = TAB_ORDER.length - 1
        break
      default:
        return
    }

    event.preventDefault()
    const nextTab = TAB_ORDER[nextIndex]
    if (nextTab) moveFocus(nextTab)
  }

  return (
    <div
      role='tablist'
      aria-label={GUEST_SHARE_COPY.tabsLabel}
      className='flex border-b border-gold-500/10 pb-px mb-8'
    >
      <div className='flex gap-6'>
        <TabButton
          tab='photos'
          isActive={activeTab === 'photos'}
          label={GUEST_SHARE_COPY.photosTab(photoCount)}
          icon={<ImageIcon className='h-4 w-4' aria-hidden='true' />}
          buttonRef={element => {
            tabRefs.current.photos = element
          }}
          onSelect={() => onChange('photos')}
          onKeyDown={handleKeyDown}
        />
        <TabButton
          tab='guestbook'
          isActive={activeTab === 'guestbook'}
          label={GUEST_SHARE_COPY.guestbookTab(noteCount)}
          icon={<BookOpen className='h-4 w-4' aria-hidden='true' />}
          buttonRef={element => {
            tabRefs.current.guestbook = element
          }}
          onSelect={() => onChange('guestbook')}
          onKeyDown={handleKeyDown}
        />
      </div>
    </div>
  )
}

interface TabButtonProps {
  tab: GuestShareTab
  isActive: boolean
  label: string
  icon: ReactNode
  buttonRef: (element: HTMLButtonElement | null) => void
  onSelect: () => void
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
}

function TabButton({ tab, isActive, label, icon, buttonRef, onSelect, onKeyDown }: TabButtonProps) {
  return (
    <button
      ref={buttonRef}
      type='button'
      role='tab'
      id={`guest-share-tab-${tab}`}
      aria-selected={isActive}
      aria-controls={`guest-share-panel-${tab}`}
      tabIndex={isActive ? 0 : -1}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      className={cn(
        'relative py-3 px-1 text-sm font-semibold tracking-wide font-sans transition-colors',
        isActive ? 'text-gold-700 font-bold' : 'text-charcoal-500 hover:text-charcoal-800'
      )}
    >
      <span className='flex items-center gap-2'>
        {icon}
        {label}
      </span>
      {isActive && (
        <motion.div
          layoutId='activeGuestShareTab'
          className='absolute bottom-0 left-0 right-0 h-0.5 bg-gold-500'
        />
      )}
    </button>
  )
}
