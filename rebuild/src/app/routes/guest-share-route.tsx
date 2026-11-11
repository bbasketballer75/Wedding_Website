/**
 * `/guest/$token` route wrapper (lazy chunk).
 *
 * The token param is read here and the page + data adapter stay in the chunk;
 * importing the adapter eagerly from the router would pull the shared data layer
 * into the initial bundle.
 */
import { GuestSharePage } from '@/features/guest-share'
import { guestShareApi } from './guest-share-api'

export function GuestShareRoute({ token }: { token: string | undefined }) {
  return <GuestSharePage token={token} api={guestShareApi} />
}
