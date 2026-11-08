import { Check, Sparkles, X } from 'lucide-react'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import {
  EDITORIAL_SOURCE_TYPE_OPTIONS,
  type EditorialSourceType,
  type FeaturedContentData,
} from './featured-content-data'
import { useFeaturedContent } from './useFeaturedContent'

/**
 * `/admin/featured` — editorial slot manager.
 *
 * Ported from the frozen `src/pages/admin/FeaturedContentManager.tsx`: four
 * fixed slots, one row per slot, active toggle, title/summary/badge/CTA/link/
 * source-type fields and the last ten change-history entries.
 *
 * Deltas: the frozen page reported success through the app toast context. The
 * rebuild has no global toast provider yet, so save/clear results are announced
 * inline with `role='status'` (same copy: "… is now live", "Saved (slot is
 * off)", "… turned off") — a W8 superset once toasts land.
 */
export interface FeaturedContentPageProps {
  readonly data?: FeaturedContentData
}

function formatHistoryTimestamp(timestamp: string): string {
  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) return timestamp
  return parsed.toLocaleString()
}

export function FeaturedContentPage({ data }: FeaturedContentPageProps = {}) {
  const editor = useFeaturedContent({ data })
  const { form, activeSlot, feature } = editor

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
        <div className='flex flex-wrap gap-2 px-4 py-4' role='tablist' aria-label='Editorial slots'>
          {editor.slots.map((meta, index) => (
            <button
              key={meta.slot}
              data-testid={`featured-slot-${meta.slot}`}
              type='button'
              role='tab'
              aria-selected={index === editor.activeSlotIndex}
              onClick={() => editor.selectSlot(index)}
              className={cn(
                'rounded-full border px-4 py-2 text-sm font-medium transition-all',
                index === editor.activeSlotIndex
                  ? 'border-gold-300 bg-gold-50 text-gold-800 shadow-[0_4px_12px_rgba(219,180,92,0.14)]'
                  : 'border-gold-100 bg-white text-charcoal-600 hover:border-gold-200 hover:bg-cream-50/80'
              )}
            >
              {meta.label}
            </button>
          ))}
        </div>
      </div>

      {editor.statusMessage && (
        <p
          role='status'
          className='rounded-[1.15rem] border border-emerald-200 bg-emerald-50/60 px-5 py-3 text-sm text-emerald-800'
        >
          {editor.statusMessage}
        </p>
      )}
      {editor.error && (
        <p
          role='alert'
          className='rounded-[1.15rem] border border-rose-200 bg-rose-50/60 px-5 py-3 text-sm text-rose-700'
        >
          {editor.error}
        </p>
      )}

      {/* Active status banner */}
      {!editor.loading && feature && (
        <div
          className={cn(
            'flex items-center gap-3 rounded-[1.15rem] border px-5 py-3.5',
            feature.isActive
              ? 'border-emerald-200 bg-emerald-50/60 text-emerald-800'
              : 'border-gold-100 bg-cream-50/60 text-charcoal-600'
          )}
        >
          {feature.isActive ? (
            <Check className='h-4 w-4 shrink-0 text-emerald-600' aria-hidden='true' />
          ) : (
            <X className='h-4 w-4 shrink-0 text-charcoal-400' aria-hidden='true' />
          )}
          <span className='text-sm'>
            {feature.isActive
              ? `This slot is live — guests on the homepage see "${feature.title}"`
              : 'This slot is off — nothing is shown to guests right now'}
          </span>
        </div>
      )}

      {/* Edit form */}
      <div className='overflow-hidden rounded-[1.15rem] border border-gold-100 bg-white/95 shadow-sm'>
        <div className='border-b border-gold-100 px-5 py-4'>
          <p className='text-[10px] uppercase tracking-[0.32em] text-charcoal-500'>
            {activeSlot.label}
          </p>
          <h2 className='mt-1 font-display text-xl text-charcoal-900'>Edit slot content</h2>
          <p className='mt-1 text-sm leading-5 text-charcoal-500'>{activeSlot.description}</p>
        </div>

        {editor.loading ? (
          <div
            className='space-y-4 px-5 py-6 animate-pulse'
            role='status'
            aria-label='Loading editorial slot'
          >
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
                onClick={() => editor.setField('isActive', !form.isActive)}
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
                onChange={event => editor.setField('title', event.target.value)}
                placeholder='e.g. First dance under the stars'
                error={editor.titleError ?? undefined}
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
                onChange={event => editor.setField('summary', event.target.value)}
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
                  onChange={event => editor.setField('badgeLabel', event.target.value)}
                  placeholder={activeSlot.defaultBadge}
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
                  onChange={event => editor.setField('ctaLabel', event.target.value)}
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
                  onChange={event => editor.setField('sourceUrl', event.target.value)}
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
                  onChange={event =>
                    editor.setField('sourceType', event.target.value as EditorialSourceType)
                  }
                  className='flex h-11 w-full rounded-full border border-gold-200/60 bg-white/70 backdrop-blur-sm px-5 py-2 text-sm text-charcoal-900 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2'
                >
                  {EDITORIAL_SOURCE_TYPE_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
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
                onClick={() => void editor.save()}
                disabled={editor.saving || editor.clearing}
              >
                {editor.saving ? 'Saving…' : 'Save'}
              </Button>
              {feature?.isActive && (
                <Button
                  variant='ghost'
                  size='md'
                  onClick={() => void editor.clearSlot()}
                  disabled={editor.saving || editor.clearing}
                >
                  {editor.clearing ? 'Turning off…' : 'Turn off slot'}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Change history */}
      {editor.history.length > 0 && (
        <div className='overflow-hidden rounded-[1.15rem] border border-gold-100 bg-white/95 shadow-sm'>
          <div className='border-b border-gold-100 px-5 py-4'>
            <p className='text-[10px] uppercase tracking-[0.32em] text-charcoal-500'>
              Change history
            </p>
            <p className='mt-1 text-sm leading-5 text-charcoal-500'>
              Last {Math.min(editor.history.length, 10)} changes to this slot.
            </p>
          </div>
          <div className='divide-y divide-gold-50'>
            {editor.history.slice(0, 10).map(entry => (
              <div key={entry.id} className='flex items-start gap-4 px-5 py-3.5'>
                <div className='mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-50 text-gold-500'>
                  <Sparkles className='h-3 w-3' aria-hidden='true' />
                </div>
                <div className='min-w-0 flex-1'>
                  <p className='text-sm text-charcoal-800'>{entry.changeSummary}</p>
                  <p className='mt-0.5 text-xs text-charcoal-400'>
                    {entry.actorEmail ?? 'Admin'} · {formatHistoryTimestamp(entry.createdAt)}
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
