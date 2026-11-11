/** Frozen guestbook constants (`src/pages/guestbook/constants.ts`). */

export const INITIAL_VISIBLE_MESSAGES = 8

export const REACTION_TYPES = [
  { key: 'love', label: 'Love', emoji: '❤️' },
  { key: 'clap', label: 'Clap', emoji: '👏' },
  { key: 'laugh', label: 'Laugh', emoji: '😂' },
  { key: 'wow', label: 'Wow', emoji: '😮' },
] as const

export type ReactionKey = (typeof REACTION_TYPES)[number]['key']

/** Frozen composer limits (A4 §2; the counter shows /1000 like the oracle). */
export const COMPOSER_LIMITS = {
  nameMin: 2,
  nameMax: 50,
  contentMin: 10,
  contentMax: 1000,
} as const

/** Frozen client-side submit limiter: 3 notes per minute. */
export const CLIENT_RATE_LIMIT = { maxRequests: 3, windowMs: 60_000 } as const

/** Frozen copy rendered by the page (text-parity oracle). */
export const GUESTBOOK_COPY = {
  eyebrow: 'After the film',
  heroTitle: 'Say something before you go.',
  heroBody:
    'The guestbook is where the day settles. Whatever you felt, what you remember, or what you want us to carry forward — leave it here.',
  heroCta: 'Start your message',
  sidebarEyebrow: 'Leave a note',
  sidebarTitle: 'Something to remember us by.',
  sidebarBody: 'A few words is plenty. Write what came to mind on the drive home.',
  sidebarCtaOpen: 'Write a note',
  sidebarCtaClose: 'Close',
  feedEyebrow: 'Notes from the day',
  feedTitle: 'Every guestbook entry',
  readMore: 'Read more notes',
  searchPlaceholder: 'Search by name or message…',
  searchLabel: 'Search guestbook messages',
  clearSearchLabel: 'Clear search',
  emptyScript: 'Leave a note',
  emptyTitle: 'No notes yet — yours could be the first.',
  emptyBody: "Leave something small. It doesn't need to be a speech.",
  emptyCta: 'Leave the first note',
  composerEyebrow: 'Your note',
  composerTitle: "What's on your heart?",
  composerCloseLabel: 'Close composer',
  successEyebrow: 'Sent',
  successTitle: 'Your note is part of the book now.',
  successBody: "Thank you for leaving something with us. We'll carry it forward.",
  submitLabel: 'Post to the guestbook',
  submitError: "Something didn't go through — give it another try.",
  submitSuccess: 'Your note is part of the book now. Thank you.',
  submitRateLimited: 'Just a moment before the next one.',
  loadError: 'Having trouble loading notes right now — yours will still go through below.',
} as const
