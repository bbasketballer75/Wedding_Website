/**
 * `/guest-photos` route wrapper (lazy chunk).
 *
 * The page, its data adapter and the shared data layer it pulls must stay in
 * this chunk: importing the adapter from `app/router.tsx` would drag the shared
 * data layer (incl. generated schema types) into the eager entry bundle.
 */
import { GuestPhotosPage } from '@/features/guest-photos'
import { guestPhotosApi } from './guest-photos-api'

export function GuestPhotosRoute() {
  return <GuestPhotosPage api={guestPhotosApi} />
}
