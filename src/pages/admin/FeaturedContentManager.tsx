import { useState, useEffect, useCallback } from 'react'
import { Sparkles, Check, X } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import {
  fetchSiteEditorialFeatureBySlot,
  fetchSiteEditorialFeatureHistory,
  upsertSiteEditorialFeature,
  recordSiteEditorialFeatureHistory,
  type SiteEditorialFeature,
  type SiteEditorialFeatureSlot,
  type SiteEditorialFeatureHistoryEntry,
  type SiteEditorialFeatureSourceType,
} from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/context/ToastContext'
import { getAdminAuditActor } from './utils'
import { cn } from '@/lib/utils'

// ─── Slot metadata ────────────────────────────────────────────────────────────

interface SlotMeta {
  slot: SiteEditorialFeatureSlot
  label: string
  description: string
  defaultBadge: string
}

const SLOTS: SlotMeta[] = [
  {
    slot: 'home_moment_of_the_week',
    label: 'Moment of the Week',
    description: 'Appears as a cinematic card below the guest highlight reel on the homepage.',
    defaultBadge: 'Moment of the Week',
  },
  {
    slot: 'home_newest_standout_upload',
    label: 'Standout Upload',
    description: 'Highlights an outstanding guest photo or video submission on the homepage.',
    defaultBadge: 'Standout Upload',
  },
  {
    slot: 'home_featured_guestbook_note',
    label: 'Featured Note',
    description: 'Surfaces a guestbook message as a featured quote on the homepage.',
    defaultBadge: 'Featured Note',
  },
  {
    slot: 'film_featured_guest_video',
    label: 'Film Feature',
    description: 'Highlights a guest video within the film player page.',
    defaultBadge: 'Film Feature',
  },
]

const SOURCE_TYPE_OPTIONS: { value: SiteEditorialFeatureSourceType; label: string }[] = [
  { value: 'custom', label: 'Custom (typed content)' },
  { value: 'guest_upload', label: 'Guest Upload' },
  { value: 'guestbook_message', label: 'Guestbook Message' },
  { value: 'film_chapter', label: 'Film Chapter' },
]

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  isActive: boolean
  title: string
  summary: string
  badgeLabel: string
  ctaLabel: string
  sourceUrl: string
  sourceType: SiteEditorialFeatureSourceType
}

function buildFormState(feature: SiteEditorialFeature | null): FormState {
  return {
    isActive: feature?.is_active ?? false,
    title: feature?.title ?? '',
    summary: feature?.summary ?? '',
    badgeLabel: feature?.badge_label ?? '',
    ctaLabel: feature?.cta_label ?? '',
    sourceUrl: feature?.source_url ?? '',
    sourceType: feature?.source_type ?? 'custom',
  }
}

function formatHistoryTimestamp(ts: string) {
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ts
  return d.toLocaleString()
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FeaturedContentManager() {
  const { user } = useAuthStore()
  const { addToast } = useToast()
  const actor = getAdminAuditActor(user)

  const [activeSlotIndex, setActiveSlotIndex] = useState(0)
  const activeMeta = SLOTS[activeSlotIndex]

  const [feature, setFeature] = useState<SiteEditorialFeature | null>(null)
  const [history, setHistory] = useState<SiteEditorialFeatureHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [clearing, setClearing] = useState(false)

  const [form, setForm] = useState<FormState>(buildFormState(null))
  const [titleError, setTitleError] = useState('')

  const loadSlot = useCallback(async (meta: SlotMeta) => {
    setLoading(true)
    setTitleError('')

    const [{ data: featureData }, { data: historyData }] = await Promise.all([
      fetchSiteEditorialFeatureBySlot(meta.slot),
      fetchSiteEditorialFeatureHistory(meta.slot),
    ])

    setFeature(featureData ?? null)
    setHistory(historyData ?? [])
    setForm(buildFormState(featureData ?? null))
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadSlot(activeMeta)
  }, [activeMeta, loadSlot])

  function handleTabClick(index: number) {
    if (index === activeSlotIndex) return
    setActiveSlotIndex(index)
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
    if (key === 'title') setTitleError('')
  }

  async function handleSave() {
    if (!form.title.trim()) {
      setTitleError('Title is required')
      return
    }

    setSaving(true)

    const previous = feature ? { ...feature } : {}

    const { data: saved, error } = await upsertSiteEditorialFeature({
      slot: activeMeta.slot,
      title: form.title.trim(),
      summary: form.summary.trim() || null,
      badgeLabel: form.badgeLabel.trim() || null,
      ctaLabel: form.ctaLabel.trim() || null,
      sourceUrl: form.sourceUrl.trim() || null,
      sourceType: form.sourceType,
      isActive: form.isActive,
      actor: { userId: actor.userId, email: actor.email },
    })

    if (error || !saved) {
      addToast('Failed to save — check the console for details', 'error')
      setSaving(false)
      return
    }

    await recordSiteEditorialFeatureHistory({
      slot: activeMeta.slot,
      featureId: saved.id,
      changeSummary: form.isActive
        ? `Set "${saved.title}" as the active ${activeMeta.label}`
        : `Updated "${saved.title}" (inactive)`,
      previousFeature: previous as Record<string, unknown>,
      nextFeature: saved as unknown as Record<string, unknown>,
      actor: { userId: actor.userId, email: actor.email },
    })

    setFeature(saved)

    const { data: updatedHistory } = await fetchSiteEditorialFeatureHistory(activeMeta.slot)
    setHistory(updatedHistory ?? [])

    addToast(form.isActive ? `${activeMeta.label} is now live` : 'Saved (slot is off)', 'success')
    setSaving(false)
  }

  async function handleClear() {
    if (!feature) return

    setClearing(true)

    const previous = { ...feature }

    const { data: cleared, error } = await upsertSiteEditorialFeature({
      slot: activeMeta.slot,
      title: feature.title,
      summary: feature.summary,
      badgeLabel: feature.badge_label,
      ctaLabel: feature.cta_label,
      sourceUrl: feature.source_url,
      sourceType: feature.source_type,
      isActive: false,
      actor: { userId: actor.userId, email: actor.email },
    })

    if (error || !cleared) {
      addToast('Failed to deactivate slot', 'error')
      setClearing(false)
      return
    }

    await recordSiteEditorialFeatureHistory({
      slot: activeMeta.slot,
      featureId: cleared.id,
      changeSummary: `Deactivated ${activeMeta.label}`,
      previousFeature: previous as unknown as Record<string, unknown>,
      nextFeature: cleared as unknown as Record<string, unknown>,
      actor: { userId: actor.userId, email: actor.email },
    })

    setFeature(cleared)
    setForm(prev => ({ ...prev, isActive: false }))

    const { data: updatedHistory } = await fetchSiteEditorialFeatureHistory(activeMeta.slot)
    setHistory(updatedHistory ?? [])

    addToast(`${activeMeta.label} turned off`, 'success')
    setClearing(false)
  }

  return (
    <div className='space-y-5'>
      {/* Slot tabs */}
      <div className='overflow-hidden rounded-[1.15rem] border border-gold-100 bg-white/95 shadow-sm'>
        <div className='border-b border-gold-100 px-5 py-4'>
          <p className='text-[10px] uppercase tracking-[0.32em] text-charcoal-500'>
            Editorial slots
          </p>
          <p className='mt-1 text-sm leading-5 text-charcoal-500'>
            Each slot controls one live spotlight section. Select a slot to view and edit its
            content.
          </p>
        </div>
        <div className='flex flex-wrap gap-2 px-4 py-4'>
          {SLOTS.map((meta, i) => (
            <button
              key={meta.slot}
              data-testid={`featured-slot-${meta.slot}`}
              type='button'
              onClick={() => handleTabClick(i)}
              className={cn(
                'rounded-full border px-4 py-2 text-sm font-medium transition-all',
                i === activeSlotIndex
                  ? 'border-gold-300 bg-gold-50 text-gold-800 shadow-[0_4px_12px_rgba(219,180,92,0.14)]'
                  : 'border-gold-100 bg-white text-charcoal-600 hover:border-gold-200 hover:bg-cream-50/80'
              )}
            >
              {meta.label}
            </button>
          ))}
        </div>
      </div>

      {/* Active status banner */}
      {!loading && feature && (
        <div
          className={cn(
            'flex items-center gap-3 rounded-[1.15rem] border px-5 py-3.5',
            feature.is_active
              ? 'border-emerald-200 bg-emerald-50/60 text-emerald-800'
              : 'border-gold-100 bg-cream-50/60 text-charcoal-600'
          )}
        >
          {feature.is_active ? (
            <Check className='h-4 w-4 shrink-0 text-emerald-600' />
          ) : (
            <X className='h-4 w-4 shrink-0 text-charcoal-400' />
          )}
          <span className='text-sm'>
            {feature.is_active
              ? `This slot is live — guests on the homepage see "${feature.title}"`
              : 'This slot is off — nothing is shown to guests right now'}
          </span>
        </div>
      )}

      {/* Edit form */}
      <div className='overflow-hidden rounded-[1.15rem] border border-gold-100 bg-white/95 shadow-sm'>
        <div className='border-b border-gold-100 px-5 py-4'>
          <p className='text-[10px] uppercase tracking-[0.32em] text-charcoal-500'>
            {activeMeta.label}
          </p>
          <h2 className='mt-1 font-display text-xl text-charcoal-900'>Edit slot content</h2>
          <p className='mt-1 text-sm leading-5 text-charcoal-500'>{activeMeta.description}</p>
        </div>

        {loading ? (
          <div className='space-y-4 px-5 py-6 animate-pulse'>
            <div className='h-4 w-24 rounded-full bg-gold-100/60' />
            <div className='h-11 rounded-full bg-gold-50/80' />
            <div className='h-4 w-24 rounded-full bg-gold-100/60' />
            <div className='h-24 rounded-2xl bg-gold-50/80' />
            <div className='h-4 w-32 rounded-full bg-gold-100/60' />
            <div className='h-11 rounded-full bg-gold-50/80' />
          </div>
        ) : (
          <div className='px-5 py-6 space-y-5'>
            {/* is_active toggle */}
            <div className='flex items-center justify-between rounded-[1rem] border border-gold-100 bg-cream-50/60 px-4 py-3.5'>
              <div>
                <p className='text-sm font-medium text-charcoal-800'>
                  {form.isActive ? 'Slot is live' : 'Slot is off'}
                </p>
                <p className='text-xs text-charcoal-500 mt-0.5'>
                  {form.isActive
                    ? 'Guests can currently see this content on the site.'
                    : 'Content is saved but not shown to guests.'}
                </p>
              </div>
              <button
                type='button'
                role='switch'
                aria-checked={form.isActive}
                aria-label={form.isActive ? 'Deactivate slot' : 'Activate slot'}
                onClick={() => setField('isActive', !form.isActive)}
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2',
                  form.isActive ? 'bg-gold-500' : 'bg-charcoal-200'
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200',
                    form.isActive ? 'translate-x-5' : 'translate-x-0'
                  )}
                />
              </button>
            </div>

            {/* Title */}
            <div className='space-y-1.5'>
              <label htmlFor='fcm-title' className='block text-xs font-medium text-charcoal-700'>
                Title <span className='text-rose-500'>*</span>
              </label>
              <Input
                id='fcm-title'
                value={form.title}
                onChange={e => setField('title', e.target.value)}
                placeholder='e.g. First dance under the stars'
                error={titleError || undefined}
              />
            </div>

            {/* Summary */}
            <div className='space-y-1.5'>
              <label htmlFor='fcm-summary' className='block text-xs font-medium text-charcoal-700'>
                Summary <span className='text-charcoal-400 font-normal'>(optional)</span>
              </label>
              <textarea
                id='fcm-summary'
                value={form.summary}
                onChange={e => setField('summary', e.target.value)}
                placeholder='A short description shown below the title…'
                rows={3}
                className='w-full rounded-2xl border border-gold-200/60 bg-white/70 backdrop-blur-sm px-4 py-3 text-sm text-charcoal-900 placeholder:text-charcoal-400 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2 resize-none'
              />
            </div>

            {/* Badge label + CTA label */}
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
              <div className='space-y-1.5'>
                <label htmlFor='fcm-badge' className='block text-xs font-medium text-charcoal-700'>
                  Badge label <span className='text-charcoal-400 font-normal'>(optional)</span>
                </label>
                <Input
                  id='fcm-badge'
                  value={form.badgeLabel}
                  onChange={e => setField('badgeLabel', e.target.value)}
                  placeholder={activeMeta.defaultBadge}
                  hint='Shown above the title as a small tag'
                />
              </div>
              <div className='space-y-1.5'>
                <label htmlFor='fcm-cta' className='block text-xs font-medium text-charcoal-700'>
                  CTA label <span className='text-charcoal-400 font-normal'>(optional)</span>
                </label>
                <Input
                  id='fcm-cta'
                  value={form.ctaLabel}
                  onChange={e => setField('ctaLabel', e.target.value)}
                  placeholder='Explore this moment'
                  hint="Button text — defaults to 'Explore this moment'"
                />
              </div>
            </div>

            {/* Source URL + source type */}
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
              <div className='space-y-1.5'>
                <label
                  htmlFor='fcm-source-url'
                  className='block text-xs font-medium text-charcoal-700'
                >
                  Link URL <span className='text-charcoal-400 font-normal'>(optional)</span>
                </label>
                <Input
                  id='fcm-source-url'
                  value={form.sourceUrl}
                  onChange={e => setField('sourceUrl', e.target.value)}
                  placeholder='https://…'
                  hint='Where the CTA button points'
                />
              </div>
              <div className='space-y-1.5'>
                <label
                  htmlFor='fcm-source-type'
                  className='block text-xs font-medium text-charcoal-700'
                >
                  Content type
                </label>
                <select
                  id='fcm-source-type'
                  value={form.sourceType}
                  onChange={e =>
                    setField('sourceType', e.target.value as SiteEditorialFeatureSourceType)
                  }
                  className='flex h-11 w-full rounded-full border border-gold-200/60 bg-white/70 backdrop-blur-sm px-5 py-2 text-sm text-charcoal-900 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2'
                >
                  {SOURCE_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className='flex flex-wrap items-center gap-3 pt-1 border-t border-gold-100'>
              <Button
                variant='primary'
                size='md'
                onClick={() => void handleSave()}
                disabled={saving || clearing}
              >
                {saving ? 'Saving…' : 'Save'}
              </Button>
              {feature?.is_active && (
                <Button
                  variant='ghost'
                  size='md'
                  onClick={() => void handleClear()}
                  disabled={saving || clearing}
                >
                  {clearing ? 'Turning off…' : 'Turn off slot'}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Change history */}
      {history.length > 0 && (
        <div className='overflow-hidden rounded-[1.15rem] border border-gold-100 bg-white/95 shadow-sm'>
          <div className='border-b border-gold-100 px-5 py-4'>
            <p className='text-[10px] uppercase tracking-[0.32em] text-charcoal-500'>
              Change history
            </p>
            <p className='mt-1 text-sm leading-5 text-charcoal-500'>
              Last {Math.min(history.length, 10)} changes to this slot.
            </p>
          </div>
          <div className='divide-y divide-gold-50'>
            {history.slice(0, 10).map(entry => (
              <div key={entry.id} className='flex items-start gap-4 px-5 py-3.5'>
                <div className='mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-50 text-gold-500'>
                  <Sparkles className='h-3 w-3' />
                </div>
                <div className='min-w-0 flex-1'>
                  <p className='text-sm text-charcoal-800'>{entry.change_summary}</p>
                  <p className='mt-0.5 text-xs text-charcoal-400'>
                    {entry.actor_email ?? 'Admin'} · {formatHistoryTimestamp(entry.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
