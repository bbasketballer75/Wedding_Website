import { motion } from 'framer-motion'
import { FilmSEO } from '@/components/seo/SEOHead'
import { VideoPlayer } from '@/components/video/VideoPlayer'
import { Button } from '@/components/ui/Button'
import { FamilyTree } from '@/components/family-tree/FamilyTree'
import { getMediaPath } from '@/utils/media'
import {
  Play,
  Clock3,
  ArrowDown,
  ArrowRight,
  Sparkles,
  Camera,
  HeartHandshake,
} from 'lucide-react'

const chapters = [
  { label: 'Getting Ready', time: 0 },
  { label: 'First Look', time: 300 },
  { label: 'The Ceremony', time: 900 },
  { label: 'Cocktail Hour', time: 1800 },
  { label: 'Reception', time: 2400 },
  { label: 'First Dance', time: 3000 },
  { label: 'Dancing', time: 3600 },
  { label: 'Send Off', time: 4200 },
] as const

const familyFilms = [
  { id: 'mom', label: 'A Message from Mom', duration: '5:32', thumbnail: '/images/parents/heather.webp' },
  { id: 'christine', label: "Christine's Toast", duration: '8:15', thumbnail: '/images/parents/christine.webp' },
  { id: 'jerame', label: "Jerame's Words", duration: '6:45', thumbnail: '/images/parents/jerame.webp' },
  { id: 'melony', label: "Melony's Message", duration: '7:20', thumbnail: '/images/parents/melony.webp' },
] as const

const MAIN_FILM_POSTER = '/images/film/main-film-poster.png'

const filmHighlights = [
  {
    icon: Clock3,
    title: '42-minute feature',
    description: 'From quiet morning details to the last dance under the lights.',
  },
  {
    icon: Camera,
    title: 'Full-story chapters',
    description: 'Easy jumps between getting ready, ceremony, reception, and send-off.',
  },
  {
    icon: HeartHandshake,
    title: 'Family side stories',
    description: 'Messages and memories from the people who carried the day with us.',
  },
] as const

function formatChapterTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export default function Film() {
  const scrollToVideo = () => {
    document.getElementById('wedding-film-player')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const jumpToChapter = (time: number) => {
    scrollToVideo()

    window.setTimeout(() => {
      const video = document.querySelector<HTMLVideoElement>('#wedding-film-player video')
      if (!video) {
        return
      }

      video.currentTime = time
      const playAttempt = video.play()
      if (playAttempt && typeof playAttempt.catch === 'function') {
        playAttempt.catch(() => {})
      }
    }, 420)
  }

  return (
    <div className="min-h-screen bg-cream-50">
      <FilmSEO />

      <section className="px-4 pb-10 pt-32 sm:pt-36">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            data-testid="film-hero"
            className="editorial-panel px-6 py-8 sm:px-8 sm:py-10 lg:px-10"
          >
            <div className="absolute -right-16 top-8 h-44 w-44 rounded-full bg-gold-200/30 blur-3xl" />
            <div className="absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-blush-200/35 blur-3xl" />

            <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
              <div>
                <span className="eyebrow-chip">
                  <Sparkles className="h-3.5 w-3.5" />
                  Our wedding film
                </span>

                <h1 className="mt-6 max-w-3xl text-5xl text-charcoal-900 sm:text-6xl lg:text-7xl">
                  The day as it felt, not just as it looked.
                </h1>

                <p className="mt-5 max-w-2xl text-base text-charcoal-600 sm:text-lg">
                  This is the full arc of May 10, 2025: the nerves, the vows, the speeches,
                  the laughter, and the dance floor blur that still feels impossible to forget.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-charcoal-500">
                  <span className="rounded-full border border-white/80 bg-white/78 px-4 py-2">
                    Saturday, May 10, 2025
                  </span>
                  <span className="rounded-full border border-white/80 bg-white/78 px-4 py-2">
                    The Lodge at Indian Lake
                  </span>
                  <span className="rounded-full border border-white/80 bg-white/78 px-4 py-2">
                    42-minute feature film
                  </span>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Button size="lg" onClick={scrollToVideo}>
                    Watch Now
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button size="lg" variant="secondary" to="/upload">
                    Share Your Angle
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {filmHighlights.map(({ icon: Icon, title, description }, index) => (
                  <motion.div
                    key={title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.12 + index * 0.08 }}
                    className="editorial-card px-5 py-5"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-gold-200/70 bg-gold-50 text-gold-600">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="mt-5 text-xl font-semibold text-charcoal-900">
                      {title}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-charcoal-500">
                      {description}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="px-4 pb-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6 }}
            className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]"
          >
            <div className="editorial-panel px-6 py-6 sm:px-8">
              <span className="eyebrow-chip">Meet the wedding party</span>
              <h2 className="mt-5 text-4xl text-charcoal-900 sm:text-5xl">
                The people who held the day together.
              </h2>
              <p className="mt-4 max-w-2xl text-base text-charcoal-600 sm:text-lg">
                Before you hit play, take a moment to meet the family and friends woven into every
                chapter of the film. It makes the speeches, reactions, and little glances land even harder.
              </p>
            </div>

            <div className="editorial-card flex flex-col justify-between px-5 py-6">
              <div>
                <p className="text-[10px] uppercase tracking-[0.32em] text-gold-700">
                  Ready when you are
                </p>
                <p className="mt-3 text-lg font-semibold text-charcoal-900">
                  Jump straight into the feature film.
                </p>
                <p className="mt-3 text-sm leading-6 text-charcoal-500">
                  The player remembers progress, supports chapters, and is framed to feel like part of the story.
                </p>
              </div>

              <button
                type="button"
                onClick={scrollToVideo}
                className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-gold-700 transition-colors hover:text-gold-600"
              >
                Scroll to the player
                <ArrowDown className="h-4 w-4" />
              </button>
            </div>
          </motion.div>

          <div className="editorial-panel px-2 py-4 sm:px-4">
            <FamilyTree />
          </div>
        </div>
      </section>

      <section id="wedding-video" className="px-4 pb-16">
        <div className="mx-auto max-w-6xl">
          <div
            data-testid="film-player-section"
            className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(21,20,19,0.98),rgba(27,25,24,0.98)_58%,rgba(53,43,33,0.96))] px-6 py-8 shadow-[0_35px_90px_-55px_rgba(21,20,19,0.82)] sm:px-8 sm:py-10"
          >
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] uppercase tracking-[0.32em] text-gold-300/85 backdrop-blur-sm">
                  <Play className="h-3.5 w-3.5" />
                  Feature presentation
                </span>
                <h2 className="mt-5 text-4xl text-cream-50 sm:text-5xl">
                  Press play on the whole day.
                </h2>
                <p className="mt-4 max-w-2xl text-base text-cream-100/72 sm:text-lg">
                  Watch it straight through or use the chapter jumps below to revisit a single moment
                  without losing the cinematic feel of the full cut.
                </p>
              </motion.div>

              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                <div className="rounded-[1.4rem] border border-white/10 bg-white/6 px-5 py-5 text-cream-50 backdrop-blur-sm">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-gold-300/75">Runtime</p>
                  <p className="mt-3 font-display text-3xl">42</p>
                  <p className="mt-2 text-sm text-cream-100/68">Minutes of ceremony, toasts, and celebration.</p>
                </div>
                <div className="rounded-[1.4rem] border border-white/10 bg-white/6 px-5 py-5 text-cream-50 backdrop-blur-sm">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-gold-300/75">Chapters</p>
                  <p className="mt-3 font-display text-3xl">{chapters.length}</p>
                  <p className="mt-2 text-sm text-cream-100/68">Jump points mapped from getting ready to send off.</p>
                </div>
                <div className="rounded-[1.4rem] border border-white/10 bg-white/6 px-5 py-5 text-cream-50 backdrop-blur-sm">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-gold-300/75">Best viewed</p>
                  <p className="mt-3 font-display text-3xl">With sound</p>
                  <p className="mt-2 text-sm text-cream-100/68">For the vows, speeches, and every laugh in between.</p>
                </div>
              </div>
            </div>

            <motion.div
              id="wedding-film-player"
              initial={{ opacity: 0, scale: 0.985 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="mt-8 scroll-mt-28"
            >
              <VideoPlayer
                src={getMediaPath('/video/main.mp4')}
                title="Austin & Jordyn's Wedding"
                chapters={[...chapters]}
                poster={MAIN_FILM_POSTER}
                className="aspect-video ring-1 ring-white/10"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: 0.15 }}
              className="mt-8"
            >
              <div className="mb-4 flex items-center justify-between gap-4">
                <h3 className="text-sm uppercase tracking-[0.28em] text-gold-300/78">
                  Jump to a moment
                </h3>
                <p className="text-sm text-cream-100/58">
                  Click a chapter and the player will jump there.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {chapters.map((chapter) => (
                  <button
                    key={chapter.label}
                    type="button"
                    onClick={() => jumpToChapter(chapter.time)}
                    className="group rounded-[1.35rem] border border-white/10 bg-white/6 px-5 py-4 text-left backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-gold-300/40 hover:bg-white/8"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.28em] text-gold-300/72">
                          {formatChapterTime(chapter.time)}
                        </p>
                        <p className="mt-3 text-lg font-semibold text-cream-50">
                          {chapter.label}
                        </p>
                      </div>
                      <ArrowRight className="mt-1 h-4 w-4 text-gold-300/72 transition-transform duration-300 group-hover:translate-x-0.5" />
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-16">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-8 max-w-3xl"
          >
            <span className="eyebrow-chip">Family side stories</span>
            <h2 className="mt-5 text-4xl text-charcoal-900 sm:text-5xl">
              Messages that deserve their own spotlight.
            </h2>
            <p className="mt-4 text-base text-charcoal-600 sm:text-lg">
              Alongside the main film, these shorter pieces hold the quieter perspectives:
              the wisdom, love, and little stories that sit just off camera in the full cut.
            </p>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {familyFilms.map((film, index) => (
              <motion.div
                key={film.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
                className="group editorial-card cursor-pointer"
              >
                <div
                  className="relative aspect-[4/5] overflow-hidden"
                  style={{
                    backgroundImage: `linear-gradient(to top, rgba(21,20,19,0.82), rgba(21,20,19,0.15)), url(${film.thumbnail})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.16),transparent_34%)]" />
                  <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/22 px-3 py-1.5 text-[10px] uppercase tracking-[0.24em] text-cream-50 backdrop-blur-sm">
                    Side story
                  </div>
                  <div className="absolute bottom-4 right-4 rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-xs font-mono text-white backdrop-blur-sm">
                    {film.duration}
                  </div>
                  <div className="absolute inset-x-4 bottom-4 right-20">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-charcoal-900 shadow-lg transition-transform duration-300 group-hover:scale-105">
                      <Play className="ml-0.5 h-5 w-5" fill="currentColor" />
                    </div>
                    <h3 className="font-display text-2xl leading-none text-white">
                      {film.label}
                    </h3>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-20">
        <div className="mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="editorial-panel px-6 py-8 sm:px-8 sm:py-10"
          >
            <div className="absolute -right-10 top-8 h-32 w-32 rounded-full bg-gold-200/35 blur-3xl" />
            <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-end">
              <div>
                <span className="eyebrow-chip">Keep the archive growing</span>
                <h2 className="mt-5 text-4xl text-charcoal-900 sm:text-5xl">
                  Have your own angle from the day?
                </h2>
                <p className="mt-4 max-w-2xl text-base text-charcoal-600 sm:text-lg">
                  Add the clips, candids, and dance floor moments only your phone caught so the
                  story feels complete from every side of the room.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <Button size="lg" to="/upload">
                  Share Your Memories
                </Button>
                <Button size="lg" variant="secondary" to="/gallery">
                  Browse the Gallery
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
