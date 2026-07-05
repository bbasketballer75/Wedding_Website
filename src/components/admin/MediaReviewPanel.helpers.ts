/**
 * Pure helpers and constants for MediaReviewPanel — no JSX so they can live in
 * a .ts file (fast-refresh rule: a file exports either components OR values).
 */

import type { MediaReviewFace } from '@/lib/supabase'
import type { FaceDraft } from '@/stores/mediaReviewStore'

/** When listing faces in a person group, cap the preview to avoid OOM on huge clusters. */
export const PERSON_GROUP_SAMPLE_LIMIT = 60

/** Convert a MediaReviewFace from the DB shape into the editable FaceDraft shape. */
export function normalizeFaceDraft(face: MediaReviewFace): FaceDraft {
  const confirmedName = face.confirmed_name || ''
  return {
    reviewStatus: face.review_status,
    confirmedName,
    personKey: face.person_key || (confirmedName ? slugifyPerson(confirmedName) : ''),
    notes: face.notes || '',
  }
}

/** "The Poradas" → "the-poradas". Used to derive person_key from confirmed name. */
export function slugifyPerson(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
