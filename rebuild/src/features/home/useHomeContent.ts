/**
 * Typed boundary for the data-driven Home sections (guest highlight reel and
 * the three editorial slots).
 *
 * `TODO(Wave3)`: the Lead wires the real `shared/data` hooks here once the data
 * layer lands (photos ordered by likes, latest guestbook quotes, the three
 * `site_editorial_features` slots). The current implementation returns an
 * *empty* deterministic state so the page renders now without network access:
 * the guest reel hides itself when empty and each editorial slot renders
 * nothing when it has no active feature — exactly the frozen components'
 * empty-data behavior.
 */

export interface HomeEditorialFeature {
  title: string
  summary?: string | null
  badge_label?: string | null
  cta_label?: string | null
  source_url?: string | null
}

export interface HomeGuestPhoto {
  id: string
  url: string
  thumbnail?: string | null
  caption?: string | null
}

export interface HomeGuestQuote {
  id: string
  content: string
  name: string
}

export interface HomeEditorialSlots {
  momentOfTheWeek: HomeEditorialFeature | null
  standoutUpload: HomeEditorialFeature | null
  featuredNote: HomeEditorialFeature | null
}

export interface HomeContentState extends HomeEditorialSlots {
  loading: boolean
  error: string | null
  guestPhotos: HomeGuestPhoto[]
  guestQuotes: HomeGuestQuote[]
}

const EMPTY_HOME_CONTENT: HomeContentState = {
  loading: false,
  error: null,
  guestPhotos: [],
  guestQuotes: [],
  momentOfTheWeek: null,
  standoutUpload: null,
  featuredNote: null,
}

/**
 * Read the data-driven Home sections.
 *
 * TODO(Wave3): replace the static return value with the typed
 * `shared/data` query hooks (photos by likes, latest guestbook messages and
 * editorial slots). The interface above is the contract the Lead binds to;
 * sections accept the values as props, so wiring them later does not change
 * the page composition.
 */
export function useHomeContent(): HomeContentState {
  return EMPTY_HOME_CONTENT
}
