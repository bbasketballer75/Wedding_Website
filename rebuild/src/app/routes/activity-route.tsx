/**
 * `/activity` route wrapper (lazy chunk): page + data-layer API.
 */
import { ActivityPage } from '@/features/activity'
import { activityApi } from './activity-api'

export function ActivityRoute() {
  return <ActivityPage api={activityApi} />
}
