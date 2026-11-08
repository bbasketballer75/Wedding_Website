import type { GuestbookStorage } from './types'

/**
 * Per-browser reaction fingerprint + per-(message, reaction) dedupe markers.
 * Ported from the frozen `src/pages/guestbook/reactionFingerprint.ts`; the
 * storage is injectable so unit tests are deterministic and leak-free.
 */

export const REACTION_FINGERPRINT_KEY = 'wedding-guestbook-session-id'

function browserStorage(): GuestbookStorage {
  if (typeof window === 'undefined') {
    const memory = new Map<string, string>()
    return {
      getItem: key => memory.get(key) ?? null,
      setItem: (key, value) => {
        memory.set(key, value)
      },
      removeItem: key => {
        memory.delete(key)
      },
    }
  }
  return window.localStorage
}

function generateFingerprint(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`
}

export function getOrCreateReactionFingerprint(
  storage: GuestbookStorage = browserStorage(),
  createId: () => string = generateFingerprint
): string {
  const stored = storage.getItem(REACTION_FINGERPRINT_KEY)
  if (stored) return stored
  const fingerprint = createId()
  storage.setItem(REACTION_FINGERPRINT_KEY, fingerprint)
  return fingerprint
}

export function reactionMarkerKey(
  messageId: string,
  reactionKey: string,
  fingerprint: string
): string {
  return `wedding-reacted:${messageId}:${reactionKey}:${fingerprint}`
}

export function hasReacted(
  messageId: string,
  reactionKey: string,
  fingerprint: string,
  storage: GuestbookStorage = browserStorage()
): boolean {
  return storage.getItem(reactionMarkerKey(messageId, reactionKey, fingerprint)) !== null
}

export function markReacted(
  messageId: string,
  reactionKey: string,
  fingerprint: string,
  storage: GuestbookStorage = browserStorage()
): void {
  storage.setItem(reactionMarkerKey(messageId, reactionKey, fingerprint), '1')
}

export function unmarkReacted(
  messageId: string,
  reactionKey: string,
  fingerprint: string,
  storage: GuestbookStorage = browserStorage()
): void {
  storage.removeItem(reactionMarkerKey(messageId, reactionKey, fingerprint))
}
