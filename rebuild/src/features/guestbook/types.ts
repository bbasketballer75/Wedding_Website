/**
 * Guestbook feature types.
 *
 * Deliberately aligned with the typed data layer (`src/shared/data/guestbook.ts`)
 * normalised shapes — camelCase `createdAt`, `mediaUrl`, `comments` — so the Lead
 * can swap the Wave-6 stub hooks for the real data modules without touching any
 * component: the stub API in `./data.ts` mirrors
 * `loadMessages / submitMessage / setReactions / addReply` one-to-one.
 */

export interface GuestbookComment {
  id: string
  author: string
  content: string
  createdAt: string
}

export interface GuestbookMessage {
  id: string
  name: string
  content: string
  createdAt: string
  mediaUrl: string | null
  reactions: Record<string, number>
  comments: GuestbookComment[]
}

export interface GuestbookMessageInput {
  name: string
  email: string
  content: string
  mediaUrl?: string | null
}

/** Mirrors `shared/data/guestbook.ts`'s `GuestbookSubmitResult` union. */
export type GuestbookSubmitResult =
  | {
      status: 'submitted'
      messageId: string
      rateLimitRemaining: number | null
      /** True when the intended RPC failed and the documented fallback was used. */
      viaFallback: boolean
    }
  | { status: 'rate-limited'; message: string; resetAfterSeconds: number | null }
  | { status: 'failed'; error: { message: string; code?: string } }

/**
 * The injected typed API boundary. Each method maps to one `shared/data/guestbook.ts`
 * export (`fetchGuestbookMessages`, `submitGuestbookMessage`,
 * `updateGuestbookReactions`, `addGuestbookReply`); the real wiring simply
 * supplies those functions.
 */
export interface GuestbookApi {
  loadMessages: () => Promise<GuestbookMessage[]>
  submitMessage: (input: GuestbookMessageInput) => Promise<GuestbookSubmitResult>
  setReactions: (messageId: string, reactions: Readonly<Record<string, number>>) => Promise<void>
  addReply: (input: {
    messageId: string
    author: string
    content: string
  }) => Promise<GuestbookComment>
}

/** `localStorage`-shaped seam so tests can inject an in-memory store. */
export interface GuestbookStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

export interface ComposerErrors {
  name?: string
  email?: string
  content?: string
}
