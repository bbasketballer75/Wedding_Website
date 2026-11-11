/**
 * Time formatting helpers, ported verbatim from the frozen `src/lib/utils.ts`
 * (`formatTime`) and `src/pages/Film.tsx` (`formatChapterTime`).
 */

/** `75 -> "1:15"`, `3725 -> "1:02:05"` (frozen player time display). */
export function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/** Frozen chapter-guide label: minutes:seconds, never hours (45:53 film). */
export function formatChapterTime(totalSeconds: number): string {
  const wholeSeconds = Math.floor(totalSeconds)
  const minutes = Math.floor(wholeSeconds / 60)
  const seconds = wholeSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
