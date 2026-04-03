import { AnimatePresence, motion } from 'framer-motion'
import { Link, useLocation } from 'react-router-dom'
import MobileMenu from './MobileMenu'
import { useEffect, useState } from 'react'

const Navbar = () => {
  const [isVisible, setIsVisible] = useState(true)
  const [showNav, setShowNav] = useState(false)
  const [lastScrollY, setLastScrollY] = useState(0)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const timer = setTimeout(() => setShowNav(true), 10000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false)
      } else {
        setIsVisible(true)
      }
      setLastScrollY(currentScrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [lastScrollY])

  const navLinks = [
    { name: 'Watch Film', path: '/film' },
    { name: 'Photos', path: '/gallery' },
    { name: 'Guestbook', path: '/guestbook' },
    { name: 'Share', path: '/upload' },
  ]

  return (
    <AnimatePresence>
      {isVisible && showNav && (
        <motion.nav
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className='fixed top-6 left-0 right-0 z-50 flex justify-center px-4'
        >
          <div className='flex items-center justify-between gap-8 px-8 py-4 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/20 transition-all duration-500 hover:border-gold-500/30'>
            {/* Brand/Home Icon - Stylized Monogram */}
            <Link
              to='/'
              className='font-display text-2xl md:text-3xl font-bold tracking-widest no-underline transition-all duration-300 hover:scale-105 group'
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              <span className='text-gold-500 group-hover:text-gold-400 transition-colors drop-shadow-[0_1px_1px_rgba(0,0,0,0.1)]'>
                「
              </span>
              <span className='text-gradient-gold drop-shadow-sm brightness-110'>A&amp;J</span>
              <span className='text-gold-500 group-hover:text-gold-400 transition-colors drop-shadow-[0_1px_1px_rgba(0,0,0,0.1)]'>
                」
              </span>
            </Link>

            {/* Nav Links - Desktop */}
            <div data-testid='desktop-nav' className='hidden md:flex items-center gap-8'>
              {navLinks.map(link => {
                const isActive = location.pathname === link.path
                return (
                  <Link
                    key={link.name}
                    to={link.path}
                    className={`
                      relative text-[10px] md:text-xs uppercase tracking-[0.4em] font-medium transition-all duration-300
                      ${isActive ? 'text-gold-400' : 'text-neutral-300 hover:text-white'}
                    `}
                    {...(isActive && { 'aria-current': 'page' as const })}
                  >
                    {link.name}
                    {/* Active Indicator Dot */}
                    {isActive && (
                      <motion.span
                        layoutId='nav-dot'
                        className='absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-gold-500 shadow-[0_0_8px_rgba(212,175,55,0.4)]'
                      />
                    )}
                  </Link>
                )
              })}
            </div>

            <div className='flex items-center gap-4'>
              {/* ThemeSwitcher removed */}

              {/* Hamburger Button (Mobile Only) */}
              <button
                data-testid='mobile-menu-button'
                onClick={() => setIsMobileMenuOpen(true)}
                className='md:hidden p-1 text-gold-500 hover:text-white transition-colors'
                aria-label='Open menu'
              >
                <svg
                  width='24'
                  height='24'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='1.5'
                >
                  <line x1='3' y1='12' x2='21' y2='12' />
                  <line x1='3' y1='6' x2='21' y2='6' />
                  <line x1='3' y1='18' x2='21' y2='18' />
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          <MobileMenu isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
        </motion.nav>
      )}
    </AnimatePresence>
  )
}

export default Navbar
