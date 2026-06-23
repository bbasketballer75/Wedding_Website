# Phase 8: Moderation Queue & Featured Spotlight - Pattern Map

**Mapped:** 2026-04-27
**Files analyzed:** 8 new/modified files
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/08_rejection_reason.sql` | migration | file-I/O | `20240303000000_init_schema.sql` | exact |
| `src/lib/supabase.ts` (add functions) | service | CRUD | `src/lib/supabase.ts:870-878` (fetchApprovedGuestUploads) | role-match |
| `src/stores/moderationStore.ts` | store | CRUD | `src/stores/mediaReviewStore.ts` | exact |
| `src/components/admin/GuestUploadModerationList.tsx` | component | CRUD | `src/components/admin/BatchList.tsx` | exact |
| `src/components/admin/UploadCard.tsx` | component | request-response | `src/components/admin/MediaReviewPanel.tsx` | role-match |
| `src/components/admin/BulkActionToolbar.tsx` | component | request-response | `src/components/admin/BatchList.tsx:81-135` | exact |
| `src/components/admin/ModerationConfirmDialog.tsx` | component | event-driven | `src/components/admin/ClusterMergeModal.tsx` | role-match |
| `src/pages/Gallery.tsx` (extend status page) | page | request-response | `src/pages/Gallery.tsx:503-1036` | exact |
| `src/components/admin/MediaReviewPanel.tsx` (add tab) | component | request-response | `src/components/admin/MediaReviewPanel.tsx` | exact |

## Pattern Assignments

### `supabase/migrations/08_rejection_reason.sql` (migration, file-I/O)

**Analog:** `supabase/migrations/20240303000000_init_schema.sql` (lines 69-148)

**Guest uploads table pattern** (lines 69-78):
```sql
create table if not exists guest_uploads (
  id uuid default gen_random_uuid() primary key,
  guest_name text not null,
  guest_email text not null,
  message text,
  photo_urls text[] default '{}',
  video_urls text[] default '{}',
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamp with time zone default now()
);
```

**RLS policy pattern** (lines 130-143):
```sql
-- Allow authenticated users to update status (for admin approval)
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'guest_uploads'
      and policyname = 'Allow authenticated update'
  ) then
    create policy "Allow authenticated update" on guest_uploads
      for update using (auth.role() = 'authenticated');
  end if;
end
$$;
```

**Migration structure pattern:**
```sql
-- Add rejection_reason column
alter table guest_uploads
add column if not exists rejection_reason text;

-- Create index for status queries
create index if not exists idx_guest_uploads_status on guest_uploads(status);

-- RLS already exists for UPDATE (line 130-143 in init_schema.sql)
-- Verify with: select policyname from pg_policies where tablename = 'guest_uploads';
```

---

### `src/lib/supabase.ts` (add functions for moderation)

**Analog:** `src/lib/supabase.ts:870-878` (fetchApprovedGuestUploads)

**Fetch pending uploads pattern** (lines 870-878):
```typescript
export async function fetchApprovedGuestUploads(): Promise<GuestUpload[]> {
  const { data, error } = await supabase
    .from('guest_uploads')
    .select('*')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}
```

**Moderation audit pattern** (lines 400-417):
```typescript
export async function recordModerationAudit(input: RecordModerationAuditInput) {
  return await supabase
    .from('moderation_audit_log')
    .insert({
      entity_type: input.entityType,
      entity_id: input.entityId,
      action: input.action,
      actor_user_id: input.actor?.userId ?? null,
      actor_email: input.actor?.email ?? null,
      actor_name: input.actor?.name ?? null,
      from_status: input.fromStatus ?? null,
      to_status: input.toStatus ?? null,
      summary: input.summary,
      metadata: input.metadata ?? {},
    })
    .select('*')
    .single<ModerationAuditLog>()
}
```

**New functions to add:**
```typescript
// Fetch pending guest uploads for moderation queue
export async function fetchPendingGuestUploads(): Promise<GuestUpload[]> {
  const { data, error } = await supabase
    .from('guest_uploads')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

// Approve a single guest upload
export async function approveGuestUpload(uploadId: string, actor?: ModerationAuditActor) {
  const { data: existing } = await supabase
    .from('guest_uploads')
    .select('status')
    .eq('id', uploadId)
    .single()

  const { error } = await supabase
    .from('guest_uploads')
    .update({ status: 'approved' })
    .eq('id', uploadId)

  if (error) throw error

  await recordModerationAudit({
    entityType: 'guest_upload',
    entityId: uploadId,
    action: 'upload_rejected', // Use existing action
    fromStatus: existing?.status ?? null,
    toStatus: 'approved',
    summary: `Guest upload approved`,
    actor,
  })
}

// Reject a single guest upload with reason
export async function rejectGuestUpload(uploadId: string, reason?: string, actor?: ModerationAuditActor) {
  const { data: existing } = await supabase
    .from('guest_uploads')
    .select('status')
    .eq('id', uploadId)
    .single()

  const { error } = await supabase
    .from('guest_uploads')
    .update({ status: 'rejected', rejection_reason: reason ?? null })
    .eq('id', uploadId)

  if (error) throw error

  await recordModerationAudit({
    entityType: 'guest_upload',
    entityId: uploadId,
    action: 'upload_rejected',
    fromStatus: existing?.status ?? null,
    toStatus: 'rejected',
    summary: reason ? `Guest upload rejected: ${reason}` : `Guest upload rejected`,
    metadata: reason ? { rejection_reason: reason } : {},
    actor,
  })
}

// Bulk approve guest uploads
export async function bulkApproveGuestUploads(uploadIds: string[], actor?: ModerationAuditActor) {
  const { error } = await supabase
    .from('guest_uploads')
    .update({ status: 'approved' })
    .in('id', uploadIds)

  if (error) throw error

  for (const uploadId of uploadIds) {
    await recordModerationAudit({
      entityType: 'guest_upload',
      entityId: uploadId,
      action: 'upload_rejected', // Use existing bulk action
      fromStatus: 'pending',
      toStatus: 'approved',
      summary: `Guest upload bulk approved`,
      actor,
    })
  }
}

// Bulk reject guest uploads with optional reason
export async function bulkRejectGuestUploads(uploadIds: string[], reason?: string, actor?: ModerationAuditActor) {
  const { error } = await supabase
    .from('guest_uploads')
    .update({ status: 'rejected', rejection_reason: reason ?? null })
    .in('id', uploadIds)

  if (error) throw error

  for (const uploadId of uploadIds) {
    await recordModerationAudit({
      entityType: 'guest_upload',
      entityId: uploadId,
      action: 'upload_bulk_rejected',
      fromStatus: 'pending',
      toStatus: 'rejected',
      summary: reason ? `Guest upload bulk rejected: ${reason}` : `Guest upload bulk rejected`,
      metadata: reason ? { rejection_reason: reason } : {},
      actor,
    })
  }
}

// Fetch rejection reason for guest upload status page
export async function fetchGuestUploadRejectionReason(uploadId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('guest_uploads')
    .select('rejection_reason')
    .eq('id', uploadId)
    .single()

  if (error) return null
  return data?.rejection_reason ?? null
}
```

---

### `src/stores/moderationStore.ts` (store, CRUD)

**Analog:** `src/stores/mediaReviewStore.ts` (lines 1-716)

**Zustand store pattern** (lines 325-706):
```typescript
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { GuestUpload } from '@/lib/supabase'
import {
  fetchPendingGuestUploads,
  approveGuestUpload,
  rejectGuestUpload,
  bulkApproveGuestUploads,
  bulkRejectGuestUploads,
} from '@/lib/supabase'

interface ModerationState {
  // State
  uploads: GuestUpload[]
  selectedUploadIds: Set<string>
  loading: boolean
  savingIds: Set<string>

  // Actions
  loadUploads: () => Promise<void>
  selectUpload: (id: string) => void
  deselectUpload: (id: string) => void
  selectAll: () => void
  deselectAll: () => void
  approveUpload: (id: string) => Promise<void>
  rejectUpload: (id: string, reason?: string) => Promise<void>
  bulkApprove: () => Promise<void>
  bulkReject: (reason?: string) => Promise<void>
}

export const useModerationStore = create<ModerationState>()(
  devtools(
    (set, get) => ({
      // Initial state
      uploads: [],
      selectedUploadIds: new Set(),
      loading: false,
      savingIds: new Set(),

      // Actions
      loadUploads: async () => {
        set({ loading: true })
        const uploads = await fetchPendingGuestUploads()
        set({ uploads, loading: false })
      },

      selectUpload: (id) => set((state) => ({
        selectedUploadIds: new Set([...state.selectedUploadIds, id])
      })),

      deselectUpload: (id) => set((state) => {
        const next = new Set(state.selectedUploadIds)
        next.delete(id)
        return { selectedUploadIds: next }
      }),

      selectAll: () => set((state) => ({
        selectedUploadIds: new Set(state.uploads.map(u => u.id))
      })),

      deselectAll: () => set({ selectedUploadIds: new Set() }),

      approveUpload: async (id) => {
        set((state) => ({ savingIds: new Set([...state.savingIds, id]) }))
        await approveGuestUpload(id)
        set((state) => ({
          uploads: state.uploads.map(u => u.id === id ? { ...u, status: 'approved' as const } : u),
          savingIds: (() => { const s = new Set(state.savingIds); s.delete(id); return s })(),
        }))
      },

      rejectUpload: async (id, reason) => {
        set((state) => ({ savingIds: new Set([...state.savingIds, id]) }))
        await rejectGuestUpload(id, reason)
        set((state) => ({
          uploads: state.uploads.map(u => u.id === id ? { ...u, status: 'rejected' as const, rejection_reason: reason ?? null } : u),
          savingIds: (() => { const s = new Set(state.savingIds); s.delete(id); return s })(),
        }))
      },

      bulkApprove: async () => {
        const { selectedUploadIds, uploads } = get()
        const ids = [...selectedUploadIds]
        set((state) => ({ savingIds: new Set([...state.savingIds, ...ids]) }))
        await bulkApproveGuestUploads(ids)
        set((state) => ({
          uploads: state.uploads.map(u => ids.includes(u.id) ? { ...u, status: 'approved' as const } : u),
          selectedUploadIds: new Set(),
          savingIds: (() => { const s = new Set(state.savingIds); ids.forEach(id => s.delete(id)); return s })(),
        }))
      },

      bulkReject: async (reason) => {
        const { selectedUploadIds, uploads } = get()
        const ids = [...selectedUploadIds]
        set((state) => ({ savingIds: new Set([...state.savingIds, ...ids]) }))
        await bulkRejectGuestUploads(ids, reason)
        set((state) => ({
          uploads: state.uploads.map(u => ids.includes(u.id) ? { ...u, status: 'rejected' as const, rejection_reason: reason ?? null } : u),
          selectedUploadIds: new Set(),
          savingIds: (() => { const s = new Set(state.savingIds); ids.forEach(id => s.delete(id)); return s })(),
        }))
      },
    }),
    { name: 'moderation-store' }
  )
)
```

**Zustand devtools pattern** (line 2):
```typescript
import { devtools } from 'zustand/middleware'
```

---

### `src/components/admin/GuestUploadModerationList.tsx` (component, CRUD)

**Analog:** `src/components/admin/BatchList.tsx` (lines 1-172)

**Imports pattern** (lines 1-10):
```typescript
import { useEffect, useMemo } from 'react'
import React from 'react'
import { Inbox, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { ComponentErrorBoundary } from '@/components/error/ErrorBoundary'
import { useToast } from '@/context/ToastContext'
import { type GuestUpload } from '@/lib/supabase'
import { useModerationStore } from '@/stores/moderationStore'
```

**Empty state pattern** (lines 71-83):
```typescript
function EmptyState({ icon: Icon, title, description }: {
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center text-charcoal-500">
      <Icon className="h-12 w-12 opacity-30" />
      <p className="font-medium text-charcoal-700">{title}</p>
      <p className="text-sm">{description}</p>
    </div>
  )
}
```

**Loading state pattern** (lines 69-75 in BatchList):
```typescript
if (loading) {
  return (
    <div className="rounded-xl border border-gold-100 bg-white p-8">
      <ListSkeleton count={5} />
    </div>
  )
}
```

**Main component pattern** (lines 19-172 in BatchList):
```typescript
export function GuestUploadModerationList() {
  const { addToast } = useToast()
  const {
    uploads,
    selectedUploadIds,
    loading,
    savingIds,
    loadUploads,
    selectUpload,
    deselectUpload,
    approveUpload,
    rejectUpload,
  } = useModerationStore()

  // Load uploads on mount
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadUploads()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadUploads])

  const pendingUploads = useMemo(() =>
    uploads.filter(u => u.status === 'pending'),
    [uploads]
  )

  const selectedCount = selectedUploadIds.size

  if (loading) {
    return (
      <div className="rounded-xl border border-gold-100 bg-white p-8">
        <ListSkeleton count={5} />
      </div>
    )
  }

  return (
    <ComponentErrorBoundary componentName="Guest Upload Moderation List">
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-charcoal-600">
              {pendingUploads.length} pending
            </span>
          </div>
          {selectedCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-charcoal-600">
                {selectedCount} selected
              </span>
            </div>
          )}
        </div>

        {/* Upload list */}
        {pendingUploads.length > 0 ? (
          <div className="space-y-3">
            {pendingUploads.map((upload) => (
              <UploadCard
                key={upload.id}
                upload={upload}
                isSelected={selectedUploadIds.has(upload.id)}
                isSaving={savingIds.has(upload.id)}
                onSelect={() => selectedUploadIds.has(upload.id) ? deselectUpload(upload.id) : selectUpload(upload.id)}
                onApprove={() => void approveUpload(upload.id)}
                onReject={(reason) => void rejectUpload(upload.id, reason)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gold-200 bg-white">
            <EmptyState
              icon={Inbox}
              title="No uploads pending review"
              description="New guest uploads will appear here for moderation."
            />
          </div>
        )}
      </div>
    </ComponentErrorBoundary>
  )
}
```

---

### `src/components/admin/UploadCard.tsx` (component, request-response)

**Analog:** `src/components/admin/MediaReviewPanel.tsx` (lines 71-83)

**Card with inline actions pattern** (from BatchList and MediaReviewPanel):

**Approve button** (gold, from UI-SPEC D-01):
```typescript
<Button
  size="sm"
  onClick={() => onApprove()}
  disabled={isSaving}
  variant="primary"
  className="bg-gold-500 hover:bg-gold-600"
>
  <CheckCircle2 className="mr-1.5 h-4 w-4" />
  Approve
</Button>
```

**Reject button** (rose, from UI-SPEC D-01):
```typescript
<Button
  size="sm"
  onClick={() => onReject()}
  disabled={isSaving}
  variant="danger"
  className="bg-rose-500 hover:bg-rose-600"
>
  <XCircle className="mr-1.5 h-4 w-4" />
  Reject
</Button>
```

**Upload card component structure:**
```typescript
interface UploadCardProps {
  upload: GuestUpload
  isSelected: boolean
  isSaving: boolean
  onSelect: () => void
  onApprove: () => void
  onReject: (reason?: string) => void
}

export function UploadCard({ upload, isSelected, isSaving, onSelect, onApprove, onReject }: UploadCardProps) {
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const handleReject = () => {
    if (rejectReason.trim()) {
      onReject(rejectReason.trim())
      setShowRejectDialog(false)
      setRejectReason('')
    }
  }

  return (
    <div className={cn(
      'rounded-xl border bg-white p-4 transition-all',
      isSelected ? 'border-gold-400 ring-2 ring-gold-400/20' : 'border-gold-100'
    )}>
      {/* Selection checkbox */}
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelect}
          className="mt-1 h-4 w-4 rounded border-gold-300 text-gold-500 focus:ring-gold-400"
        />

        {/* Upload content */}
        <div className="flex-1 min-w-0">
          {/* Photos preview */}
          {upload.photo_urls.length > 0 && (
            <div className="flex gap-2 mb-3 overflow-x-auto">
              {upload.photo_urls.slice(0, 4).map((url, idx) => (
                <img
                  key={idx}
                  src={url}
                  alt={`Upload ${idx + 1}`}
                  className="h-16 w-16 rounded-lg object-cover flex-shrink-0"
                />
              ))}
              {upload.photo_urls.length > 4 && (
                <div className="h-16 w-16 rounded-lg bg-gold-100 flex items-center justify-center text-sm text-gold-700">
                  +{upload.photo_urls.length - 4}
                </div>
              )}
            </div>
          )}

          {/* Guest info */}
          <p className="font-medium text-charcoal-900">{upload.guest_name}</p>
          <p className="text-sm text-charcoal-500">{upload.guest_email}</p>
          {upload.message && (
            <p className="mt-2 text-sm text-charcoal-600">{upload.message}</p>
          )}
          <p className="mt-2 text-xs text-charcoal-400">
            Uploaded {new Date(upload.created_at).toLocaleDateString()}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2">
          <Button
            size="sm"
            onClick={onApprove}
            disabled={isSaving}
            variant="primary"
            className="bg-gold-500 hover:bg-gold-600"
          >
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            Approve
          </Button>
          <Button
            size="sm"
            onClick={() => setShowRejectDialog(true)}
            disabled={isSaving}
            variant="danger"
            className="bg-rose-500 hover:bg-rose-600"
          >
            <XCircle className="mr-1.5 h-4 w-4" />
            Reject
          </Button>
        </div>
      </div>

      {/* Reject dialog */}
      {showRejectDialog && (
        <ModerationConfirmDialog
          isOpen={showRejectDialog}
          onClose={() => setShowRejectDialog(false)}
          onConfirm={handleReject}
          title="Reject Upload"
          confirmLabel="Reject"
          confirmVariant="danger"
        >
          <div className="space-y-4">
            <p className="text-sm text-charcoal-600">
              Optionally provide a reason for the rejection. This will be visible to the guest.
            </p>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (optional)"
              rows={3}
            />
          </div>
        </ModerationConfirmDialog>
      )}
    </div>
  )
}
```

---

### `src/components/admin/BulkActionToolbar.tsx` (component, request-response)

**Analog:** `src/components/admin/BatchList.tsx:81-135` (toolbar section)

**Floating toolbar pattern** (lines 81-135):
```typescript
<div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
  <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] xl:min-w-0 xl:flex-1">
    {/* Batch selector and stats */}
    <div>
      {/* Stats grid */}
      <div className="grid gap-3 rounded-[1rem] border border-gold-100 bg-cream-50/70 px-4 py-3 text-sm text-charcoal-600 sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-charcoal-400">Status</p>
          <p className="mt-1 font-medium text-charcoal-900">{selectedBatch.status.replace('_', ' ')}</p>
        </div>
        {/* More stats... */}
      </div>
    </div>
  </div>

  <div className="flex flex-wrap items-center gap-2 xl:justify-end">
    <div className="rounded-full border border-gold-200 bg-white px-4 py-2 text-sm text-charcoal-600">
      {changedFaceIds.length} unsaved face change{changedFaceIds.length === 1 ? '' : 's'}
    </div>
  </div>
</div>
```

**Bulk toolbar component:**
```typescript
interface BulkActionToolbarProps {
  selectedCount: number
  onApproveAll: () => void
  onRejectAll: () => void
  onDeselectAll: () => void
  isLoading?: boolean
}

export function BulkActionToolbar({ selectedCount, onApproveAll, onRejectAll, onDeselectAll, isLoading }: BulkActionToolbarProps) {
  if (selectedCount === 0) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between rounded-2xl border border-gold-300/60 bg-gradient-to-r from-cream-100/95 via-gold-50/95 to-cream-100/95 px-4 py-3 shadow-lg backdrop-blur-md"
    >
      <span className="text-sm font-medium text-charcoal-700">
        {selectedCount} upload{selectedCount !== 1 ? 's' : ''} selected
      </span>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={onDeselectAll}
          disabled={isLoading}
        >
          Deselect all
        </Button>
        <Button
          size="sm"
          onClick={onApproveAll}
          disabled={isLoading}
          className="bg-gold-500 hover:bg-gold-600"
        >
          <CheckCircle2 className="mr-1.5 h-4 w-4" />
          Approve all
        </Button>
        <Button
          size="sm"
          onClick={onRejectAll}
          disabled={isLoading}
          variant="danger"
          className="bg-rose-500 hover:bg-rose-600"
        >
          <XCircle className="mr-1.5 h-4 w-4" />
          Reject all
        </Button>
      </div>
    </motion.div>
  )
}
```

---

### `src/components/admin/ModerationConfirmDialog.tsx` (component, event-driven)

**Analog:** `src/components/admin/ClusterMergeModal.tsx` (lines 1-24, 1-60)

**Modal structure pattern:**
```typescript
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface ModerationConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  confirmLabel?: string
  confirmVariant?: 'primary' | 'danger'
  children: React.ReactNode
}

export function ModerationConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  confirmLabel = 'Confirm',
  confirmVariant = 'primary',
  children,
}: ModerationConfirmDialogProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2"
          >
            <div className="rounded-2xl border border-gold-200 bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-xl text-charcoal-900">{title}</h2>
                <button
                  onClick={onClose}
                  className="rounded-full p-1 text-charcoal-400 hover:text-charcoal-600 hover:bg-charcoal-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-6">
                {children}
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  variant={confirmVariant === 'danger' ? 'danger' : 'primary'}
                  onClick={onConfirm}
                >
                  {confirmLabel}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
```

---

### `src/pages/Gallery.tsx` (extend for rejection reason display)

**Analog:** `src/pages/Gallery.tsx:503-1036` (existing page structure)

**Upload status section pattern** (existing Phase 6 implementation):
- Uses email-based lookup for upload status
- Need to extend to show rejection_reason field

**Extension pattern:**
```typescript
// In Gallery.tsx, find the upload status section (from Phase 6)
// and add rejection reason display:

// Find where upload status is displayed and add:
{upload?.status === 'rejected' && upload.rejection_reason && (
  <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50/80 p-4">
    <p className="font-medium text-rose-700">Rejection reason:</p>
    <p className="mt-1 text-rose-600">{upload.rejection_reason}</p>
  </div>
)}
```

**Fetch upload status by email** (new function in supabase.ts):
```typescript
export async function fetchGuestUploadStatus(email: string) {
  const { data, error } = await supabase
    .from('guest_uploads')
    .select('id, status, rejection_reason, created_at, photo_urls, guest_name')
    .eq('guest_email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error) return null
  return data
}
```

---

### `src/components/admin/MediaReviewPanel.tsx` (add guest upload tab)

**Analog:** `src/components/admin/MediaReviewPanel.tsx:85-325` (existing panel)

**Tabbed structure pattern** (existing):
```typescript
// In MediaReviewPanel.tsx, add a new tab alongside face review:
// Current structure has Face Review as the main content
// Add a "Guest Uploads" tab that shows GuestUploadModerationList

// Use existing tab pattern from admin components
// Or use inline section with section header:

<div className="space-y-4">
  {/* Guest Upload Moderation section */}
  <section className="rounded-[1.4rem] border border-gold-100 bg-white p-4 shadow-sm">
    <div className="mb-4 flex items-center justify-between">
      <h2 className="font-display text-lg text-charcoal-900">Guest Upload Moderation</h2>
    </div>
    <GuestUploadModerationList />
  </section>
</div>
```

---

## Shared Patterns

### Authentication

**Source:** `src/components/admin/MediaReviewPanel.tsx` (line 86)
**Apply to:** All moderation components that call supabase
```typescript
const { addToast } = useToast()
// Uses toast context for feedback on auth errors
```

### Error Handling

**Source:** `src/lib/supabase.ts:400-417` (recordModerationAudit)
**Apply to:** All supabase functions
```typescript
// Pattern: throw on error, return data or empty array
if (error) throw error
return data ?? []
```

### Loading States

**Source:** `src/components/admin/BatchList.tsx:69-75`
**Apply to:** All list components
```typescript
if (loading) {
  return (
    <div className="rounded-xl border border-gold-100 bg-white p-8">
      <ListSkeleton count={5} />
    </div>
  )
}
```

### Framer Motion Animations

**Source:** `src/pages/Gallery.tsx:1236-1269` (selection action bar)
**Apply to:** Bulk action toolbar
```typescript
<motion.div
  initial={{ opacity: 0, y: -8 }}
  animate={{ opacity: 1, y: 0 }}
  className="..."
>
```

### Button Variants

**Source:** `src/components/ui/Button.tsx:46-50`
**Apply to:** Reject button (danger), Approve button (primary)
```typescript
// Primary gold button
variant: 'primary'
// Danger/rose button
variant: 'danger'
```

---

## No Analog Found

All files have good analogs within the existing codebase. The key patterns are:

| Pattern | Source File | Lines |
|---------|-------------|-------|
| Checkbox + selection | BatchList.tsx | 19-172 |
| Toolbar with stats | BatchList.tsx | 81-135 |
| Zustand store with devtools | mediaReviewStore.ts | 325-706 |
| Confirmation dialog | ClusterMergeModal.tsx | 1-60 |
| Card with actions | UI-SPEC D-01 |
| Supabase CRUD functions | supabase.ts | 870-912 |
| Moderation audit logging | supabase.ts | 400-417 |

---

## Metadata

**Analog search scope:** src/components/admin/, src/lib/, src/stores/, src/pages/, supabase/migrations/
**Files scanned:** 15
**Pattern extraction date:** 2026-04-27