import { usePageMeta } from '@/app/seo/usePageMeta'
import { HOME_SEO } from './content/wedding'
import { FeaturedNoteSection } from './editorial/FeaturedNoteSection'
import { MomentOfTheWeekSection } from './editorial/MomentOfTheWeekSection'
import { StandoutUploadSection } from './editorial/StandoutUploadSection'
import { AnniversaryCountdown } from './sections/AnniversaryCountdown'
import { ElegantDivider } from './sections/ElegantDivider'
import { GuestHighlightReel } from './sections/GuestHighlightReel'
import { HomeHero } from './sections/HomeHero'
import { HomeNav } from './sections/HomeNav'
import { OurStoryBreak } from './sections/OurStoryBreak'
import { LoveTimeline } from './timeline/LoveTimeline'
import { useHomeContent } from './useHomeContent'

/**
 * Home page — frozen `src/pages/Home.tsx` composition, in the same DOM order:
 *
 *   nav → hero → "Our Story" act break → anniversary countdown → LoveTimeline →
 *   guest highlight reel → three editorial slots, separated by ElegantDividers.
 *
 * Static copy/sections are literal ports; the data-driven pieces (guest reel,
 * editorial slots) come from `useHomeContent`, whose `TODO(Wave3)` implementation
 * returns empty deterministic data until the Lead wires `shared/data`.
 */
export function HomePage() {
  usePageMeta({
    title: HOME_SEO.title,
    description: HOME_SEO.description,
    canonical: HOME_SEO.canonical,
    image: HOME_SEO.image,
  })

  const {
    loading,
    error,
    guestPhotos,
    guestQuotes,
    momentOfTheWeek,
    standoutUpload,
    featuredNote,
  } = useHomeContent()

  return (
    <div className='theme-canvas min-h-screen'>
      <HomeNav />

      <HomeHero />

      {/* Cinematic act-break chapter panel */}
      <OurStoryBreak />

      <div id='welcome-panel'>
        <AnniversaryCountdown />
      </div>

      <ElegantDivider />

      <LoveTimeline />

      <ElegantDivider />

      <GuestHighlightReel photos={guestPhotos} quotes={guestQuotes} loading={loading} />

      <ElegantDivider />

      <MomentOfTheWeekSection feature={momentOfTheWeek} loading={loading} error={error} />

      <ElegantDivider />

      <StandoutUploadSection feature={standoutUpload} loading={loading} error={error} />

      <ElegantDivider />

      <FeaturedNoteSection feature={featuredNote} loading={loading} error={error} />
    </div>
  )
}

export default HomePage
