/**
 * "Where to next" closing panel, ported from the frozen `src/pages/Film.tsx`.
 * The copy switches after the main film ends (`didFinishMainFilm`), exactly like
 * the frozen page.
 *
 * Every CTA links to that copy-identical destination path; the buttons were
 * rendered as `<a>` elements by the frozen Button `to` branch. Two deliberate
 * reasons the rebuild keeps a link (and reuses the Button primitive's
 * `buttonVariants` class contract) instead of `<Button to search>`:
 *   1. Frozen parity: the frozen hrefs are literally
 *      `/gallery?collection=Wedding+Day` and `?collection=Guest+Uploads`, while
 *      TanStack Router serialises the same decoded search as `%20`.
 *   2. `<Button search>` is typed `Record<string, unknown>`, which the TS6
 *      compatibility gate rejects against TanStack's route-search type.
 * The visual/class contract is still owned by the shared Button primitive.
 */
import { motion } from 'framer-motion'
import { buttonVariants } from '@/shared/ui/buttonVariants'

export interface FilmNextStepsProps {
  didFinishMainFilm: boolean
}

export function FilmNextSteps({ didFinishMainFilm }: FilmNextStepsProps) {
  return (
    <section className='px-4 pb-20'>
      <div className='mx-auto max-w-5xl'>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className='editorial-panel px-6 py-8 sm:px-8 sm:py-10'
        >
          <div className='absolute -right-10 top-8 h-32 w-32 rounded-full bg-gold-200/35 blur-3xl' />
          <div className='relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between'>
            <div>
              <span className='eyebrow-chip'>
                {didFinishMainFilm ? 'One last stop' : 'After the film'}
              </span>
              <h2 className='mt-5 text-4xl text-charcoal-900 sm:text-5xl'>
                {didFinishMainFilm ? 'Choose what to open next.' : 'Where to next'}
              </h2>
              <p className='mt-4 max-w-2xl text-base text-charcoal-600 sm:text-lg'>
                {didFinishMainFilm
                  ? 'Most guests head to the gallery next. The guestbook stays here as the quieter last step if you still want to leave one thoughtful note.'
                  : 'The next step is usually the gallery. Guest uploads and the guestbook stay here if you want one more pass through the day before you leave.'}
              </p>
            </div>

            <div className='flex flex-wrap gap-3 lg:max-w-[42rem] lg:justify-end'>
              <a
                href='/gallery?collection=Wedding+Day'
                className={buttonVariants({
                  size: 'md',
                  className: 'min-w-[12.5rem] px-5 py-2.5 sm:min-w-[13rem] sm:px-6',
                })}
              >
                Open Wedding Day Gallery
              </a>
              <a
                href='/gallery?collection=Guest+Uploads'
                className={buttonVariants({
                  variant: 'secondary',
                  size: 'md',
                  className: 'min-w-[12rem] px-5 py-2.5 sm:min-w-[12.5rem] sm:px-6',
                })}
              >
                Browse Guest Uploads
              </a>
              <a
                href='/guestbook'
                className={buttonVariants({
                  variant: 'ghost',
                  size: 'md',
                  className: 'min-w-[10rem] px-4 py-2.5 sm:min-w-[10.5rem] sm:px-5',
                })}
              >
                Leave a Note
              </a>
              <a
                href='/upload'
                className={buttonVariants({
                  variant: 'ghost',
                  size: 'md',
                  className: 'min-w-[10rem] px-4 py-2.5 sm:min-w-[10.5rem] sm:px-5',
                })}
              >
                Share Your Angle
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
