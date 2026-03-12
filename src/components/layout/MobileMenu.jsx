import { AnimatePresence, motion } from 'framer-motion'
import { Link, useLocation } from 'react-router-dom'

const MobileMenu = ({ isOpen, onClose }) => {
  const location = useLocation()
  const navLinks = [
    { name: 'Watch Film', path: '/film' },
    { name: 'Photos', path: '/gallery' },
    { name: 'Guestbook', path: '/guestbook' },
    { name: 'Share', path: '/upload' },
  ]

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            className='fixed inset-0 z-[9998] bg-dark-950/20 backdrop-blur-sm'
          />

          {/* Menu Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.4, ease: [0.19, 1, 0.22, 1] }}
            className='fixed top-0 right-0 bottom-0 w-[85%] max-w-[400px] z-[9999] p-8 overflow-auto shadow-2xl bg-cream-50 border-l border-gold-500/10'
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              aria-label='Close menu'
              className='absolute top-6 right-6 bg-transparent border-none text-dark-700 text-4xl cursor-pointer p-0 leading-none hover:text-gold-600 transition-colors'
            >
              ×
            </button>

            {/* Brand */}
            <div className='my-12 text-center'>
              <Link to='/' onClick={onClose} className='no-underline'>
                <div className='font-display text-4xl font-medium text-gold-500 tracking-[0.4em]'>
                  A&J
                </div>
              </Link>
            </div>

            {/* Navigation Links */}
            <nav data-testid='mobile-nav' className='flex flex-col gap-2'>
              {navLinks.map((link, index) => {
                const isActive = location.pathname === link.path
                return (
                  <motion.div
                    key={link.name}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 + 0.1 }}
                  >
                    <Link
                      to={link.path}
                      onClick={onClose}
                      className={`
                        block w-full border-b border-gold-500/5 font-body text-lg font-normal uppercase tracking-[0.3em] py-5 text-left transition-all duration-300 no-underline
                        ${isActive ? 'text-gold-600 pl-4' : 'text-dark-700/70 hover:text-gold-600'}
                      `}
                    >
                      {link.name}
                    </Link>
                  </motion.div>
                )
              })}
            </nav>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default MobileMenu
