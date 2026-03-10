import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const navLinks = [
  { name: 'Watch Film', path: '/film', icon: '▶' },
  { name: 'Gallery', path: '/gallery', icon: '◻' },
  { name: 'Share Photos', path: '/upload', icon: '+' },
  { name: 'Guestbook', path: '/guestbook', icon: '✎' },
]

type HeaderContentProps = {
  location: ReturnType<typeof useLocation>
}

function HeaderContent({ location }: HeaderContentProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [showNav, setShowNav] = useState(location.pathname !== '/')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const lastScrollYRef = useRef(0)

  // Show nav after 3 seconds on home page
  useEffect(() => {
    if (location.pathname !== '/') {
      return undefined
    }

    const timer = setTimeout(() => setShowNav(true), 3000)
    return () => clearTimeout(timer)
  }, [location.pathname])

  // Hide/show on scroll
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      if (currentScrollY > lastScrollYRef.current && currentScrollY > 100) {
        setIsVisible(false)
      } else {
        setIsVisible(true)
      }
      lastScrollYRef.current = currentScrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <AnimatePresence>
      {isVisible && showNav && (
        <motion.header
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4"
        >
          <nav className="flex items-center justify-between gap-6 md:gap-8 px-6 md:px-8 py-3 md:py-4 rounded-full bg-charcoal-900/95 backdrop-blur-xl border border-gold-500/20 shadow-2xl shadow-black/20 transition-all duration-500 hover:border-gold-500/40">
            {/* Logo */}
            <Link
              to="/"
              className="font-display text-xl md:text-2xl font-bold tracking-widest no-underline transition-all duration-300 hover:scale-105 group"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              <span className="text-gold-500 group-hover:text-gold-400 transition-colors">
                「
              </span>
              <span className="bg-gradient-to-r from-gold-300 via-gold-500 to-gold-300 bg-clip-text text-transparent">
                A&J
              </span>
              <span className="text-gold-500 group-hover:text-gold-400 transition-colors">
                」
              </span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.path
                return (
                  <Link
                    key={link.name}
                    to={link.path}
                    className={cn(
                      'relative text-[10px] uppercase tracking-[0.3em] font-medium transition-all duration-300',
                      isActive
                        ? 'text-gold-400'
                        : 'text-neutral-300 hover:text-white'
                    )}
                  >
                    {link.name}
                    {isActive && (
                      <motion.span
                        layoutId="nav-dot"
                        className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-gold-500"
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      />
                    )}
                  </Link>
                )
              })}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 text-gold-500 hover:text-white transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </nav>

          {/* Mobile Menu */}
          <AnimatePresence>
            {isMobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/90 backdrop-blur-xl z-50 md:hidden"
              >
                <div className="flex flex-col items-center justify-center h-full gap-8">
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="absolute top-8 right-8 p-2 text-gold-500 hover:text-white"
                    aria-label="Close menu"
                  >
                    <X className="w-6 h-6" />
                  </button>

                  {navLinks.map((link, i) => (
                    <motion.div
                      key={link.name}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                    >
                      <Link
                        to={link.path}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="text-2xl font-display text-white hover:text-gold-400 transition-colors"
                      >
                        {link.name}
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.header>
      )}
    </AnimatePresence>
  )
}

export function Header() {
  const location = useLocation()
  const headerKey = location.pathname === '/' ? `home-${location.key}` : 'shared-header'

  return <HeaderContent key={headerKey} location={location} />
}
