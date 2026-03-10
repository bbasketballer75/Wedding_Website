import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-charcoal-900 text-cream-100 py-16 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Main Footer Content */}
        <div className="flex flex-col items-center text-center space-y-6">
          {/* Names */}
          <div className="font-display text-3xl md:text-4xl">
            <span className="text-gold-500">Austin</span>
            <span className="text-cream-300 mx-3">&</span>
            <span className="text-gold-500">Jordyn</span>
          </div>

          {/* Date */}
          <p className="text-gold-300/80 text-sm uppercase tracking-[0.3em]">
            May 10, 2025 · Married
          </p>

          {/* Divider */}
          <div className="w-24 h-px bg-gradient-to-r from-transparent via-gold-500/50 to-transparent my-4" />

          {/* Navigation */}
          <nav className="flex flex-wrap justify-center gap-6 text-sm">
            <Link to="/film" className="text-cream-300/70 hover:text-gold-400 transition-colors uppercase tracking-wider">
              Watch Film
            </Link>
            <Link to="/gallery" className="text-cream-300/70 hover:text-gold-400 transition-colors uppercase tracking-wider">
              Gallery
            </Link>
            <Link to="/upload" className="text-cream-300/70 hover:text-gold-400 transition-colors uppercase tracking-wider">
              Share Photos
            </Link>
            <Link to="/guestbook" className="text-cream-300/70 hover:text-gold-400 transition-colors uppercase tracking-wider">
              Guestbook
            </Link>
          </nav>

          {/* Thank You */}
          <p className="text-cream-200/60 max-w-md text-sm leading-relaxed pt-4">
            Thank you for celebrating with us. Reliving these memories means the world.
          </p>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-cream-300/40">
          <p className="flex items-center gap-1">
            Made with <Heart className="w-3 h-3 text-rose-500 fill-rose-500" /> by Austin & Jordyn
          </p>
          <p>© {currentYear} · All rights reserved</p>
        </div>
      </div>
    </footer>
  )
}
