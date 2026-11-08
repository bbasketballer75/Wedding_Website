/**
 * Wedding film page, ported from the frozen `src/pages/Film.tsx`.
 *
 * Composition order is the frozen DOM order (A4 §2 / rendered text oracle
 * `contracts/content/rendered/film.json`):
 *   hero -> family tree -> chaptered player -> parent dances -> film feature
 *   spotlight -> guest video highlights (self-hidden when empty) -> next steps.
 *
 * Behaviour ported from the frozen page (A4 §7):
 *   - chapter guide + `?moment=<slug>` jump;
 *   - `?clip=<id>` deep link opens the parent-dance modal and clears the param on
 *     close; modal restores focus to the trigger;
 *   - saved progress under `video-progress-main-film`, `?resume=1` resumes and
 *     cleans the param;
 *   - VTT anti-HTML fallback to the ten contract chapters (handled by
 *     `useMainFilmChapters`);
 *   - guest clips: approved-only, max 6, self-hides when empty (stub data seam,
 *     see `guest-clips/useFilmGuestClips.ts`).
 */
import { useCallback, useEffect, useState } from 'react'
import { usePageMeta } from '@/app/seo/usePageMeta'
import { slugifyFilmMoment } from './chapters'
import { FAMILY_FILMS, type FamilyFilm } from './filmContent'
import { FilmFamilyTreeSection } from './FilmFamilyTreeSection'
import { FilmFeatureSlot } from './FilmFeatureSlot'
import { FilmHero } from './FilmHero'
import { FilmNextSteps } from './FilmNextSteps'
import { FilmPlayerSection } from './FilmPlayerSection'
import { GuestVideoHighlightModal } from './guest-clips/GuestVideoHighlight'
import { GuestVideoHighlightsSection } from './guest-clips/GuestVideoHighlightsSection'
import type { FilmGuestClip } from './guest-clips/filmGuestClips'
import { useFilmGuestClips } from './guest-clips/useFilmGuestClips'
import { ParentDanceModal } from './parent-dances/ParentDance'
import { ParentDancesSection } from './parent-dances/ParentDancesSection'
import { useFilmDeepLinks } from './useFilmDeepLinks'
import { useFilmStructuredData } from './useFilmStructuredData'
import { useMainFilmChapters } from './useMainFilmChapters'
import { useSavedFilmProgress } from './useSavedFilmProgress'
import { attemptPlay } from './video-player/playback'
import { MAIN_FILM_PROGRESS_KEY } from './videoProgress'

const FILM_SOCIAL_IMAGE = '/images/film/main-film-poster.png'

const FILM_META = {
  title: 'Wedding Film',
  description:
    'Watch the full wedding film for Austin and Jordyn, from getting ready through the last dance.',
  canonical: '/film',
  image: FILM_SOCIAL_IMAGE,
} as const

export function FilmPage() {
  usePageMeta(FILM_META)
  useFilmStructuredData()

  const { chapters, isLoading: isLoadingChapters } = useMainFilmChapters()
  const deepLinks = useFilmDeepLinks()
  const resumeTime = useSavedFilmProgress(MAIN_FILM_PROGRESS_KEY)
  const { clips: guestClips, isLoading: isLoadingGuestClips } = useFilmGuestClips()

  const [activeFamilyFilm, setActiveFamilyFilm] = useState<FamilyFilm | null>(null)
  const [activeGuestClip, setActiveGuestClip] = useState<FilmGuestClip | null>(null)
  const [didFinishMainFilm, setDidFinishMainFilm] = useState(false)

  const clipFromUrl = deepLinks.clip
    ? (FAMILY_FILMS.find(film => film.id === deepLinks.clip) ?? null)
    : null
  const activeParentDance = activeFamilyFilm ?? clipFromUrl

  const scrollToVideo = useCallback(() => {
    document
      .getElementById('wedding-film-player')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const jumpToChapter = useCallback(
    (time: number) => {
      scrollToVideo()

      window.setTimeout(() => {
        const video = document.querySelector<HTMLVideoElement>(
          '#wedding-film-player video:not([aria-hidden])'
        )
        if (!video) {
          return
        }

        video.currentTime = time
        attemptPlay(video)
      }, 420)
    },
    [scrollToVideo]
  )

  const resumeMainFilm = useCallback(() => {
    if (!resumeTime) {
      scrollToVideo()
      return
    }

    jumpToChapter(resumeTime)
  }, [jumpToChapter, resumeTime, scrollToVideo])

  // ?moment=<chapter-slug> jumps once the chapters are known; ?clip= wins.
  useEffect(() => {
    if (deepLinks.clip || !deepLinks.moment) {
      return
    }

    const targetChapter = chapters.find(
      chapter => slugifyFilmMoment(chapter.label) === deepLinks.moment
    )
    if (targetChapter) {
      jumpToChapter(targetChapter.time)
    }
  }, [chapters, deepLinks.clip, deepLinks.moment, jumpToChapter])

  // ?resume=1 resumes saved progress, then the param is removed (replace).
  useEffect(() => {
    if (!deepLinks.resume || !resumeTime) {
      return
    }

    resumeMainFilm()
    deepLinks.removeParam('resume')
  }, [deepLinks, resumeMainFilm, resumeTime])

  const closeParentDance = useCallback(() => {
    setActiveFamilyFilm(null)
    if (deepLinks.clip) {
      deepLinks.removeParam('clip')
    }
  }, [deepLinks])

  return (
    <div className='min-h-screen bg-cream-50'>
      <FilmHero onWatchNow={scrollToVideo} />

      <FilmFamilyTreeSection />

      <FilmPlayerSection
        chapters={chapters}
        isLoadingChapters={isLoadingChapters}
        onJumpToChapter={jumpToChapter}
        onEnded={() => setDidFinishMainFilm(true)}
        storageKey={MAIN_FILM_PROGRESS_KEY}
      />

      <ParentDancesSection onOpen={setActiveFamilyFilm} />

      <FilmFeatureSlot />

      <GuestVideoHighlightsSection
        clips={guestClips}
        isLoading={isLoadingGuestClips}
        onOpen={setActiveGuestClip}
      />

      <FilmNextSteps didFinishMainFilm={didFinishMainFilm} />

      <ParentDanceModal film={activeParentDance} onClose={closeParentDance} />
      <GuestVideoHighlightModal clip={activeGuestClip} onClose={() => setActiveGuestClip(null)} />
    </div>
  )
}
