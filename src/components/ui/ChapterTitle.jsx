import React from 'react'
import { motion } from 'framer-motion'
import RevealText from './RevealText'

const ChapterTitle = ({ chapter, title, subtitle, theme = 'dark' }) => {
  const isDark = theme === 'dark'

  return (
    <div className='w-full text-center py-10 md:py-12 relative overflow-hidden'>
      {/* Decorative Background Accent - Script Font */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 0.04, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.5, ease: 'easeOut' }}
        className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-script text-[15rem] md:text-[20rem] whitespace-nowrap pointer-events-none -z-10 will-change-opacity'
        style={{ color: isDark ? 'white' : 'var(--color-gold-500)' }}
      >
        Our Journey
      </motion.div>

      <div className='w-full max-w-4xl mx-auto px-6 relative z-10'>
        {/* Chapter Label - Grand Header */}
        <div className='flex items-center justify-center gap-6 mb-4'>
          <motion.div
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            className='h-px w-8 md:w-12 bg-linear-to-r from-transparent to-(--color-gold-500)'
          />
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className={`font-display text-base md:text-lg tracking-[0.5em] uppercase text-gold-600 font-bold`}
          >
            {chapter}
          </motion.span>
          <motion.div
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            className='h-px w-8 md:w-12 bg-linear-to-l from-transparent to-(--color-gold-500)'
          />
        </div>

        {/* Main Title - Grand Serif Display (High Contrast Fix) */}
        <RevealText
          className={`font-script text-6xl md:text-8xl lg:text-9xl tracking-normal leading-none mb-4 md:mb-6 text-dark-950 py-4`}
        >
          {title}
        </RevealText>

        {/* Minimal Divider (Line Only) */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          whileInView={{ scaleX: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.3 }}
          className='flex items-center justify-center mb-6'
        >
          <div className='h-px w-24 md:w-48 bg-linear-to-r from-transparent via-(--color-gold-500) to-transparent opacity-40' />
        </motion.div>

        {/* Subtitle - Elegant Italics */}
        {subtitle && (
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 0.8 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.5 }}
            className={`font-body italic text-base md:text-lg lg:text-xl leading-relaxed text-dark-800/80 text-center max-w-2xl mx-auto`}
          >
            {subtitle}
          </motion.p>
        )}
      </div>
    </div>
  )
}

export default ChapterTitle
