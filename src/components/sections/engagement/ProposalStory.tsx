import React from 'react'
import { motion } from 'framer-motion'
import { type StoryContent } from '@/data/engagement'

interface ProposalStoryProps {
  content: StoryContent
  children?: React.ReactNode
}

const ProposalStory: React.FC<ProposalStoryProps> = ({ content, children }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, delay: 0.2 }}
      className='glass-panel bg-dark-900/60 rounded-[2rem] p-12 max-w-5xl mx-auto mb-20 shadow-glass border-white/5 backdrop-blur-xl'
    >
      <div className='grid grid-cols-1 md:grid-cols-2 gap-16 items-center'>
        <div>
          <h3 className='font-display text-4xl mb-6 font-light tracking-wide text-gradient-gold'>
            {content.date}
          </h3>
          {content.text.map((paragraph, index) => (
            <p
              key={index}
              className='text-cream-100/90 leading-relaxed mb-6 font-body text-lg font-light'
            >
              {paragraph}
            </p>
          ))}
          <p className='text-gold-400 font-display text-3xl italic tracking-wide mt-8'>
            {content.finale}
          </p>
        </div>

        {/* Second Column: The Photo */}
        <div className='flex justify-center relative'>
          <div className='absolute inset-0 bg-gold-500/5 blur-[60px] rounded-full pointer-events-none' />
          <div className='relative z-10 glass-card p-4 rounded-2xl rotate-2 hover:rotate-0 transition-transform duration-700'>
            {children}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default ProposalStory
