/**
 * Deterministic activity fixtures.
 *
 * Exactly `contracts/fixtures/activity.json` (the parity harness mocks
 * `/rest/v1/activity_log` with these rows), so the rendered copy matches
 * `contracts/content/rendered/activity.json`:
 *
 *   John Doe shared a photo · over 1 year ago
 *   Sarah Mitchell signed the guestbook · over 1 year ago
 *
 * Keep this list at two items: the text oracle captures the default feed, and an
 * extra row here would add body text to that capture.
 */
import type { ActivityItem } from './types'

export const ACTIVITY_FIXTURE: readonly ActivityItem[] = [
  {
    id: 'act-1',
    type: 'photo_upload',
    sourceId: 'photo-1',
    sourceType: 'guest_uploads',
    displayName: 'John Doe',
    thumbnailUrl: '/images/engagement/PoradaProposal-29.webp',
    contentPreview: 'Shared a photo from the dance floor!',
    createdAt: '2025-05-10T14:00:00.000Z',
  },
  {
    id: 'act-2',
    type: 'guestbook_entry',
    sourceId: 'message-1',
    sourceType: 'guestbook_messages',
    displayName: 'Sarah Mitchell',
    thumbnailUrl: null,
    contentPreview: 'Your vows made the whole room disappear for a second.',
    createdAt: '2025-05-12T18:00:00.000Z',
  },
]
