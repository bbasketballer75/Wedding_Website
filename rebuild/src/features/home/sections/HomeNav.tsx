import { Link } from '@tanstack/react-router'
import { motion, useMotionValueEvent, useScroll } from 'framer-motion'
import { useState, type ElementType } from 'react'
import { publicNavLinks } from '@/app/shell/publicNav'
import { ThemeToggle } from '@/app/shell/ThemeToggle'
import { cn } from '@/shared/lib/cn'

/**
 * Frozen Home sticky nav (`src/pages/Home.tsx` lines 26-146, `NavItem` +
 * "Sticky Nav Bar"): same DOM order, class strings, scroll threshold (100px)
 * and light/dark chrome swap. Router adaptation: TanStack `Link`.
 *
 * Known cross-boundary imports (feature -> app shell) for `publicNavLinks` and
 * `ThemeToggle`: both are shell-owned modules in the rebuild and are not
 * duplicated. Promote them to `shared/` in a later wave if the boundary needs
 * to be strict.
 */
function NavItem({
  to,
  icon: Icon,
  label,
  mobileLabel,
  isPrimary = false,
  scrolled = false,
}: {
  to: string
  icon: ElementType
  label: string
  mobileLabel?: string
  isPrimary?: boolean
  scrolled?: boolean
}) {
  return (
    <Link
      to={to}
      className={cn(
        'flex shrink-0 items-center gap-1 rounded-full px-2 py-2 text-[9px] font-medium leading-none uppercase tracking-[0.16em] transition-all duration-300 max-[360px]:gap-0 max-[360px]:px-1.5 max-[360px]:text-[8px] max-[360px]:tracking-[0.12em] min-[430px]:px-2.5 sm:gap-2 sm:px-4 sm:py-2.5 sm:text-xs sm:tracking-[0.24em]',
        isPrimary
          ? scrolled
            ? 'text-gold-500 hover:text-gold-600 font-medium'
            : 'text-gold-300 hover:text-candle-100 font-medium'
          : scrolled
            ? 'text-charcoal-700 hover:text-charcoal-900 hover:bg-charcoal-100'
            : 'text-[#f7efe3] hover:text-[#fff7eb] hover:bg-white/10'
      )}
    >
      <Icon
        className={cn(
          'h-3.5 w-3.5 max-[360px]:h-3 max-[360px]:w-3 sm:h-4 sm:w-4',
          isPrimary && !scrolled && 'fill-gold-400/20'
        )}
      />
      <span className='max-[360px]:hidden sm:hidden'>{mobileLabel ?? label}</span>
      <span className='hidden sm:inline'>{label}</span>
    </Link>
  )
}

export function HomeNav() {
  const [scrolled, setScrolled] = useState(false)
  const { scrollY } = useScroll()

  // Track scroll position for section transitions (frozen threshold: 100px).
  useMotionValueEvent(scrollY, 'change', latest => {
    setScrolled(latest > 100)
  })

  return (
    <motion.nav
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      data-testid='home-nav'
      className='fixed top-3 left-1/2 z-50 w-[calc(100vw-0.75rem)] max-w-[40rem] -translate-x-1/2 sm:top-6 sm:w-[calc(100vw-1rem)] sm:max-w-[62rem]'
    >
      <motion.div
        className={cn(
          'flex w-full items-center gap-1 overflow-x-auto rounded-full px-1.5 py-1.5 transition-all duration-500 hide-scrollbar sm:justify-between sm:gap-0 sm:px-2 sm:py-2',
          scrolled
            ? 'theme-panel'
            : 'bg-[linear-gradient(135deg,rgba(41,29,23,0.9),rgba(58,42,33,0.9))] backdrop-blur-md border border-gold-200/18 shadow-2xl'
        )}
      >
        {/* Logo */}
        <Link
          to='/'
          className={cn(
            'shrink-0 px-3 py-2 font-display text-lg transition-colors max-[360px]:px-2.5 max-[360px]:text-base sm:px-4 sm:text-xl',
            scrolled
              ? 'text-charcoal-900 hover:text-gold-600'
              : 'text-[#fff7eb] hover:text-gold-300'
          )}
        >
          <span className='text-gold-500'>A</span>&<span className='text-gold-500'>J</span>
        </Link>

        <div
          className={cn(
            'hidden h-5 w-px sm:block',
            scrolled ? 'bg-charcoal-200' : 'bg-gold-200/18'
          )}
        />

        {publicNavLinks.map((item, index) => (
          <div key={item.path} className='contents'>
            {index > 0 && (
              <div
                className={cn(
                  'hidden h-5 w-px sm:block',
                  scrolled ? 'bg-charcoal-200' : 'bg-gold-200/18'
                )}
              />
            )}
            <NavItem
              to={item.path}
              icon={item.icon}
              label={item.label}
              mobileLabel={item.mobileLabel}
              isPrimary={item.isPrimary}
              scrolled={scrolled}
            />
          </div>
        ))}
        <ThemeToggle className='shadow-none' />
      </motion.div>
    </motion.nav>
  )
}
