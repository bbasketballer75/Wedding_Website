/**
 * Family-tree person card, ported from the frozen
 * `src/components/family-tree/FamilyTree.tsx` (`PersonCard`).
 */
import { motion } from 'framer-motion'
import { cn } from '@/shared/lib/cn'
import { Avatar } from '@/shared/ui/Avatar'
import type { WeddingPartyPerson } from '../filmContent'

export interface PersonCardProps {
  person: WeddingPartyPerson
  isCenter?: boolean
  isPartyCard?: boolean
  onClick?: () => void
  isSelected?: boolean
}

export function PersonCard({
  person,
  isCenter = false,
  isPartyCard = false,
  onClick,
  isSelected,
}: PersonCardProps) {
  const isBride = person.side === 'bride'
  const imageScale = isCenter ? 1.16 : isPartyCard ? 1.14 : 1.15

  return (
    <motion.button
      type='button'
      onClick={onClick}
      className={cn('relative group h-full w-full cursor-pointer rounded-2xl text-left')}
    >
      <div
        className={cn(
          'absolute inset-0 rounded-full blur-xl opacity-0 transition-opacity duration-500 group-hover:opacity-35',
          isBride ? 'bg-rose-400' : 'bg-blue-400'
        )}
      />

      <div
        className={cn(
          'relative flex h-full w-full flex-col items-center rounded-[1.75rem] p-4 transition-colors duration-200 sm:p-5',
          isCenter
            ? 'min-h-[13.5rem] px-5 py-5 sm:min-h-[15.5rem] sm:px-7 sm:py-7 lg:min-h-[17rem] lg:px-9 lg:py-8'
            : isPartyCard
              ? 'min-h-[11.75rem] px-4 py-4 sm:min-h-[13rem] sm:px-5 sm:py-5 lg:min-h-[14rem] lg:px-6 lg:py-6'
              : 'min-h-[12rem] px-4 py-5 sm:min-h-[13.5rem] sm:px-5 sm:py-5 lg:min-h-[14.5rem] lg:px-6 lg:py-6',
          isCenter
            ? 'bg-gradient-to-br from-gold-100 to-gold-200 shadow-lg'
            : 'bg-white/92 shadow-soft backdrop-blur-sm hover:bg-white',
          isSelected && 'ring-2 ring-gold-400'
        )}
      >
        <div className='relative'>
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
              isCenter
                ? 'h-24 w-24 text-lg sm:h-32 sm:w-32 sm:text-xl lg:h-36 lg:w-36 xl:h-40 xl:w-40'
                : isPartyCard
                  ? 'h-20 w-20 text-base sm:h-24 sm:w-24 sm:text-lg lg:h-[6.5rem] lg:w-[6.5rem] xl:h-28 xl:w-28 xl:text-xl'
                  : 'h-[5.5rem] w-[5.5rem] text-lg sm:h-[6.5rem] sm:w-[6.5rem] sm:text-xl lg:h-28 lg:w-28 xl:h-[7.5rem] xl:w-[7.5rem]',
              isBride ? 'border-rose-300' : 'border-blue-300',
              isCenter && 'border-gold-400'
            )}
          />
        </div>

        <div className='mt-4 flex flex-1 flex-col justify-center text-center'>
          <p
            className={cn(
              'font-display font-medium',
              isCenter
                ? 'text-[1.65rem] leading-none text-charcoal-900 sm:text-[2rem] lg:text-[2.15rem] xl:text-[2.35rem]'
                : isPartyCard
                  ? 'text-base text-charcoal-800 sm:text-lg lg:text-[1.24rem] xl:text-[1.34rem]'
                  : 'text-lg text-charcoal-800 sm:text-xl xl:text-[1.45rem]'
            )}
          >
            {person.name}
          </p>
          {!isCenter && (
            <p
              className={cn(
                'mt-1.5 leading-5 text-charcoal-500',
                isPartyCard ? 'text-xs sm:text-[13px] lg:text-sm' : 'text-sm'
              )}
            >
              {person.role}
            </p>
          )}
        </div>
      </div>
    </motion.button>
  )
}
