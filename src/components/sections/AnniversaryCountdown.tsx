import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Heart } from 'lucide-react'
import { WEDDING_DATE, COUPLE } from '@/config/weddingConfig'

const ANNIVERSARY_WINDOW_DAYS = 30

interface TimeUnit {
  value: number
  label: string
}

function getCountdownToNextAnniversary(now: Date): TimeUnit[] {
  const weddingMonth = WEDDING_DATE.getMonth()
  const weddingDay = WEDDING_DATE.getDate()
  const nextAnniversary = new Date(now.getFullYear(), weddingMonth, weddingDay)
  if (nextAnniversary <= now) {
    nextAnniversary.setFullYear(now.getFullYear() + 1)
  }
  const diffMs = nextAnniversary.getTime() - now.getTime()
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000)
  return [
    { value: days, label: days === 1 ? 'day' : 'days' },
    { value: hours, label: hours === 1 ? 'hour' : 'hours' },
    { value: minutes, label: minutes === 1 ? 'minute' : 'minutes' },
    { value: seconds, label: seconds === 1 ? 'second' : 'seconds' },
  ]
}

function getElapsedTime(now: Date): { years: number; days: number } {
  const diffMs = now.getTime() - WEDDING_DATE.getTime()
  const years = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25))
  const remainingMs = diffMs - years * 365.25 * 24 * 60 * 60 * 1000
  const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24))
  return { years, days }
}

function isDaysBeforeAnniversary(now: Date): boolean {
  const weddingMonth = WEDDING_DATE.getMonth()
  const weddingDay = WEDDING_DATE.getDate()
  const nextAnniversary = new Date(now.getFullYear(), weddingMonth, weddingDay)
  if (nextAnniversary <= now) {
    nextAnniversary.setFullYear(now.getFullYear() + 1)
  }
  const diffDays = (nextAnniversary.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  return diffDays <= ANNIVERSARY_WINDOW_DAYS
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

export function AnniversaryCountdown() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

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
              {anniversaryNumber === 1
                ? '1st'
                : anniversaryNumber === 2
                  ? '2nd'
                  : anniversaryNumber === 3
                    ? '3rd'
                    : `${anniversaryNumber}th`}{' '}
              anniversary
            </p>
            <Heart className='h-4 w-4 text-gold-500 fill-gold-500' />
          </div>
          <h2 className='font-display text-2xl text-charcoal-800 sm:text-3xl mb-8'>
            Counting down to {COUPLE.person1.name} &amp; {COUPLE.person2.name}'s anniversary
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
