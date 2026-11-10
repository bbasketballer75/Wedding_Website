/**
 * `/gallery` route wrapper (lazy chunk).
 *
 * Kept out of the router's eager imports because it pulls the gallery feature
 * (fixtures/curated copy) and the photo data-layer adapter.
 */
import { GalleryPage } from '@/features/gallery/GalleryPage'
import { validateGallerySearch } from '@/features/gallery/data'
import { useLiveGallerySource } from './gallery-data'

export function GalleryRoute({ rawSearch }: { rawSearch: Record<string, unknown> }) {
  const search = validateGallerySearch(rawSearch)
  const source = useLiveGallerySource()
  return <GalleryPage search={search} source={source} />
}
