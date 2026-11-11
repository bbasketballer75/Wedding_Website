import type { TimelineEvent } from './timelineContent'
import { HalloweenCard } from './HalloweenCard'
import { StandardTimelineCard } from './StandardTimelineCard'

export interface TimelineCardProps {
  event: TimelineEvent
  index: number
}

/** Frozen `TimelineCard` selector: milestone #6 uses the bespoke Halloween card. */
export function TimelineCard({ event, index }: TimelineCardProps) {
  if (event.id === '6') {
    return <HalloweenCard event={event} index={index} />
  }

  return <StandardTimelineCard event={event} index={index} />
}
