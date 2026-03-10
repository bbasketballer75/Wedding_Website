import { useState, useEffect, useRef } from 'react'
import { motion, useScroll, useTransform, useMotionValueEvent } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Play, Images, Heart, BookHeart, ChevronDown } from 'lucide-react'
import { LoveTimeline } from '@/components/timeline/LoveTimeline'

import { cn } from '@/lib/utils'
import { getMediaPath } from '@/utils/media'

// Nav item component
function NavItem({ 
  to, 
  icon: Icon, 
  label, 
  isPrimary = false,
  scrolled = false
}: { 
  to: string
  icon: React.ElementType
  label: string
  isPrimary?: boolean
  scrolled?: boolean
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-2 px-4 py-2.5 rounded-full text-xs uppercase tracking-wider transition-all duration-300",
        isPrimary 
          ? scrolled ? "text-gold-500 hover:text-gold-600 font-medium" : "text-gold-400 hover:text-gold-300 font-medium"
          : scrolled ? "text-charcoal-700 hover:text-charcoal-900 hover:bg-charcoal-100" : "text-white/80 hover:text-white hover:bg-white/10"
      )}
    >
      <Icon className={cn("w-4 h-4", isPrimary && !scrolled && "fill-gold-400/20")} />
      <span>{label}</span>
    </Link>
  )
}

export default function Home() {
  const [showUI, setShowUI] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const heroRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const { scrollY } = useScroll()
  const heroOpacity = useTransform(scrollY, [0, 500], [1, 0])
  const heroScale = useTransform(scrollY, [0, 500], [1, 1.1])
  
  // Track scroll position for section transitions
  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 100)
  })

  useEffect(() => {
    const timer = setTimeout(() => setShowUI(true), 1200)
    return () => clearTimeout(timer)
  }, [])

  const scrollToContent = () => {
    document.getElementById('content')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-cream-50">
      {/* Sticky Nav Bar - Always Visible */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: showUI ? 1 : 0, y: showUI ? 0 : -20 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="fixed top-6 left-1/2 -translate-x-1/2 z-50"
      >
        <motion.div 
          className={cn(
            "flex items-center px-2 py-2 rounded-full transition-all duration-500",
            scrolled 
              ? "bg-gradient-to-r from-cream-100/95 via-gold-50/95 to-cream-100/95 backdrop-blur-md border border-gold-300/50 shadow-lg" 
              : "bg-charcoal-950/90 backdrop-blur-md border border-white/20 shadow-2xl"
          )}
        >
          {/* Logo */}
          <Link 
            to="/" 
            className={cn(
              "font-display text-xl px-4 py-2 transition-colors",
              scrolled ? "text-charcoal-900 hover:text-gold-600" : "text-white hover:text-gold-400"
            )}
          >
            <span className="text-gold-500">A</span>&<span className="text-gold-500">J</span>
          </Link>
          
          <div className={cn("w-px h-5", scrolled ? "bg-charcoal-200" : "bg-white/20")} />
          
          {/* Nav Items */}
          <NavItem to="/film" icon={Play} label="Watch Film" isPrimary scrolled={scrolled} />
          
          <div className={cn("w-px h-5", scrolled ? "bg-charcoal-200" : "bg-white/20")} />
          
          <NavItem to="/gallery" icon={Images} label="Gallery" scrolled={scrolled} />
          
          <div className={cn("w-px h-5", scrolled ? "bg-charcoal-200" : "bg-white/20")} />
          
          <NavItem to="/guestbook" icon={BookHeart} label="Guestbook" scrolled={scrolled} />
          
          <div className={cn("w-px h-5", scrolled ? "bg-charcoal-200" : "bg-white/20")} />
          
          <NavItem to="/upload" icon={Heart} label="Share" scrolled={scrolled} />
        </motion.div>
      </motion.nav>

      {/* Hero Section */}
      <section ref={heroRef} className="relative h-screen w-full overflow-hidden">
        {/* Video Background */}
        <motion.div 
          style={{ opacity: heroOpacity, scale: heroScale }}
          className="absolute inset-0"
        >
          <video
            autoPlay
            muted
            loop
            playsInline
            poster="/images/engagement/PoradaProposal-29.webp"
            className="w-full h-full object-cover"
          >
            <source src={getMediaPath('/video/optimized_background.mp4')} type="video/mp4" />
          </video>
        </motion.div>

        {/* Explore Button - Fixed at bottom of hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: showUI ? 1 : 0, y: showUI ? 0 : 20 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          style={{ opacity: heroOpacity }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
        >
          <motion.button
            onClick={scrollToContent}
            whileHover={{ scale: 1.05, y: -5 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-charcoal-950/90 backdrop-blur-md border border-white/20 shadow-xl text-white/80 hover:text-gold-400 transition-colors"
          >
            <span className="text-[10px] uppercase tracking-widest">Explore</span>
            <motion.div
              animate={{ y: [0, 3, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              <ChevronDown className="w-4 h-4" />
            </motion.div>
          </motion.button>
        </motion.div>
      </section>

      {/* Welcome Section - Subtle gradient shift */}
      <section id="content" className="relative py-20 px-4 bg-gradient-to-b from-cream-50 via-cream-100 to-cream-50 overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0 }}
              whileInView={{ opacity: 0.03, scale: 1 }}
              transition={{ delay: i * 0.3, duration: 1 }}
              className="absolute text-gold-500"
              style={{
                left: `${15 + i * 35}%`,
                top: `${5 + i * 25}%`,
              }}
            >
              <Heart className="w-32 h-32 fill-current" />
            </motion.div>
          ))}
          
          {/* Subtle gradient orb */}
          <motion.div
            animate={{ 
              x: [0, 100, 0],
              y: [0, 50, 0],
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute w-96 h-96 bg-gold-200/20 rounded-full blur-3xl -top-20 -right-20"
          />
        </div>

        <div className="max-w-3xl mx-auto text-center relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="flex items-center justify-center gap-2 mb-4"
          >
            <motion.span 
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="text-gold-500"
            >
              ✦
            </motion.span>
            <span className="text-gold-600 text-xs uppercase tracking-[0.3em] font-medium">
              Welcome to Our Wedding Hub
            </span>
            <motion.span 
              animate={{ rotate: [0, -360] }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="text-gold-500"
            >
              ✦
            </motion.span>
          </motion.div>
          
          <motion.p 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-charcoal-600 text-base md:text-lg leading-relaxed mb-10"
          >
            Relive every moment of our special day. Watch our wedding film, browse through 
            hundreds of professional photos, read messages from loved ones, and share your 
            own photos to help us complete the story.
          </motion.p>

          {/* Stats Grid */}
          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-6"
          >
            {[
              { number: '42', label: 'Minute Film' },
              { number: '247', label: 'Photos' },
              { number: '100+', label: 'Guest Messages' },
              { number: '∞', label: 'Memories' },
            ].map((item, index) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 30, scale: 0.8 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{ 
                  duration: 0.5, 
                  delay: 0.3 + index * 0.1,
                  type: "spring",
                  stiffness: 100
                }}
                whileHover={{ scale: 1.1 }}
                className="text-center p-4 rounded-2xl hover:bg-white/50 transition-colors cursor-pointer"
              >
                <p className="font-display text-3xl md:text-4xl text-gold-600">{item.number}</p>
                <p className="text-charcoal-500 text-xs uppercase tracking-wider mt-1">{item.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Timeline Section - Love Story */}
      <LoveTimeline />
    </div>
  )
}
