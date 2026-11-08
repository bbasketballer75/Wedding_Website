/**
 * Chaptered player section, ported from the frozen `src/pages/Film.tsx` middle
 * section: the runtime/chapters/captions line, the video player, and the
 * chapter guide grid (skeleton while the VTT loads, fallback chapters when it
 * fails).
 */
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { mediaPaths } from '@/shared/data/media'
import { MAIN_FILM, MAIN_FILM_RUNTIME_LABEL, type FilmChapter } from './filmContent'
import { formatChapterTime } from './formatTime'
import { VideoPlayer } from './video-player'

export interface FilmPlayerSectionProps {
  chapters: readonly FilmChapter[]
  isLoadingChapters: boolean
  onJumpToChapter: (time: number) => void
  onEnded: () => void
  storageKey: string
}

export function FilmPlayerSection({
  chapters,
  isLoadingChapters,
  onJumpToChapter,
  onEnded,
  storageKey,
}: FilmPlayerSectionProps) {
  return (
    <section className='px-4 pb-16'>
      <div className='mx-auto max-w-6xl'>
        <div
          id='wedding-video'
          data-testid='film-player-section'
          className='cinematic-panel px-5 py-6 sm:px-7 sm:py-8 lg:px-8 lg:py-9'
        >
          <div className='grid gap-6'>
            <p className='text-sm text-cinematic-muted'>
              {MAIN_FILM_RUNTIME_LABEL} feature film
              <span className='mx-2 text-gold-300/55'>•</span>
              {chapters.length} chapters
              <span className='mx-2 text-gold-300/55'>•</span>
              Captions available
            </p>

            <motion.div
              id='wedding-film-player'
              initial={{ opacity: 0, scale: 0.985 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className='scroll-mt-28'
            >
              <VideoPlayer
                src={mediaPaths.getMediaPath(MAIN_FILM.videoSrc)}
                title="Austin & Jordyn's Wedding"
                chapters={chapters}
                poster={MAIN_FILM.poster}
                captionsSrc={mediaPaths.getMediaPath(MAIN_FILM.captionsSrc)}
                previewStartTime={44}
                storageKey={storageKey}
                onEnded={onEnded}
                className='aspect-video ring-1 ring-white/10'
                requireLandscapeOnPhone
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: 0.15 }}
            >
              <div className='mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4'>
                <h3 className='text-sm uppercase tracking-[0.28em] text-gold-300/82'>
                  Chapter guide
                </h3>
                <p className='text-sm text-cinematic-muted'>
                  Jump back in only when you need a specific section.
                </p>
              </div>
              {isLoadingChapters ? (
                <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5'>
                  {Array.from({ length: 8 }).map((_, index) => (
                    <div key={index} className='h-20 rounded-xl bg-gold-100/50 animate-pulse' />
                  ))}
                </div>
              ) : (
                <div className='overflow-x-auto pb-2 hide-scrollbar'>
                  <div className='grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5'>
                    {chapters.map(chapter => (
                      <button
                        key={chapter.label}
                        type='button'
                        onClick={() => onJumpToChapter(chapter.time)}
                        className='group cinematic-card min-h-[4.8rem] cursor-pointer px-3 py-2.5 text-left transition-colors duration-200 hover:border-gold-300/35 hover:bg-white/8 sm:min-h-[5.1rem] sm:px-3.5 sm:py-3'
                      >
                        <div className='flex items-start justify-between gap-3'>
                          <div>
                            <p className='text-[10px] uppercase tracking-[0.28em] text-gold-300/72'>
                              {formatChapterTime(chapter.time)}
                            </p>
                            <p className='mt-1.5 text-[0.9rem] font-semibold leading-5 text-cinematic-primary sm:text-[0.96rem]'>
                              {chapter.label}
                            </p>
                          </div>
                          <ArrowRight className='mt-0.5 h-4 w-4 shrink-0 text-gold-300/72 transition-transform duration-200 group-hover:translate-x-0.5' />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}
