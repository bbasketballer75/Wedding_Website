import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { publicNavLinks } from './publicNav'
import { Menu, X, type LucideIcon } from 'lucide-react'

function HeaderLink({
  path,
  name,
  mobileName,
  icon: Icon,
  isActive,
  isPrimary = false,
}: {
  path: string
  name: string
  mobileName: string
  icon: LucideIcon
  isActive: boolean
  isPrimary?: boolean
}) {
  return (
    <Link
      to={path}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex shrink-0 items-center gap-1 rounded-full px-2 py-2 text-[9px] font-medium leading-none uppercase tracking-[0.16em] transition-all duration-300 max-[360px]:gap-0 max-[360px]:px-1.5 max-[360px]:text-[8px] max-[360px]:tracking-[0.12em] min-[430px]:px-2.5 sm:gap-2 sm:px-4 sm:py-2.5 sm:text-xs sm:tracking-[0.24em]',
        isActive
          ? 'bg-[linear-gradient(145deg,rgba(58,42,33,0.98),rgba(77,58,44,0.96))] text-cinematic-primary shadow-[0_16px_32px_-24px_rgba(21,20,19,0.72)]'
          : isPrimary
            ? 'text-gold-700 hover:bg-white/80 hover:text-gold-800'
            : 'text-charcoal-700 hover:bg-white/80 hover:text-charcoal-900'
      )}
    >
      <Icon
        className={cn(
          'h-3.5 w-3.5 max-[360px]:h-3 max-[360px]:w-3 sm:h-4 sm:w-4',
          isActive ? 'text-gold-200' : isPrimary ? 'text-gold-500' : 'text-gold-600'
        )}
      />
      <span className="max-[360px]:hidden sm:hidden">{mobileName}</span>
      <span className="hidden sm:inline">{name}</span>
    </Link>
  )
}

function HeaderContent() {
  const location = useLocation()
  const [isVisible, setIsVisible] = useState(true)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const lastScrollYRef = useRef(0)

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const shouldAutoHide = window.innerWidth < 1024

      if (!shouldAutoHide) {
        setIsVisible(true)
        lastScrollYRef.current = currentScrollY
        return
      }

      if (currentScrollY < 40) {
        setIsVisible(true)
      } else if (currentScrollY > lastScrollYRef.current) {
        setIsVisible(false)
      } else {
        setIsVisible(true)
      }

      lastScrollYRef.current = currentScrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [location.pathname])

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobileMenuOpen])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.header
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          data-testid="public-header"
          className="fixed left-1/2 top-3 z-50 w-[calc(100vw-0.75rem)] max-w-[40rem] -translate-x-1/2 px-0 sm:top-6 sm:w-[calc(100vw-1rem)] sm:max-w-[42rem]"
        >
          <div className="flex w-full items-center gap-0.5 overflow-x-auto scroll-smooth rounded-full border border-gold-300/45 bg-gradient-to-r from-cream-100/92 via-gold-50/92 to-cream-100/92 px-1 py-1.5 shadow-[0_18px_40px_-28px_rgba(46,33,13,0.42)] backdrop-blur-xl hide-scrollbar sm:justify-between sm:gap-0 sm:px-2 sm:py-2">
            <Link
              to="/"
              className="shrink-0 px-3 py-2 font-display text-lg text-charcoal-900 transition-colors hover:text-gold-600 max-[360px]:px-2.5 max-[360px]:text-base sm:px-4 sm:text-xl"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              <span className="text-gold-500">A</span>&<span className="text-gold-500">J</span>
            </Link>

            <div className="hidden h-5 w-px bg-gold-300/60 sm:block" />

            {/* Desktop nav links - hidden on mobile */}
            <div className="hidden sm:flex items-center gap-0.5">
              {publicNavLinks.map((link, index) => (
                <div key={link.path} className="contents">
                  <HeaderLink
                    path={link.path}
                    name={link.label}
                    mobileName={link.mobileLabel}
                    icon={link.icon}
                    isActive={location.pathname === link.path}
                    isPrimary={link.isPrimary}
                  />
                  {index < publicNavLinks.length - 1 && (
                    <div className="hidden h-5 w-px bg-gold-300/60" />
                  )}
                </div>
              ))}
            </div>

            {/* Mobile hamburger button - hidden on desktop */}
            <button
              type="button"
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMobileMenuOpen}
              className="flex sm:hidden items-center justify-center w-10 h-10 rounded-full bg-white/80 text-charcoal-700 hover:bg-white transition-colors"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <AnimatePresence mode="wait" initial={false}>
                {isMobileMenuOpen ? (
                  <motion.div
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <X className="w-5 h-5" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="menu"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Menu className="w-5 h-5" />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </div>

          {/* Mobile menu overlay - hidden on desktop */}
          <AnimatePresence>
            {isMobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="sm:hidden mt-2 rounded-2xl border border-gold-300/45 bg-gradient-to-r from-cream-100/98 via-gold-50/98 to-cream-100/98 px-4 py-4 shadow-lg backdrop-blur-xl"
              >
                <nav className="flex flex-col gap-1">
                  {publicNavLinks.map((link) => (
                    <HeaderLink
                      key={link.path}
                      path={link.path}
                      name={link.label}
                      mobileName={link.mobileLabel}
                      icon={link.icon}
                      isActive={location.pathname === link.path}
                      isPrimary={link.isPrimary}
                    />
                  ))}
                </nav>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.header>
      )}
    </AnimatePresence>
  )
}

export function Header() {
  return <HeaderContent />
}
