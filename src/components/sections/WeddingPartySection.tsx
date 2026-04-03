import React, { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { partyData, WeddingPartyPerson } from '@/data/weddingParty'
import PersonCard from './wedding-party/PersonCard'
import PartyMemberModal from './wedding-party/PartyMemberModal'
import ChapterTitle from '@/components/ui/ChapterTitle'

interface SectionTitleProps {
  children: React.ReactNode
}

// Section Title Component
const SectionTitle = ({ children }: SectionTitleProps) => (
  <div className='text-center mb-16 mt-24 relative'>
    <h3 className='font-display text-4xl md:text-5xl text-dark-900 font-light tracking-tight'>
      {children}
    </h3>
    <div className='w-16 h-px bg-linear-to-r from-transparent via-gold-500 to-transparent mx-auto mt-6' />
  </div>
)

const WeddingParty = () => {
  const containerRef = useRef<HTMLElement>(null)
  const [selectedMember, setSelectedMember] = useState<WeddingPartyPerson | null>(null)
  const { couple, parents, groomsmen, bridesmaids } = partyData

  return (
    <section
      id='wedding-party'
      ref={containerRef}
      className='relative pt-12 pb-24 bg-cream-50 overflow-hidden'
    >
      {/* Background Texture */}
      <div className='absolute inset-0 opacity-[0.02] pointer-events-none will-change-transform' style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} />

      {/* Soft Glow */}
      <div className='absolute top-0 right-0 w-[40vw] h-[40vw] bg-gold-400/5 rounded-full blur-[80px] pointer-events-none will-change-transform' />

      <div className='container-custom max-w-[1400px] mx-auto relative z-10'>
        {/* Main Header */}
        <div className='mb-20'>
          <ChapterTitle
            chapter='Chapter Three'
            title='The Wedding Party'
            subtitle='The friends and family who stand beside us.'
            theme='light'
          />
        </div>

        {/* 1. The Happy Couple */}
        <motion.div
          initial='hidden'
          whileInView='visible'
          viewport={{ once: true, margin: '-50px' }}
          variants={{
            visible: { transition: { staggerChildren: 0.05 } },
          }}
          className='flex flex-col md:flex-row justify-center items-center gap-6 md:gap-12 mb-32'
        >
          {couple.map(person => (
            <PersonCard key={person.id} person={person} size='large' onClick={setSelectedMember} />
          ))}
        </motion.div>

        {/* 2. Parents */}
        <div className='relative'>
          {/* Vertical Line Connector */}
          <div className='absolute -top-16 left-1/2 -translate-x-1/2 w-px h-16 bg-linear-to-b from-transparent via-gold-300 to-gold-400/30' />

          <SectionTitle>Parents</SectionTitle>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-16 justify-items-center relative z-10'
          >
            {parents.map(person => (
              <div key={person.id} className='relative group'>
                <PersonCard person={person} size='small' onClick={setSelectedMember} />
              </div>
            ))}
          </motion.div>
        </div>

        {/* 3. The Party */}
        <SectionTitle>The Wedding Party</SectionTitle>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-20 md:gap-32'>
          {/* Groomsmen Column */}
          <div className='flex flex-col items-center'>
            <h4 className='font-display text-3xl text-gold-700 mb-12 font-light tracking-wide'>
              Groom's Party
            </h4>
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className='grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-12 w-full justify-items-center'
            >
              {groomsmen.map(person => (
                <PersonCard
                  key={person.id}
                  person={person}
                  size='normal'
                  onClick={setSelectedMember}
                />
              ))}
            </motion.div>
          </div>

          {/* Bridesmaids Column */}
          <div className='flex flex-col items-center'>
            <h4 className='font-display text-3xl text-gold-700 mb-12 font-light tracking-wide'>
              Bride's Party
            </h4>
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className='grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-12 w-full justify-items-center'
            >
              {bridesmaids.map(person => (
                <PersonCard
                  key={person.id}
                  person={person}
                  size='normal'
                  onClick={setSelectedMember}
                />
              ))}
            </motion.div>
          </div>
        </div>
      </div>

      <PartyMemberModal selectedMember={selectedMember} onClose={() => setSelectedMember(null)} />
    </section>
  )
}

export default WeddingParty
