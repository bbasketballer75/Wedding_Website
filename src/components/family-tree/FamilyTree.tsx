import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Avatar } from '@/components/ui/Avatar'
import { Heart, Users, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { partyData, type WeddingPartyPerson } from '@/data/weddingParty'

function PersonCard({
  person,
  isCenter = false,
  isPartyCard = false,
  onClick,
  isSelected,
}: {
  person: WeddingPartyPerson
  isCenter?: boolean
  isPartyCard?: boolean
  onClick?: () => void
  isSelected?: boolean
}) {
  const isBride = person.side === 'bride'
  const imageScale = isCenter ? 1.16 : isPartyCard ? 1.14 : 1.15

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={cn(
        'relative group cursor-pointer rounded-2xl text-left'
      )}
    >
      <div
        className={cn(
          'absolute inset-0 rounded-full blur-xl opacity-0 transition-opacity duration-500 group-hover:opacity-35',
          isBride ? 'bg-rose-400' : 'bg-blue-400'
        )}
      />

      <div
        className={cn(
          'relative flex flex-col items-center rounded-[1.75rem] p-4 transition-colors duration-200 sm:p-5',
          isCenter
            ? 'min-w-[9.5rem] px-5 py-5 sm:min-w-[11.75rem] sm:px-7 sm:py-7 lg:min-w-[13rem] lg:px-8 lg:py-8'
            : isPartyCard
              ? 'min-w-[7.5rem] px-4 py-4 sm:min-w-[8.75rem] sm:px-5 sm:py-5 lg:min-w-[9.75rem] lg:px-6 lg:py-6'
              : 'min-w-[8.5rem] px-4 py-5 sm:min-w-[10rem] lg:min-w-[11.5rem]',
          isCenter
            ? 'bg-gradient-to-br from-gold-100 to-gold-200 shadow-lg'
            : 'bg-white/92 shadow-soft backdrop-blur-sm hover:bg-white',
          isSelected && 'ring-2 ring-gold-400'
        )}
      >
        <div className="relative">
          <Avatar
            src={person.image}
            alt={person.fullName ?? person.name}
            fallback={person.name}
            size={isCenter ? 'xl' : 'lg'}
            imgStyle={{
              transform: person.mirrorImage
                ? `scaleX(-${imageScale}) scaleY(${imageScale})`
                : `scale(${imageScale})`,
            }}
            className={cn(
              'border-2 object-center',
              isCenter ? 'h-28 w-28 text-lg sm:h-36 sm:w-36 sm:text-xl lg:h-40 lg:w-40' : isPartyCard ? 'h-20 w-20 text-base sm:h-24 sm:w-24 sm:text-lg lg:h-28 lg:w-28 lg:text-xl' : 'h-22 w-22 text-lg sm:h-26 sm:w-26 sm:text-xl lg:h-28 lg:w-28',
              isBride ? 'border-rose-300' : 'border-blue-300',
              isCenter && 'border-gold-400'
            )}
          />
        </div>

        <div className="mt-4 text-center">
          <p
            className={cn(
              'font-display font-medium',
              isCenter ? 'text-[1.65rem] leading-none text-charcoal-900 sm:text-[2rem] lg:text-[2.15rem]' : isPartyCard ? 'text-base text-charcoal-800 sm:text-lg lg:text-[1.3rem]' : 'text-lg text-charcoal-800 sm:text-xl'
            )}
          >
            {person.name}
          </p>
          {!isCenter && (
            <p className={cn('mt-1.5 leading-5 text-charcoal-500', isPartyCard ? 'text-xs sm:text-[13px] lg:text-sm' : 'text-sm')}>
              {person.role}
            </p>
          )}
        </div>

      </div>
    </motion.button>
  )
}

function ConnectionLine({
  vertical = false,
  animated = false,
}: {
  vertical?: boolean
  animated?: boolean
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden',
        vertical ? 'my-2 h-8 w-px' : 'mx-2 h-px w-16'
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gold-300 to-transparent" />
      {animated && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-gold-500 to-transparent"
          animate={{
            x: vertical ? 0 : ['-100%', '100%'],
            y: vertical ? ['-100%', '100%'] : 0,
          }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        />
      )}
    </div>
  )
}

export function FamilyTree() {
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  const [hoveredSection, setHoveredSection] = useState<string | null>(null)

  const brideParents = useMemo(
    () => partyData.parents.filter((person) => person.side === 'bride'),
    []
  )
  const groomParents = useMemo(
    () => partyData.parents.filter((person) => person.side === 'groom'),
    []
  )
  const allPeople = useMemo(
    () => [...partyData.couple, ...partyData.parents, ...partyData.bridesmaids, ...partyData.groomsmen],
    []
  )
  const selectedPerson = allPeople.find((person) => person.id === selectedPersonId) ?? null
  const orderedCouple = useMemo(
    () => [
      partyData.couple.find((person) => person.side === 'bride'),
      partyData.couple.find((person) => person.side === 'groom'),
    ].filter((person): person is WeddingPartyPerson => Boolean(person)),
    []
  )
  const orderedBridesmaids = useMemo(() => {
    const preferredOrder = ['bm3', 'moh']
    const pinned = preferredOrder
      .map((personId) => partyData.bridesmaids.find((person) => person.id === personId))
      .filter((person): person is WeddingPartyPerson => Boolean(person))
    const remaining = partyData.bridesmaids.filter((person) => !preferredOrder.includes(person.id))

    return [...pinned, ...remaining]
  }, [])
  const bridesmaidRows = useMemo(
    () => [orderedBridesmaids.slice(0, 2), orderedBridesmaids.slice(2, 5), orderedBridesmaids.slice(5, 7)],
    [orderedBridesmaids]
  )
  const groomsmenRows = useMemo(
    () => [partyData.groomsmen.slice(0, 2), partyData.groomsmen.slice(2, 5), partyData.groomsmen.slice(5, 7)],
    []
  )

  const toggleSelectedPerson = (personId: string) => {
    setSelectedPersonId((current) => (current === personId ? null : personId))
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
    <div className="mx-auto w-full max-w-6xl px-3 py-10 sm:px-4 sm:py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-16 text-center"
      >
        <div className="mb-3 flex items-center justify-center gap-2">
          <Users className="h-4 w-4 text-gold-500" />
          <span className="text-xs font-medium uppercase tracking-[0.3em] text-gold-600">
            Family and friends
          </span>
        </div>
        <h2 className="font-display text-3xl text-charcoal-900 md:text-4xl">
          The people woven into the film
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-charcoal-500">
          The tree keeps things to first names up front. Tap a card to see the full name, role, and portrait.
        </p>
      </motion.div>

      <div className="relative">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mx-auto mb-6 grid max-w-4xl gap-8 md:grid-cols-2 md:gap-x-10 lg:gap-x-20 xl:gap-x-28"
        >
          <div
            className="flex flex-col items-center"
            onMouseEnter={() => setHoveredSection('bride-parents')}
            onMouseLeave={() => setHoveredSection(null)}
          >
            <p className="mb-3 text-xs uppercase tracking-wider text-rose-500">Bride&apos;s family</p>
            <div className="flex items-center gap-3 sm:gap-4 lg:gap-5">
              {brideParents.map((parent, index) => (
                <motion.div
                  key={parent.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
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
            className="flex flex-col items-center"
            onMouseEnter={() => setHoveredSection('groom-parents')}
            onMouseLeave={() => setHoveredSection(null)}
          >
            <p className="mb-3 text-xs uppercase tracking-wider text-blue-500">Groom&apos;s family</p>
            <div className="flex items-center gap-3 sm:gap-4 lg:gap-5">
              {groomParents.map((parent, index) => (
                <motion.div
                  key={parent.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
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
          className="relative mx-auto mb-8 grid max-w-4xl grid-cols-2 items-center gap-x-10 sm:gap-x-12 lg:gap-x-20 xl:gap-x-28"
        >
          <div className="absolute top-0 left-1/2 h-8 w-px -translate-x-1/2 bg-gradient-to-b from-gold-300 to-transparent" />

          {orderedCouple.map((person, index) => (
            <motion.div
              key={person.id}
              initial={{ opacity: 0, x: index === 0 ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + index * 0.1 }}
              className="relative justify-self-center"
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
            className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
          >
            <Heart className="h-6 w-6 fill-rose-400 text-rose-400" />
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="flex flex-col justify-center gap-8 xl:flex-row xl:items-start xl:gap-10"
        >
          <div
            className="flex flex-col items-center xl:min-w-0 xl:flex-1"
            onMouseEnter={() => setHoveredSection('bridesmaids')}
            onMouseLeave={() => setHoveredSection(null)}
          >
            <ConnectionLine vertical animated={hoveredSection === 'bridesmaids'} />
            <p className="mb-3 mt-2 text-xs uppercase tracking-wider text-rose-500">Bridesmaids</p>
            <div className="flex w-full max-w-[34rem] flex-col items-center gap-4 sm:max-w-[38rem] xl:max-w-none">
              {bridesmaidRows.map((row, rowIndex) => (
                <div key={`bridesmaid-row-${rowIndex}`} className="flex w-full items-start justify-center gap-3 sm:gap-4 lg:gap-5">
                  {row.map((person, index) => (
                    <motion.div
                      key={person.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.9 + (rowIndex * 3 + index) * 0.08 }}
                      className="flex justify-center"
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
            className="flex flex-col items-center xl:min-w-0 xl:flex-1"
            onMouseEnter={() => setHoveredSection('groomsmen')}
            onMouseLeave={() => setHoveredSection(null)}
          >
            <ConnectionLine vertical animated={hoveredSection === 'groomsmen'} />
            <p className="mb-3 mt-2 text-xs uppercase tracking-wider text-blue-500">Groomsmen</p>
            <div className="flex w-full max-w-[34rem] flex-col items-center gap-4 sm:max-w-[38rem] xl:max-w-none">
              {groomsmenRows.map((row, rowIndex) => (
                <div key={`groomsmen-row-${rowIndex}`} className="flex w-full items-start justify-center gap-3 sm:gap-4 lg:gap-5">
                  {row.map((person, index) => (
                    <motion.div
                      key={person.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.9 + (rowIndex * 3 + index) * 0.08 }}
                      className="flex justify-center"
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
                  type="button"
                  aria-label="Close details"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={closeSelectedPerson}
                  className="fixed inset-0 z-40 bg-charcoal-950/45 backdrop-blur-[2px]"
                />
                <motion.div
                  initial={{ opacity: 0, y: 24, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 24, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,40rem)] -translate-x-1/2 -translate-y-1/2"
                >
                  <div className="relative rounded-[1.75rem] border border-gold-200/70 bg-white/95 px-6 py-6 text-center shadow-[0_28px_90px_-40px_rgba(21,20,19,0.5)] backdrop-blur-sm sm:px-8 sm:py-7">
                    <button
                      type="button"
                      onClick={closeSelectedPerson}
                      className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-gold-200/80 bg-white text-charcoal-600 transition-colors hover:text-charcoal-900"
                      aria-label="Close details"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div className="mb-3 flex items-center justify-center gap-2 text-gold-600">
                      <Sparkles className="h-4 w-4" />
                      <span className="text-[10px] uppercase tracking-[0.28em]">
                        {selectedPerson.side === 'bride' ? 'Bride side' : 'Groom side'}
                      </span>
                    </div>
                    <div className="mb-5 flex justify-center">
                      <Avatar
                        src={selectedPerson.image}
                        alt={selectedPerson.fullName ?? selectedPerson.name}
                        fallback={selectedPerson.name}
                        size="xl"
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
                    <h3 className="font-display text-3xl text-charcoal-900">
                      {selectedPerson.fullName ?? selectedPerson.name}
                    </h3>
                    <p className="mt-1 text-sm font-medium text-charcoal-600">{selectedPerson.role}</p>
                    {selectedPerson.description && (
                      <p className="mt-4 text-sm leading-6 text-charcoal-600">{selectedPerson.description}</p>
                    )}
                    {selectedPerson.funFact && (
                      <p className="mt-3 text-sm leading-6 text-charcoal-500">
                        <span className="font-medium text-charcoal-700">Fun fact:</span> {selectedPerson.funFact}
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
