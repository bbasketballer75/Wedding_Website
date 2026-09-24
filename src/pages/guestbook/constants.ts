export const INITIAL_VISIBLE_MESSAGES = 8

export const REACTION_TYPES = [
  { key: 'love', label: 'Love', emoji: '❤️' },
  { key: 'clap', label: 'Clap', emoji: '👏' },
  { key: 'laugh', label: 'Laugh', emoji: '😂' },
  { key: 'wow', label: 'Wow', emoji: '😮' },
] as const

export type ReactionKey = (typeof REACTION_TYPES)[number]['key']
