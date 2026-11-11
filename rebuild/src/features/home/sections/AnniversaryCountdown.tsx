import { motion } from 'framer-motion'
import { Heart } from 'lucide-react'
import { useEffect, useState } from 'react'
import { COUPLE, WEDDING_DATE } from '../content/wedding'
import {
  formatAnniversaryNumber,
  getCountdownToNextAnniversary,
  getElapsedTime,
  isDaysBeforeAnniversary,
  type TimeUnit,
} from '../lib/countdown'

export interface AnniversaryCountdownProps {
  /**
   * Injected clock for deterministic rendering (tests, snapshots). When
   * provided the component does not start its 1s interval; the frozen
   * component always used the live clock.
   */
  now?: Date
}

function CountdownUnit({ value, label, pulse }: TimeUnit & { pulse?: boolean }) {
  return (
    <div className='flex flex-col items-center gap-1'>
      <motion.span
        key={value}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={`font-display text-3xl text-gold-600 sm:text-4xl${pulse ? ' animate-pulse-soft' : ''}`}
      >
        {String(value).padStart(2, '0')}
      </motion.span>
      <span className='text-[10px] uppercase tracking-widest text-charcoal-500'>{label}</span>
    </div>
  )
}

/**
 * Frozen `src/components/sections/AnniversaryCountdown.tsx`: before the
 * 30-day anniversary window it counts down (anniversary ordinal + units), after
 * it shows the elapsed married time. The only delta is the injectable `now`
 * clock for deterministic tests; the live interval semantics are unchanged.
 */
export function AnniversaryCountdown({ now: injectedNow }: AnniversaryCountdownProps) {
  const [clock, setClock] = useState(() => injectedNow ?? new Date())

  useEffect(() => {
    if (injectedNow) return
    const id = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(id)
  }, [injectedNow])

  const now = injectedNow ?? clock
  const showCountdown = isDaysBeforeAnniversary(now)

  if (showCountdown) {
    const units = getCountdownToNextAnniversary(now)
    const nextAnniversaryYear = (() => {
      const d = new Date(now.getFullYear(), WEDDING_DATE.getMonth(), WEDDING_DATE.getDate())
      return d <= now ? d.getFullYear() + 1 : d.getFullYear()
    })()
    const anniversaryNumber = nextAnniversaryYear - WEDDING_DATE.getFullYear()

    return (
      <section className='py-16 sm:py-24 text-center px-4'>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className='mx-auto max-w-xl'
        >
          <div className='flex items-center justify-center gap-2 mb-4'>
            <Heart className='h-4 w-4 text-gold-500 fill-gold-500' />
            <p className='text-sm uppercase tracking-[0.2em] text-charcoal-500'>
              {formatAnniversaryNumber(anniversaryNumber)} anniversary
            </p>
            <Heart className='h-4 w-4 text-gold-500 fill-gold-500' />
          </div>
          <h2 className='font-display text-2xl text-charcoal-800 sm:text-3xl mb-8'>
            Counting down to {COUPLE.person1.name} &amp; {COUPLE.person2.name}&apos;s anniversary
          </h2>
          <div className='flex justify-center gap-6 sm:gap-10'>
            {units.map((unit, index) => (
              <CountdownUnit key={unit.label} {...unit} pulse={index === 3} />
            ))}
          </div>
        </motion.div>
      </section>
    )
  }

  const { years, days } = getElapsedTime(now)
  return (
    <section className='py-16 sm:py-24 text-center px-4'>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className='mx-auto max-w-xl'
      >
        <div className='flex items-center justify-center gap-2 mb-4'>
          <Heart className='h-4 w-4 text-gold-500 fill-gold-500' />
          <p className='text-sm uppercase tracking-[0.2em] text-charcoal-500'>married</p>
          <Heart className='h-4 w-4 text-gold-500 fill-gold-500' />
        </div>
        <p className='font-display text-4xl text-charcoal-800 sm:text-5xl'>
          {years > 0 && (
            <>
              {years} {years === 1 ? 'year' : 'years'}
              {days > 0 ? ', ' : ''}
            </>
          )}
          {days > 0 && (
            <>
              {days} {days === 1 ? 'day' : 'days'}
            </>
          )}
          {years === 0 && days === 0 && 'Today!'}
        </p>
        <p className='mt-3 text-charcoal-500'>
          {COUPLE.person1.name} &amp; {COUPLE.person2.name} · May 10, 2025
        </p>
      </motion.div>
    </section>
  )
}
