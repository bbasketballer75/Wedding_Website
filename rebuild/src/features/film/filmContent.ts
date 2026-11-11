/**
 * Typed access to the frozen Film content contract.
 *
 * Single source of truth: `contracts/content/film.json`,
 * `contracts/content/party.json` and `contracts/content/memory-trails.json`
 * (extracted from the frozen app by `tools/extract-content/extract.mjs` and
 * reviewed as the content checklist). The page must not re-type this copy.
 *
 * The frozen Film page imported the same values from `src/data/film.ts`,
 * `src/data/weddingParty.ts` and `src/data/memoryTrails.ts`; this module is the
 * rebuild's equivalent, mapping the JSON contract to the view-model types the
 * components consume.
 */
import filmContract from '../../../../contracts/content/film.json'
import memoryTrailsContract from '../../../../contracts/content/memory-trails.json'
import partyContract from '../../../../contracts/content/party.json'

// ─── Types (the shapes the frozen page consumed) ────────────────────────────

export interface FilmChapter {
  label: string
  time: number
}

export interface FamilyFilm {
  id: string
  label: string
  description: string
  duration: string
  thumbnail: string
  videoSrc: string
  captionsSrc: string
  previewFrameTimestamps: readonly number[]
}

export interface MemoryTrail {
  id: string
  label: string
  description: string
  href: string
  cue: string
}

export type WeddingPartySide = 'bride' | 'groom'

export interface WeddingPartyPerson {
  id: string
  name: string
  fullName?: string
  role: string
  side: WeddingPartySide
  image: string
  mirrorImage?: boolean
  description?: string
  funFact?: string
}

export interface WeddingParty {
  couple: readonly WeddingPartyPerson[]
  parents: readonly WeddingPartyPerson[]
  groomsmen: readonly WeddingPartyPerson[]
  bridesmaids: readonly WeddingPartyPerson[]
}

// ─── Main film ──────────────────────────────────────────────────────────────

export interface MainFilm {
  /** Feature-length runtime label shown in the hero and the player header. */
  runtimeLabel: string
  /** `/video/main.mp4` — resolved through `mediaPaths.getMediaPath` at render. */
  videoSrc: string
  /** `/video/main.vtt` — the captions track. */
  captionsSrc: string
  /** `/images/film/main-film-poster.png` — same-origin poster. */
  poster: string
  /** `/video/main-film-chapters.vtt` — the live chapter source. */
  chaptersSource: string
}

export const MAIN_FILM: MainFilm = {
  runtimeLabel: filmContract.mainFilm.runtimeLabel,
  videoSrc: filmContract.mainFilm.videoSrc,
  captionsSrc: filmContract.mainFilm.captionsSrc,
  poster: filmContract.mainFilm.poster,
  chaptersSource: filmContract.mainFilm.chaptersSource,
}

/** Frozen `MAIN_FILM_RUNTIME_LABEL` (45:53). */
export const MAIN_FILM_RUNTIME_LABEL = MAIN_FILM.runtimeLabel

/**
 * The ten fallback chapters. Used when the live VTT is missing, unparsable or
 * served as HTML (the SPA catch-all returns `index.html` for a missing VTT).
 */
export const MAIN_FILM_CHAPTERS_FALLBACK: readonly FilmChapter[] =
  filmContract.chaptersFallback.map(chapter => ({
    label: chapter.label,
    time: chapter.time,
  }))

// ─── Parent dances ──────────────────────────────────────────────────────────

export const FAMILY_FILMS: readonly FamilyFilm[] = filmContract.familyFilms.map(film => ({
  id: film.id,
  label: film.label,
  description: film.description,
  duration: film.duration,
  thumbnail: film.thumbnail,
  videoSrc: film.videoSrc,
  captionsSrc: film.captionsSrc,
  previewFrameTimestamps: film.previewFrameTimestamps,
}))

// ─── Memory trails (guest-clip labels + section chips) ─────────────────────

export const MEMORY_TRAILS: readonly MemoryTrail[] = memoryTrailsContract.trails.map(trail => ({
  id: trail.id,
  label: trail.label,
  description: trail.description,
  href: trail.href,
  cue: trail.cue,
}))

/** Frozen `getMemoryTrailById`: returns `null` for unknown/missing ids. */
export function getMemoryTrailById(id: string | null | undefined): MemoryTrail | null {
  if (!id) {
    return null
  }
  return MEMORY_TRAILS.find(trail => trail.id === id) ?? null
}

// ─── Wedding party (family tree) ───────────────────────────────────────────

function toPerson(raw: {
  id: string
  name: string
  role: string
  side: string
  image: string
  fullName?: string
  mirrorImage?: boolean
  description?: string
  funFact?: string
}): WeddingPartyPerson {
  return {
    id: raw.id,
    name: raw.name,
    role: raw.role,
    side: raw.side === 'bride' ? 'bride' : 'groom',
    image: raw.image,
    ...(raw.fullName === undefined ? {} : { fullName: raw.fullName }),
    ...(raw.mirrorImage === undefined ? {} : { mirrorImage: raw.mirrorImage }),
    ...(raw.description === undefined ? {} : { description: raw.description }),
    ...(raw.funFact === undefined ? {} : { funFact: raw.funFact }),
  }
}

export const WEDDING_PARTY: WeddingParty = {
  couple: partyContract.couple.map(toPerson),
  parents: partyContract.parents.map(toPerson),
  groomsmen: partyContract.groomsmen.map(toPerson),
  bridesmaids: partyContract.bridesmaids.map(toPerson),
}
