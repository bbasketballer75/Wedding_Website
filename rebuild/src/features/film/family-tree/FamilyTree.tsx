/**
 * Family tree, ported from the frozen
 * `src/components/family-tree/FamilyTree.tsx`.
 *
 * Structure, copy, class strings, animation values and the detail-modal markup
 * are the frozen oracle's; the party data now comes from
 * `contracts/content/party.json` through `filmContent.ts`, and the ordering
 * rules live in `familyTreeModel.ts` so they are unit-testable.
 */
import { AnimatePresence, motion } from 'framer-motion'
import { Heart, Sparkles, Users, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/shared/lib/cn'
import { Avatar } from '@/shared/ui/Avatar'
import { WEDDING_PARTY } from '../filmContent'
import { ConnectionLine } from './ConnectionLine'
import {
  allPartyPeople,
  chunkRows,
  orderBridesmaids,
  orderCouple,
  PARENT_GRID_STYLE,
} from './familyTreeModel'
import { PersonCard } from './PersonCard'

const BRIDE_PARENTS = WEDDING_PARTY.parents.filter(person => person.side === 'bride')
const GROOM_PARENTS = WEDDING_PARTY.parents.filter(person => person.side === 'groom')
const ALL_PEOPLE = allPartyPeople()
const ORDERED_COUPLE = orderCouple()
const BRIDESMAID_ROWS = chunkRows(orderBridesmaids())
const GROOMSMEN_ROWS = chunkRows(WEDDING_PARTY.groomsmen)

export function FamilyTree() {
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  const [hoveredSection, setHoveredSection] = useState<string | null>(null)

  const selectedPerson = ALL_PEOPLE.find(person => person.id === selectedPersonId) ?? null

  const toggleSelectedPerson = (personId: string) => {
    setSelectedPersonId(current => (current === personId ? null : personId))
  }

  const closeSelectedPerson = () => {
    setSelectedPersonId(null)
  }

  useEffect(() => {
    if (!selectedPerson) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedPersonId(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedPerson])

  return (
    <div className='mx-auto w-full max-w-6xl px-2 py-8 sm:px-3 sm:py-10 lg:px-4 lg:py-11'>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className='mb-10 text-center sm:mb-12'
      >
        <div className='mb-3 flex items-center justify-center gap-2'>
          <Users className='h-4 w-4 text-gold-500' />
          <span className='text-xs font-medium uppercase tracking-[0.3em] text-gold-600'>
            Family and friends
          </span>
        </div>
        <h2 className='font-display text-3xl text-charcoal-900 md:text-4xl'>
          The people woven into the film
        </h2>
        <p className='mx-auto mt-2 max-w-2xl text-sm text-charcoal-500'>
          The tree keeps things to first names up front. Tap a card to see the full name, role, and
          portrait.
        </p>
      </motion.div>

      <div className='relative'>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className='mx-auto mb-4 grid max-w-5xl gap-6 md:grid-cols-2 md:gap-x-8 lg:gap-x-12 xl:gap-x-16'
        >
          <div
            className='flex flex-col items-center'
            onMouseEnter={() => setHoveredSection('bride-parents')}
            onMouseLeave={() => setHoveredSection(null)}
          >
            <p className='mb-3 text-xs uppercase tracking-wider text-rose-500'>
              Bride&apos;s family
            </p>
            <div className='grid w-full gap-3 sm:gap-4' style={PARENT_GRID_STYLE}>
              {BRIDE_PARENTS.map((parent, index) => (
                <motion.div
                  key={parent.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className='min-w-0'
                >
                  <PersonCard
                    person={parent}
                    onClick={() => toggleSelectedPerson(parent.id)}
                    isSelected={selectedPersonId === parent.id}
                  />
                </motion.div>
              ))}
            </div>
            <ConnectionLine vertical animated={hoveredSection === 'bride-parents'} />
          </div>

          <div
            className='flex flex-col items-center'
            onMouseEnter={() => setHoveredSection('groom-parents')}
            onMouseLeave={() => setHoveredSection(null)}
          >
            <p className='mb-3 text-xs uppercase tracking-wider text-blue-500'>
              Groom&apos;s family
            </p>
            <div className='grid w-full gap-3 sm:gap-4' style={PARENT_GRID_STYLE}>
              {GROOM_PARENTS.map((parent, index) => (
                <motion.div
                  key={parent.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className='min-w-0'
                >
                  <PersonCard
                    person={parent}
                    onClick={() => toggleSelectedPerson(parent.id)}
                    isSelected={selectedPersonId === parent.id}
                  />
                </motion.div>
              ))}
            </div>
            <ConnectionLine vertical animated={hoveredSection === 'groom-parents'} />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, type: 'spring' }}
          className='relative mx-auto mb-6 grid w-full max-w-4xl grid-cols-2 items-center gap-x-6 sm:gap-x-8 lg:gap-x-12 xl:gap-x-16'
        >
          <div className='absolute left-1/2 top-0 h-6 w-px -translate-x-1/2 bg-gradient-to-b from-gold-300 to-transparent sm:h-7' />

          {ORDERED_COUPLE.map((person, index) => (
            <motion.div
              key={person.id}
              initial={{ opacity: 0, x: index === 0 ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + index * 0.1 }}
              className='relative w-full max-w-[16rem] justify-self-center sm:max-w-[18rem] lg:max-w-[19rem]'
            >
              <PersonCard
                person={person}
                isCenter
                onClick={() => toggleSelectedPerson(person.id)}
                isSelected={selectedPersonId === person.id}
              />
            </motion.div>
          ))}
          <motion.div
            animate={{ scale: [1, 1.18, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className='pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2'
          >
            <Heart className='h-6 w-6 fill-rose-400 text-rose-400' />
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className='grid gap-6 lg:grid-cols-2 lg:gap-8'
        >
          <div
            className='flex flex-col items-center'
            onMouseEnter={() => setHoveredSection('bridesmaids')}
            onMouseLeave={() => setHoveredSection(null)}
          >
            <ConnectionLine vertical animated={hoveredSection === 'bridesmaids'} />
            <p className='mb-3 mt-2 text-xs uppercase tracking-wider text-rose-500'>Bridesmaids</p>
            <div className='flex w-full flex-col items-center gap-3 sm:gap-4'>
              {BRIDESMAID_ROWS.map((row, rowIndex) => (
                <div
                  key={`bridesmaid-row-${rowIndex}`}
                  className='flex justify-center gap-3 sm:gap-4'
                >
                  {row.map((person, index) => (
                    <motion.div
                      key={person.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.9 + (rowIndex * 3 + index) * 0.08 }}
                      className='w-[10rem] shrink-0 sm:w-[11rem] lg:h-[15.5rem] lg:w-[9rem] xl:h-[16rem] xl:w-[10.5rem]'
                    >
                      <PersonCard
                        person={person}
                        isPartyCard
                        onClick={() => toggleSelectedPerson(person.id)}
                        isSelected={selectedPersonId === person.id}
                      />
                    </motion.div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div
            className='flex flex-col items-center'
            onMouseEnter={() => setHoveredSection('groomsmen')}
            onMouseLeave={() => setHoveredSection(null)}
          >
            <ConnectionLine vertical animated={hoveredSection === 'groomsmen'} />
            <p className='mb-3 mt-2 text-xs uppercase tracking-wider text-blue-500'>Groomsmen</p>
            <div className='flex w-full flex-col items-center gap-3 sm:gap-4'>
              {GROOMSMEN_ROWS.map((row, rowIndex) => (
                <div
                  key={`groomsmen-row-${rowIndex}`}
                  className='flex justify-center gap-3 sm:gap-4'
                >
                  {row.map((person, index) => (
                    <motion.div
                      key={person.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.9 + (rowIndex * 3 + index) * 0.08 }}
                      className='w-[10rem] shrink-0 sm:w-[11rem] lg:h-[15.5rem] lg:w-[9rem] xl:h-[16rem] xl:w-[10.5rem]'
                    >
                      <PersonCard
                        person={person}
                        isPartyCard
                        onClick={() => toggleSelectedPerson(person.id)}
                        isSelected={selectedPersonId === person.id}
                      />
                    </motion.div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {selectedPerson && (
              <>
                <motion.button
                  type='button'
                  aria-label='Close details'
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={closeSelectedPerson}
                  className='fixed inset-0 z-40 bg-charcoal-950/45 backdrop-blur-[2px]'
                />
                <motion.div
                  initial={{ opacity: 0, y: 24, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 24, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className='fixed left-1/2 top-1/2 z-50 w-[min(92vw,40rem)] -translate-x-1/2 -translate-y-1/2'
                >
                  <div className='relative rounded-[1.75rem] border border-gold-200/70 bg-white/95 px-6 py-6 text-center shadow-[0_28px_90px_-40px_rgba(21,20,19,0.5)] backdrop-blur-sm sm:px-8 sm:py-7'>
                    <button
                      type='button'
                      onClick={closeSelectedPerson}
                      className='absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-gold-200/80 bg-white text-charcoal-600 transition-colors hover:text-charcoal-900'
                      aria-label='Close details'
                    >
                      <X className='h-4 w-4' />
                    </button>
                    <div className='mb-3 flex items-center justify-center gap-2 text-gold-600'>
                      <Sparkles className='h-4 w-4' />
                      <span className='text-[10px] uppercase tracking-[0.28em]'>
                        {selectedPerson.side === 'bride' ? 'Bride side' : 'Groom side'}
                      </span>
                    </div>
                    <div className='mb-5 flex justify-center'>
                      <Avatar
                        src={selectedPerson.image}
                        alt={selectedPerson.fullName ?? selectedPerson.name}
                        fallback={selectedPerson.name}
                        size='xl'
                        imgStyle={{
                          transform: selectedPerson.mirrorImage
                            ? 'scaleX(-1.14) scaleY(1.14)'
                            : 'scale(1.14)',
                        }}
                        className={cn(
                          'h-28 w-28 border-2 text-xl sm:h-32 sm:w-32',
                          selectedPerson.side === 'bride' ? 'border-rose-300' : 'border-blue-300'
                        )}
                      />
                    </div>
                    <h3 className='font-display text-3xl text-charcoal-900'>
                      {selectedPerson.fullName ?? selectedPerson.name}
                    </h3>
                    <p className='mt-1 text-sm font-medium text-charcoal-600'>
                      {selectedPerson.role}
                    </p>
                    {selectedPerson.description && (
                      <p className='mt-4 text-sm leading-6 text-charcoal-600'>
                        {selectedPerson.description}
                      </p>
                    )}
                    {selectedPerson.funFact && (
                      <p className='mt-3 text-sm leading-6 text-charcoal-500'>
                        <span className='font-medium text-charcoal-700'>Fun fact:</span>{' '}
                        {selectedPerson.funFact}
                      </p>
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  )
}
