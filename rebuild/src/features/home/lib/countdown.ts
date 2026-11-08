import { WEDDING_DATE } from '../content/wedding'

export const ANNIVERSARY_WINDOW_DAYS = 30

export interface TimeUnit {
  value: number
  label: string
}

/** Frozen `getCountdownToNextAnniversary` (`AnniversaryCountdown.tsx:13-31`). */
export function getCountdownToNextAnniversary(now: Date): TimeUnit[] {
  const weddingMonth = WEDDING_DATE.getMonth()
  const weddingDay = WEDDING_DATE.getDate()
  const nextAnniversary = new Date(now.getFullYear(), weddingMonth, weddingDay)
  if (nextAnniversary <= now) {
    nextAnniversary.setFullYear(now.getFullYear() + 1)
  }
  const diffMs = nextAnniversary.getTime() - now.getTime()
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000)
  return [
    { value: days, label: days === 1 ? 'day' : 'days' },
    { value: hours, label: hours === 1 ? 'hour' : 'hours' },
    { value: minutes, label: minutes === 1 ? 'minute' : 'minutes' },
    { value: seconds, label: seconds === 1 ? 'second' : 'seconds' },
  ]
}

/** Frozen `getElapsedTime` (`AnniversaryCountdown.tsx:33-39`). */
export function getElapsedTime(now: Date): { years: number; days: number } {
  const diffMs = now.getTime() - WEDDING_DATE.getTime()
  const years = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25))
  const remainingMs = diffMs - years * 365.25 * 24 * 60 * 60 * 1000
  const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24))
  return { years, days }
}

/** Frozen `isDaysBeforeAnniversary` (`AnniversaryCountdown.tsx:41-50`). */
export function isDaysBeforeAnniversary(now: Date): boolean {
  const weddingMonth = WEDDING_DATE.getMonth()
  const weddingDay = WEDDING_DATE.getDate()
  const nextAnniversary = new Date(now.getFullYear(), weddingMonth, weddingDay)
  if (nextAnniversary <= now) {
    nextAnniversary.setFullYear(now.getFullYear() + 1)
  }
  const diffDays = (nextAnniversary.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  return diffDays <= ANNIVERSARY_WINDOW_DAYS
}

/** Frozen anniversary ordinal formatting (`AnniversaryCountdown.tsx:99-106`). */
export function formatAnniversaryNumber(anniversaryNumber: number): string {
  return anniversaryNumber === 1
    ? '1st'
    : anniversaryNumber === 2
      ? '2nd'
      : anniversaryNumber === 3
        ? '3rd'
        : `${anniversaryNumber}th`
}
