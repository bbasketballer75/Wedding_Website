'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion'
import { Ghost, Sparkles, Volume2, VolumeX } from 'lucide-react'

import { cn } from '@/lib/utils'

export function HalloweenEngagement() {
  const [isSpooky, setIsSpooky] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(false)
  const sectionRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"]
  })

  // Trigger spooky mode when section is in view
  const spookyTrigger = useTransform(scrollYProgress, [0.2, 0.4], [0, 1])

  useEffect(() => {
    const unsubscribe = spookyTrigger.on("change", (value) => {
      if (value > 0.5 && !isSpooky) {
        setIsSpooky(true)
        if (audioRef.current && audioEnabled) {
          audioRef.current.play().catch(() => {})
        }
      } else if (value < 0.3 && isSpooky) {
        setIsSpooky(false)
        if (audioRef.current) {
          audioRef.current.pause()
          audioRef.current.currentTime = 0
        }
      }
    })
    return () => unsubscribe()
  }, [spookyTrigger, isSpooky, audioEnabled])

  const toggleSpooky = () => {
    setIsSpooky(!isSpooky)
    if (!isSpooky && audioRef.current && audioEnabled) {
      audioRef.current.play().catch(() => {})
    } else if (isSpooky && audioRef.current) {
      audioRef.current.pause()
    }
  }

  // Store floating element values - generated once on mount
  const [floatingElements] = useState<Array<{ yStart: number; yEnd: number; duration: number }>>(() =>
    [...Array(8)].map((_, i) => ({
      yStart: (i * 37) % 300,
      yEnd: ((i * 53) % 300) + 50,
      duration: 8 + ((i * 1.3) % 4),
    }))
  )

  return (
    <>
      <section 
        ref={sectionRef}
        className="relative min-h-[80vh] py-24 overflow-hidden"
      >
        {/* Background Transition */}
        <motion.div 
          animate={{ 
            backgroundColor: isSpooky ? "#1a0f2e" : "#faf9f7"
          }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0"
        >
          {/* Normal Background Pattern */}
          <div className={cn(
            "absolute inset-0 opacity-20 transition-opacity duration-500",
            isSpooky ? "opacity-0" : "opacity-100"
          )}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(212,175,55,0.1)_0%,transparent_70%)]" />
          </div>

          {/* Spooky Background */}
          <AnimatePresence>
            {isSpooky && (
              <>
                {/* Dark overlay */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-gradient-to-b from-purple-900/80 via-gray-900/90 to-black/95"
                />
                
                {/* Lightning effect */}
                <motion.div
                  animate={{ 
                    opacity: [0, 0.3, 0, 0.1, 0],
                  }}
                  transition={{ 
                    duration: 3,
                    repeat: Infinity,
                    repeatDelay: 4,
                    times: [0, 0.1, 0.2, 0.3, 1]
                  }}
                  className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-transparent"
                />

                {/* Floating bats and ghosts */}
                {floatingElements.map((el, i) => (
                  <motion.div
                    key={`spooky-${i}`}
                    initial={{ opacity: 0, x: -100 }}
                    animate={{ 
                      opacity: [0.4, 0.8, 0.4],
                      x: ["0vw", "100vw"],
                      y: [el.yStart, el.yEnd]
                    }}
                    transition={{ 
                      duration: el.duration,
                      repeat: Infinity,
                      delay: i * 0.5,
                      ease: "linear"
                    }}
                    className="absolute text-4xl"
                    style={{ top: `${10 + i * 10}%` }}
                  >
                    {['🦇', '👻', '⚡', '🕷️'][i % 4]}
                  </motion.div>
                ))}

                {/* Pumpkin border */}
                <div className="absolute bottom-0 left-0 right-0 flex justify-around text-4xl opacity-60">
                  {[...Array(12)].map((_, i) => (
                    <motion.span
                      key={i}
                      animate={{ 
                        scale: [1, 1.1, 1],
                        rotate: [-5, 5, -5]
                      }}
                      transition={{ 
                        duration: 2,
                        repeat: Infinity,
                        delay: i * 0.1
                      }}
                    >
                      🎃
                    </motion.span>
                  ))}
                </div>
              </>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Content */}
        <div className="relative z-10 max-w-4xl mx-auto px-4">
          {/* Spooky Toggle Button */}
          <motion.div 
            className="absolute top-8 right-8"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <button
              onClick={toggleSpooky}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300",
                isSpooky 
                  ? "bg-orange-500/80 text-white shadow-[0_0_20px_rgba(234,88,12,0.5)]"
                  : "bg-charcoal-800/80 text-white hover:bg-charcoal-700"
              )}
            >
              {isSpooky ? <Ghost className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              <span className="text-xs uppercase tracking-wider">
                {isSpooky ? "Too Spooky!" : "Make it Spooky 🎃"}
              </span>
            </button>
          </motion.div>

          {/* Audio Toggle */}
          <motion.div 
            className="absolute top-8 left-8"
            whileHover={{ scale: 1.05 }}
          >
            <button
              onClick={() => setAudioEnabled(!audioEnabled)}
              className={cn(
                "p-2 rounded-full transition-all",
                audioEnabled 
                  ? "bg-green-500/20 text-green-400"
                  : "bg-white/10 text-white/60"
              )}
            >
              {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </motion.div>

          {/* Hidden Audio Element */}
          <audio
            ref={audioRef}
            loop
            src="/audio/spooky-ambience.mp3"
          >
            <track
              kind="captions"
              srcLang="en"
              label="Ambient audio description"
              src="data:text/vtt;charset=utf-8,WEBVTT%0A%0A00:00.000%20--%3E%2099:59.000%0ASpooky%20ambient%20audio."
            />
          </audio>

          {/* Main Content */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            {/* Date */}
            <motion.div
              animate={{ 
                color: isSpooky ? "#fb923c" : "#d4af37"
              }}
              className="flex items-center justify-center gap-2 mb-6"
            >
              <span className="text-2xl">🎃</span>
              <span className="text-sm uppercase tracking-[0.3em] font-medium">
                October 31, 2022
              </span>
              <span className="text-2xl">🎃</span>
            </motion.div>

            {/* Title */}
            <motion.h2
              animate={{ 
                color: isSpooky ? "#fb923c" : "#1a1a1a"
              }}
              className="font-display text-4xl md:text-6xl mb-6"
            >
              The Proposal
            </motion.h2>

            {/* Costumes */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-6xl md:text-8xl mb-8"
            >
              <motion.span
                animate={isSpooky ? {
                  x: [-2, 2, -2],
                  rotate: [-2, 2, -2]
                } : {}}
                transition={{ duration: 0.2, repeat: Infinity }}
              >
                🧟
              </motion.span>
              <span className={cn(
                "mx-4 transition-colors duration-500",
                isSpooky ? "text-orange-400" : "text-gold-500"
              )}>⚡</span>
              <motion.span
                animate={isSpooky ? {
                  x: [2, -2, 2],
                  rotate: [2, -2, 2]
                } : {}}
                transition={{ duration: 0.2, repeat: Infinity }}
              >
                👰‍♀️
              </motion.span>
            </motion.div>

            {/* Story */}
            <motion.p
              animate={{ 
                color: isSpooky ? "#e5e5e5" : "#4a4a4a"
              }}
              className="text-lg md:text-xl leading-relaxed mb-8 max-w-2xl mx-auto"
            >
              On the spookiest night of the year, our love story took a monstrous turn. 
              Dressed as Frankenstein&apos;s Monster and his Bride, under a full moon and surrounded 
              by Halloween magic, Austin asked Jordyn to be his forever. 
              <br /><br />
              <span className={cn(
                "font-medium transition-colors duration-500",
                isSpooky ? "text-orange-400" : "text-gold-600"
              )}>
                She said YES! 💍
              </span>
            </motion.p>

            {/* Special Note */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className={cn(
                "inline-flex items-center gap-2 px-6 py-3 rounded-full transition-all duration-500",
                isSpooky 
                  ? "bg-purple-500/20 border border-purple-400/30 text-purple-200"
                  : "bg-gold-50 border border-gold-200 text-charcoal-600"
              )}
            >
              <span>🎂</span>
              <span className="text-sm">
                Also Happy Birthday to Jordyn&apos;s dad! Halloween is extra special for our family.
              </span>
            </motion.div>
          </motion.div>
        </div>

        {/* Bottom Transition */}
        <div className={cn(
          "absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t transition-colors duration-500",
          isSpooky 
            ? "from-cream-50 to-transparent"
            : "from-cream-50 to-transparent"
        )} />
      </section>
    </>
  )
}
