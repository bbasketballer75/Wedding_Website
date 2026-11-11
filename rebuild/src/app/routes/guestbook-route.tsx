/**
 * `/guestbook` route wrapper (lazy chunk): page + real data-layer API.
 *
 * The page reads `?message=`/`?q=` from the URL on mount (the frozen page did
 * the same), so the route keeps an empty search schema and every `/guestbook`
 * link stays a plain href like the oracle.
 */
import { GuestbookPage } from '@/features/guestbook/GuestbookPage'
import { guestbookApi } from './guestbook-api'

export function GuestbookRoute() {
  return <GuestbookPage api={guestbookApi} />
}
