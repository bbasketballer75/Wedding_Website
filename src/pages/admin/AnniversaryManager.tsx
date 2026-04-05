import { useState, useEffect, useCallback } from 'react'
import { CalendarHeart, Plus, Trash2, Check, X, ChevronDown } from 'lucide-react'
import {
  fetchAllAnniversaryEntries,
  upsertAnniversaryEntry,
  deleteAnniversaryEntry,
  type AnniversaryEntry,
} from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/context/ToastContext'
import { cn } from '@/lib/utils'

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

interface FormState {
  year_number: string
  title: string
  summary: string
  photo_url: string
  couple_message: string
  is_published: boolean
}

const EMPTY_FORM: FormState = {
  year_number: '',
  title: '',
  summary: '',
  photo_url: '',
  couple_message: '',
  is_published: false,
}

function entryToForm(entry: AnniversaryEntry): FormState {
  return {
    year_number: String(entry.year_number),
    title: entry.title,
    summary: entry.summary ?? '',
    photo_url: entry.photo_url ?? '',
    couple_message: entry.couple_message ?? '',
    is_published: entry.is_published,
  }
}

export default function AnniversaryManager() {
  const { addToast } = useToast()
  const [entries, setEntries] = useState<AnniversaryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAllAnniversaryEntries()
      setEntries(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function startNew() {
    // Auto-suggest next year number
    const maxYear = entries.reduce((max, e) => Math.max(max, e.year_number), 0)
    setForm({ ...EMPTY_FORM, year_number: String(maxYear + 1) })
    setEditingId('new')
  }

  function startEdit(entry: AnniversaryEntry) {
    setForm(entryToForm(entry))
    setEditingId(entry.id)
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function handleSave() {
    const yearNum = parseInt(form.year_number, 10)
    if (!form.title.trim() || isNaN(yearNum) || yearNum < 1) {
      addToast('Year number and title are required.', 'error')
      return
    }

    setSaving(true)
    try {
      await upsertAnniversaryEntry({
        year_number: yearNum,
        title: form.title.trim(),
        summary: form.summary.trim() || null,
        photo_url: form.photo_url.trim() || null,
        couple_message: form.couple_message.trim() || null,
        is_published: form.is_published,
      })
      addToast(`Year ${ordinal(yearNum)} saved.`, 'success')
      cancelEdit()
      await load()
    } catch {
      addToast('Save failed — please try again.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await deleteAnniversaryEntry(id)
      addToast('Entry deleted.', 'success')
      setConfirmDeleteId(null)
      await load()
    } catch {
      addToast('Delete failed — please try again.', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  async function togglePublished(entry: AnniversaryEntry) {
    try {
      await upsertAnniversaryEntry({
        year_number: entry.year_number,
        title: entry.title,
        summary: entry.summary ?? null,
        photo_url: entry.photo_url ?? null,
        couple_message: entry.couple_message ?? null,
        is_published: !entry.is_published,
      })
      await load()
    } catch {
      addToast('Could not update publish status.', 'error')
    }
  }

  return (
    <div className="space-y-8">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-100">
            <CalendarHeart className="h-5 w-5 text-gold-600" />
          </div>
          <div>
            <p className="text-sm text-charcoal-500">
              {entries.length} {entries.length === 1 ? 'entry' : 'entries'} total
            </p>
          </div>
        </div>
        {editingId === null && (
          <Button onClick={startNew} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Year
          </Button>
        )}
      </div>

      {/* Inline form for new entry */}
      {editingId === 'new' && (
        <EntryForm
          form={form}
          setForm={setForm}
          onSave={handleSave}
          onCancel={cancelEdit}
          saving={saving}
          isNew
        />
      )}

      {/* Entry list */}
      {loading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-charcoal-200/40 bg-cream-100/60 p-6">
              <div className="mb-3 h-3 w-24 rounded bg-charcoal-200/40" />
              <div className="h-5 w-1/2 rounded bg-charcoal-200/30" />
            </div>
          ))}
        </div>
      ) : entries.length === 0 && editingId !== 'new' ? (
        <div className="py-16 text-center">
          <p className="text-charcoal-400 mb-4">No anniversary entries yet.</p>
          <Button onClick={startNew} size="sm" variant="secondary" className="gap-2">
            <Plus className="h-4 w-4" />
            Add the first year
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="overflow-hidden rounded-2xl border border-charcoal-200/40 bg-white shadow-sm"
            >
              {editingId === entry.id ? (
                <div className="p-6">
                  <EntryForm
                    form={form}
                    setForm={setForm}
                    onSave={handleSave}
                    onCancel={cancelEdit}
                    saving={saving}
                    isNew={false}
                  />
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4 p-6">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium uppercase tracking-[0.2em] text-gold-600">
                        {ordinal(entry.year_number)} anniversary
                      </span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-medium',
                          entry.is_published
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-charcoal-100 text-charcoal-500'
                        )}
                      >
                        {entry.is_published ? 'Published' : 'Draft'}
                      </span>
                    </div>
                    <p className="font-display text-lg text-charcoal-800">{entry.title}</p>
                    {entry.summary && (
                      <p className="mt-1 text-sm text-charcoal-500 line-clamp-2">{entry.summary}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void togglePublished(entry)}
                      title={entry.is_published ? 'Unpublish' : 'Publish'}
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-lg border transition-colors',
                        entry.is_published
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                          : 'border-charcoal-200 bg-charcoal-50 text-charcoal-400 hover:bg-charcoal-100'
                      )}
                    >
                      {entry.is_published ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(entry)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-charcoal-200 bg-charcoal-50 text-charcoal-500 hover:bg-charcoal-100 transition-colors"
                      title="Edit"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    {confirmDeleteId === entry.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void handleDelete(entry.id)}
                          disabled={deletingId === entry.id}
                          className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-600 disabled:opacity-50 transition-colors"
                        >
                          {deletingId === entry.id ? 'Deleting…' : 'Confirm'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-charcoal-200 text-charcoal-400 hover:bg-charcoal-100 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(entry.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-charcoal-200 bg-charcoal-50 text-charcoal-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface EntryFormProps {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  onSave: () => void
  onCancel: () => void
  saving: boolean
  isNew: boolean
}

function EntryForm({ form, setForm, onSave, onCancel, saving, isNew }: EntryFormProps) {
  function set(field: keyof FormState, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="space-y-4 rounded-2xl border border-gold-200/60 bg-gold-50/30 p-6">
      <p className="font-medium text-charcoal-800">{isNew ? 'New anniversary entry' : 'Edit entry'}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-charcoal-700">
            Year number <span className="text-rose-500">*</span>
          </label>
          <Input
            type="number"
            min={1}
            value={form.year_number}
            onChange={(e) => set('year_number', e.target.value)}
            placeholder="1"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-charcoal-700">
            Title <span className="text-rose-500">*</span>
          </label>
          <Input
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Our first year together"
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-charcoal-700">Summary</label>
        <Textarea
          value={form.summary}
          onChange={(e) => set('summary', e.target.value)}
          placeholder="A short description of this year…"
          rows={3}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-charcoal-700">
          Photo URL <span className="text-charcoal-400 font-normal">(optional — displayed as a header image)</span>
        </label>
        <Input
          value={form.photo_url}
          onChange={(e) => set('photo_url', e.target.value)}
          placeholder="https://…"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-charcoal-700">
          Couple message <span className="text-charcoal-400 font-normal">(shown as a pull-quote)</span>
        </label>
        <Textarea
          value={form.couple_message}
          onChange={(e) => set('couple_message', e.target.value)}
          placeholder="A personal note from the two of you…"
          rows={3}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={form.is_published}
          onClick={() => set('is_published', !form.is_published)}
          className={cn(
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
            form.is_published ? 'bg-gold-500' : 'bg-charcoal-200'
          )}
        >
          <span
            className={cn(
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
              form.is_published ? 'translate-x-5' : 'translate-x-0'
            )}
          />
        </button>
        <span className="text-sm text-charcoal-700">
          {form.is_published ? 'Published — visible on /anniversary' : 'Draft — not visible publicly'}
        </span>
      </div>

      <div className="flex gap-3 pt-2">
        <Button onClick={onSave} disabled={saving} size="sm" className="gap-2">
          {saving ? 'Saving…' : 'Save entry'}
        </Button>
        <Button onClick={onCancel} variant="secondary" size="sm">
          Cancel
        </Button>
      </div>
    </div>
  )
}
