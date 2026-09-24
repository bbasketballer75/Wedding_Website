import storage from '@/utils/storage'

export const REACTION_FINGERPRINT_KEY = 'wedding-guestbook-session-id'

export function getOrCreateReactionFingerprint(): string {
  // Check if fingerprint already exists in localStorage
  const stored = storage.getItem(REACTION_FINGERPRINT_KEY)
  if (stored) return stored

  // Generate new UUID using crypto API
  const fingerprint =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2)}`

  // Persist to localStorage
  storage.setItem(REACTION_FINGERPRINT_KEY, fingerprint)
  return fingerprint
}

// Per-(message, reaction) dedup marker key — previously built inline in both
// handleAddReaction and MessageCard; unified here.
export function reactionMarkerKey(messageId: string, reactionKey: string, fingerprint: string) {
  return `wedding-reacted:${messageId}:${reactionKey}:${fingerprint}`
}

export function hasReacted(messageId: string, reactionKey: string, fingerprint: string): boolean {
  return storage.getItem(reactionMarkerKey(messageId, reactionKey, fingerprint)) !== null
}

export function markReacted(messageId: string, reactionKey: string, fingerprint: string): void {
  storage.setItem(reactionMarkerKey(messageId, reactionKey, fingerprint), '1')
}

export function unmarkReacted(messageId: string, reactionKey: string, fingerprint: string): void {
  storage.removeItem(reactionMarkerKey(messageId, reactionKey, fingerprint))
}
