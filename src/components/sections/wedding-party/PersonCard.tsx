import { motion, Variants } from 'framer-motion'
import { WeddingPartyPerson } from '@/data/weddingParty'
import React from 'react'

type CardSize = 'large' | 'normal' | 'small'

interface PersonCardProps {
  person: WeddingPartyPerson
  size?: CardSize
  onClick: (person: WeddingPartyPerson) => void
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 50, damping: 20 },
  },
}

const PersonCard = React.memo(({ person, size = 'normal', onClick }: PersonCardProps) => {
  const textSize: Record<CardSize, { name: string; role: string; container: string }> = {
    large: {
      name: 'text-3xl md:text-5xl',
      role: 'text-sm tracking-[0.4em]',
      container: 'max-w-[340px]',
    },
    normal: {
      name: 'text-2xl',
      role: 'text-[10px] md:text-xs tracking-[0.4em]',
      container: 'max-w-[280px]',
    },
    small: { name: 'text-xl', role: 'text-[0.6rem] tracking-[0.3em]', container: 'max-w-[240px]' },
  }

  const t = textSize[size]

  return (
    <motion.div
      variants={itemVariants}
      whileHover={{ y: -12, scale: 1.02 }}
      onClick={() => onClick(person)}
      className={`relative group cursor-pointer ${t.container} mx-auto will-change-transform`}
    >
      {/* Photo Container - Using SVG Mask to force-crop the baked-in white borders */}
      <div className='relative w-full aspect-square mb-6 transition-transform duration-500'>
        <svg
          className='w-full h-full drop-shadow-sm'
          viewBox='0 0 100 100'
          xmlns='http://www.w3.org/2000/svg'
        >
          <defs>
            <clipPath id={`circleClip-${person.id || person.name.replace(/\s+/g, '-')}`}>
              <circle cx='50' cy='50' r='48.5' />
            </clipPath>
          </defs>

          {/* Background Circle */}
          <circle cx='50' cy='50' r='49' fill='#e5e5e5' />

          {/* The Image - Scaled up to 135% to crop out baked-in borders */}
          {person.image ? (
            <image
              href={person.image}
              x='-4'
              y='-2'
              width='108'
              height='108'
              preserveAspectRatio='xMidYMid slice'
              clipPath={`url(#circleClip-${person.id || person.name.replace(/\s+/g, '-')})`}
              className='transition-transform duration-1000 group-hover:scale-110 origin-center'
            />
          ) : (
            <text
              x='50'
              y='50'
              textAnchor='middle'
              dy='.3em'
              fontSize='40'
              fill='rgba(212,175,55,0.2)'
              fontFamily='serif'
            >
              {person.name.charAt(0)}
            </text>
          )}

          {/* The Ring Border */}
          <circle
            cx='50'
            cy='50'
            r='48.5'
            fill='none'
            stroke={person.side === 'groom' ? '#d4af37' : '#f9dbe2'}
            strokeWidth='3'
            vectorEffect='non-scaling-stroke'
            className='pointer-events-none'
          />
        </svg>
      </div>

      {/* Text Info */}
      <div className='text-center relative z-10'>
        <h4
          className={`font-display ${t.name} text-dark-900 mb-3 font-medium tracking-tight transition-colors duration-300 group-hover:text-gold-600 drop-shadow-sm`}
        >
          {person.name}
        </h4>
        <div className='flex items-center justify-center gap-4 opacity-70 group-hover:opacity-100 transition-opacity duration-300'>
          <div className='h-px w-6 bg-gold-400/50 group-hover:w-12 transition-all duration-500' />
          <p className={`uppercase text-gold-700 font-bold ${t.role}`}>{person.role}</p>
          <div className='h-px w-6 bg-gold-400/50 group-hover:w-12 transition-all duration-500' />
        </div>
      </div>
    </motion.div>
  )
})

PersonCard.displayName = 'PersonCard'

export default PersonCard
