export type MemoryTrailId =
  | 'ceremony'
  | 'family'
  | 'dance-floor'
  | 'engagement-season'
  | 'bach-ette'

export interface MemoryTrail {
  id: MemoryTrailId
  label: string
  description: string
  href: string
  cue: string
}

export const memoryTrails: MemoryTrail[] = [
  {
    id: 'ceremony',
    label: 'Ceremony',
    description: 'The vows, the walk in, the look across the aisle, and the quiet beats that made the day official.',
    href: '/film?moment=the-ceremony',
    cue: 'Best when you want the emotional center of the day first.',
  },
  {
    id: 'family',
    label: 'Family',
    description: 'Parent dances, close reactions, and the people who made the room feel like home.',
    href: '/film?clip=jerame',
    cue: 'A softer lane for the family-side moments guests always come back to.',
  },
  {
    id: 'dance-floor',
    label: 'Dance Floor',
    description: 'The late-night blur, the loud table laughs, and the phone clips that feel exactly like being there.',
    href: '/gallery?collection=Guest%20Uploads',
    cue: 'Best for the messy, joyful, after-dark energy.',
  },
  {
    id: 'engagement-season',
    label: 'Engagement Season',
    description: 'The proposal, the portraits, and the whole stretch where the wedding still felt brand new and unreal.',
    href: '/gallery?collection=Engagement',
    cue: 'A quieter chapter that starts before the wedding day itself.',
  },
  {
    id: 'bach-ette',
    label: 'Bach+ette',
    description: 'Pre-wedding weekends, the build-up, and the memories that sit just before the main event.',
    href: '/gallery?collection=Bach%2Bette',
    cue: 'For the lead-up and the weekend energy before May 10.',
  },
]
