import { useCallback, useEffect, useState } from 'react'
import type { Json } from '@/shared/data/schema'
import {
  FEATURED_SLOTS,
  featuredContentData,
  type EditorialFeature,
  type EditorialHistoryEntry,
  type EditorialSlot,
  type EditorialSlotMeta,
  type EditorialSourceType,
  type FeaturedContentData,
} from './featured-content-data'

/**
 * Featured-content editor state machine, ported from the frozen
 * `src/pages/admin/FeaturedContentManager.tsx`.
 *
 * Behaviour preserved:
 * - four fixed slots, one row per slot;
 * - selecting a slot loads the row + its last 80 history entries;
 * - saving validates a non-empty title, upserts the slot and appends a history
 *   entry whose `changeSummary` mirrors the frozen wording:
 *   `Set "<title>" as the active <label>` / `Updated "<title>" (inactive)`;
 * - "Turn off slot" deactivates the row (keeping its content) and appends
 *   `Deactivated <label>` to the history.
 */
export interface FeaturedContentFormState {
  isActive: boolean
  title: string
  summary: string
  badgeLabel: string
  ctaLabel: string
  sourceUrl: string
  sourceType: EditorialSourceType
}

export interface UseFeaturedContentOptions {
  readonly data?: FeaturedContentData
}

export interface UseFeaturedContentResult {
  slots: readonly EditorialSlotMeta[]
  activeSlotIndex: number
  activeSlot: EditorialSlotMeta
  feature: EditorialFeature | null
  history: readonly EditorialHistoryEntry[]
  form: FeaturedContentFormState
  loading: boolean
  saving: boolean
  clearing: boolean
  titleError: string | null
  statusMessage: string | null
  error: string | null
  selectSlot: (index: number) => void
  setField: <K extends keyof FeaturedContentFormState>(
    key: K,
    value: FeaturedContentFormState[K]
  ) => void
  save: () => Promise<void>
  clearSlot: () => Promise<void>
}

const EMPTY_FORM: FeaturedContentFormState = {
  isActive: false,
  title: '',
  summary: '',
  badgeLabel: '',
  ctaLabel: '',
  sourceUrl: '',
  sourceType: 'custom',
}

export function formStateFromFeature(feature: EditorialFeature | null): FeaturedContentFormState {
  if (!feature) return { ...EMPTY_FORM }
  return {
    isActive: feature.isActive,
    title: feature.title,
    summary: feature.summary ?? '',
    badgeLabel: feature.badgeLabel ?? '',
    ctaLabel: feature.ctaLabel ?? '',
    sourceUrl: feature.sourceUrl ?? '',
    sourceType: feature.sourceType,
  }
}

function toJsonFeature(feature: EditorialFeature | null): Json {
  if (!feature) return {}
  return {
    id: feature.id,
    slot: feature.slot,
    title: feature.title,
    summary: feature.summary,
    is_active: feature.isActive,
    badge_label: feature.badgeLabel,
    cta_label: feature.ctaLabel,
    source_url: feature.sourceUrl,
    source_type: feature.sourceType,
  }
}

export function useFeaturedContent(
  options: UseFeaturedContentOptions = {}
): UseFeaturedContentResult {
  const data = options.data ?? featuredContentData

  const [activeSlotIndex, setActiveSlotIndex] = useState(0)
  const activeSlot = FEATURED_SLOTS[activeSlotIndex] ?? FEATURED_SLOTS[0]
  const [feature, setFeature] = useState<EditorialFeature | null>(null)
  const [history, setHistory] = useState<readonly EditorialHistoryEntry[]>([])
  const [form, setForm] = useState<FeaturedContentFormState>({ ...EMPTY_FORM })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [titleError, setTitleError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadSlot = useCallback(
    async (slot: EditorialSlot): Promise<void> => {
      try {
        setLoading(true)
        setError(null)
        setTitleError(null)
        const [nextFeature, nextHistory] = await Promise.all([
          data.fetchFeature(slot),
          data.fetchHistory(slot),
        ])
        setFeature(nextFeature)
        setForm(formStateFromFeature(nextFeature))
        setHistory(nextHistory.slice(0, 10))
      } catch (loadError) {
        console.error('Featured content: could not load the slot.', loadError)
        setError('Could not load this editorial slot.')
        setFeature(null)
        setHistory([])
      } finally {
        setLoading(false)
      }
    },
    [data]
  )

  // Slot load: deferred so the effect body performs no synchronous state write
  // (frozen manager loads inside the same deferred pattern).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSlot(activeSlot.slot)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [activeSlot.slot, loadSlot])

  const selectSlot = useCallback((index: number): void => {
    setActiveSlotIndex(index)
    setStatusMessage(null)
  }, [])

  const setField = useCallback(
    <K extends keyof FeaturedContentFormState>(
      key: K,
      value: FeaturedContentFormState[K]
    ): void => {
      setForm(current => ({ ...current, [key]: value }))
      if (key === 'title') setTitleError(null)
    },
    []
  )

  const save = useCallback(async (): Promise<void> => {
    if (!form.title.trim()) {
      setTitleError('Title is required')
      return
    }

    setSaving(true)
    setStatusMessage(null)
    setError(null)
    const previous = feature

    try {
      const saved = await data.saveFeature({
        slot: activeSlot.slot,
        title: form.title.trim(),
        summary: form.summary.trim() || null,
        badgeLabel: form.badgeLabel.trim() || null,
        ctaLabel: form.ctaLabel.trim() || null,
        sourceUrl: form.sourceUrl.trim() || null,
        sourceType: form.sourceType,
        isActive: form.isActive,
      })

      await data.appendHistory({
        slot: activeSlot.slot,
        featureId: saved.id,
        changeSummary: form.isActive
          ? `Set "${saved.title}" as the active ${activeSlot.label}`
          : `Updated "${saved.title}" (inactive)`,
        previousFeature: toJsonFeature(previous),
        nextFeature: toJsonFeature(saved),
      })

      setFeature(saved)
      setForm(formStateFromFeature(saved))
      const refreshed = await data.fetchHistory(activeSlot.slot)
      setHistory(refreshed.slice(0, 10))
      setStatusMessage(form.isActive ? `${activeSlot.label} is now live` : 'Saved (slot is off)')
    } catch (saveError) {
      console.error('Featured content: could not save the slot.', saveError)
      setError('Could not save the slot. Check the console for details.')
    } finally {
      setSaving(false)
    }
  }, [activeSlot.label, activeSlot.slot, data, feature, form])

  const clearSlot = useCallback(async (): Promise<void> => {
    if (!feature) return

    setClearing(true)
    setStatusMessage(null)
    setError(null)
    const previous = feature

    try {
      const cleared = await data.saveFeature({
        slot: activeSlot.slot,
        title: feature.title,
        summary: feature.summary,
        badgeLabel: feature.badgeLabel,
        ctaLabel: feature.ctaLabel,
        sourceUrl: feature.sourceUrl,
        sourceType: feature.sourceType,
        isActive: false,
      })

      await data.appendHistory({
        slot: activeSlot.slot,
        featureId: cleared.id,
        changeSummary: `Deactivated ${activeSlot.label}`,
        previousFeature: toJsonFeature(previous),
        nextFeature: toJsonFeature(cleared),
      })

      setFeature(cleared)
      setForm(current => ({ ...current, isActive: false }))
      const refreshed = await data.fetchHistory(activeSlot.slot)
      setHistory(refreshed.slice(0, 10))
      setStatusMessage(`${activeSlot.label} turned off`)
    } catch (clearError) {
      console.error('Featured content: could not deactivate the slot.', clearError)
      setError('Could not deactivate the slot.')
    } finally {
      setClearing(false)
    }
  }, [activeSlot.label, activeSlot.slot, data, feature])

  return {
    slots: FEATURED_SLOTS,
    activeSlotIndex,
    activeSlot,
    feature,
    history,
    form,
    loading,
    saving,
    clearing,
    titleError,
    statusMessage,
    error,
    selectSlot,
    setField,
    save,
    clearSlot,
  }
}
