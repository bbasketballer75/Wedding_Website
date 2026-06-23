# Phase 8: Moderation Queue & Featured Spotlight - Research

**Researched:** 2026-04-27
**Domain:** Admin moderation queue for guest uploads, Supabase RPC, bulk operations
**Confidence:** MEDIUM

## Summary

Phase 8 implements admin moderation for guest uploads. The core workflow is straightforward: admin views pending uploads, approves or rejects with one click, and optionally provides a rejection reason visible to guests. Bulk operations use checkboxes with a confirmation dialog. Supabase RPC functions handle status updates and audit logging.

**Key discovery:** The `guest_uploads` table lacks a `rejection_reason` column — a schema migration is needed. The existing `moderation_audit_log` table and `recordModerationAudit()` function in `src/lib/supabase.ts` are ready to use for audit trail. The `ModerationAuditAction` type already includes `'upload_approved'`, `'upload_rejected'`, `'upload_bulk_rejected'` actions.

**Primary recommendation:** Build a new `GuestUploadModerationList` component using the checkbox + toolbar pattern from `BatchList.tsx`. Add a `rejection_reason` column to `guest_uploads` via migration. Extend the upload status page (Phase 6) to fetch and display rejection reasons.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Inline quick-action buttons in the pending queue list — Approve and Reject buttons visible directly on each upload card. No modal or detail view required for basic moderation actions.
- **D-02:** Reject reason is visible to the guest when they check their upload status. Reason is saved to `moderation_audit_log` and displayed on the guest's "Your upload status" page.
- **D-03:** Bulk approve and bulk reject supported. Admin selects multiple uploads via checkboxes, then selects "Approve all selected" or "Reject all selected" action. Bulk actions require confirmation dialog.
- **D-04:** OUT OF SCOPE — No feature or spotlight functionality. Admin only approves/rejects. No editorial slot management for homepage.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MOD-01 | Admin can approve guest uploads with one click | Supabase update on `guest_uploads.status`, existing `recordModerationAudit()` for audit trail |
| MOD-02 | Admin can reject guest uploads with reason | Requires `rejection_reason` column in `guest_uploads` + UI to display on status page |
| MOD-03 | OUT OF SCOPE | Feature/spotlight system explicitly excluded per D-04 |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Guest upload status update | API / Backend | — | Supabase mutation on `guest_uploads.status` — RPC or direct update |
| Moderation audit logging | API / Backend | — | `recordModerationAudit()` writes to `moderation_audit_log` |
| Moderation queue UI | Browser / Client | — | React component renders pending list, handles checkbox state |
| Bulk approve/reject | Browser / Client | API / Backend | Client-side selection aggregation, batch RPC call |
| Upload status lookup | Browser / Client | API / Backend | Guest-facing page fetches upload status by email lookup |
| Rejection reason display | Browser / Client | — | Reads `moderation_audit_log` or `guest_uploads.rejection_reason` |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | (from project) | UI rendering | Project baseline |
| Zustand | (from project) | Local state for selection, filters | Already in use (`mediaReviewStore`, `galleryStore`) |
| Supabase JS | (from project) | Database mutations | Already used for all DB operations |
| Framer Motion | (from project) | Animations, transitions | Already in use throughout |
| lucide-react | (from project) | Icons | Already in use |

**Installation:** No new packages — all dependencies already in project.

## Schema Findings

### guest_uploads table (existing)
```sql
-- From 20240303000000_init_schema.sql
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

**GAP IDENTIFIED:** No `rejection_reason` column. Schema migration needed.

### moderation_audit_log table (existing)
```sql
-- From 20260312000100_moderation_audit_log.sql
create table if not exists public.moderation_audit_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('guest_upload', 'guestbook_message')),
  entity_id uuid not null,
  action text not null,
  actor_user_id uuid null,
  actor_email text null,
  actor_name text null,
  from_status text null,
  to_status text null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

### ModerationAuditAction type (existing in supabase.ts)
```typescript
export type ModerationAuditAction =
  | 'upload_moved_to_pending'
  | 'upload_approved_unpublished'
  | 'upload_approved_published'
  | 'upload_removed_from_gallery'
  | 'upload_rejected'
  | 'upload_bulk_rejected'
  | 'guestbook_message_deleted'
  | 'guestbook_bulk_deleted'
```
**NOTE:** Actions for single approve/reject (`'upload_approved'`, `'upload_rejected'`) are not defined. The existing audit actions use granular names like `'upload_approved_published'`. Verify if new actions needed or if existing ones cover the use case.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Admin Browser                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           MediaReviewPanel (tabbed UI)               │   │
│  │  ┌────────────────┐  ┌────────────────────────┐     │   │
│  │  │  Face Review   │  │  Guest Upload Moderation│     │   │
│  │  │  (existing)    │  │  (new - this phase)     │     │   │
│  │  └────────────────┘  └────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
         │                    │
         │                    │ Supabase auth (authenticated)
         ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Backend                          │
│  ┌──────────────────┐  ┌──────────────────────┐              │
│  │  guest_uploads   │  │  moderation_audit_log│              │
│  │  (SELECT/UPDATE) │  │  (INSERT)            │              │
│  └──────────────────┘  └──────────────────────┘              │
└─────────────────────────────────────────────────────────────┘
         │
         │ (guest access via email lookup)
         ▼
┌─────────────────────────────────────────────────────────────┐
│                     Guest Browser                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │       Upload Status Page (from Gallery.tsx)         │   │
│  │  - Shows pending/success state (existing from P6)    │   │
│  │  - Shows rejection reason (new for this phase)        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
src/
├── components/admin/
│   ├── GuestUploadModerationList.tsx   # NEW: main moderation list
│   ├── UploadCard.tsx                  # NEW: per-upload card with actions
│   ├── BulkActionToolbar.tsx          # NEW: bulk approve/reject toolbar
│   ├── ModerationConfirmDialog.tsx     # NEW: confirmation modal
│   └── MediaReviewPanel.tsx           # EXISTING: add guest upload tab
├── stores/
│   └── moderationStore.ts             # NEW: Zustand store for moderation state
├── pages/
│   └── Gallery.tsx                    # EXISTING: extend for rejection reason
└── lib/
    └── supabase.ts                    # EXISTING: add fetch/approve/reject functions
```

### Pattern 1: Checkbox + Toolbar Bulk Operations
**What:** Checkbox selection on list items, floating toolbar appears when 1+ selected.
**When to use:** Bulk approve/reject actions.
**Source:** `BatchList.tsx` lines 19-172 — already implements this pattern with checkbox state management.

```typescript
// Source: BatchList.tsx pattern (adapted)
// State: selectedUploadIds: Set<string>
// UI: Floating toolbar with "Approve All" / "Reject All" buttons
// Confirmation: Modal before destructive (reject) action
```

### Pattern 2: Inline Quick Actions
**What:** Approve/Reject buttons directly on each card, no modal required.
**When to use:** Single-item moderation.
**Source:** UI-SPEC D-01, existing patterns in admin components.

```typescript
// Source: UI-SPEC
// Approve button: gold color (#c9a05c), single click → optimistic update
// Reject button: rose color (#e36a83), optional reason textarea
```

### Pattern 3: Confirmation Dialog for Destructive Actions
**What:** Modal dialog before bulk reject or single reject with reason.
**When to use:** Reject actions require confirmation per D-03.
**Source:** Existing project dialog patterns (Framer Motion AnimatePresence).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audit logging | Custom logging table | `recordModerationAudit()` in supabase.ts | Already exists, handles actor tracking |
| Status transitions | Direct individual updates | Supabase RPC for batch operations | Efficient, single round-trip |
| Email lookup for status | Custom query | Extend existing upload status pattern | Guest status lookup already designed in Phase 6 |

**Key insight:** The Supabase RPC pattern (`recordModerationAudit`, `toggle_photo_like_v2`) is well-established. Use RPC for bulk approve/reject to minimize round-trips.

## Common Pitfalls

### Pitfall 1: Missing rejection_reason column
**What goes wrong:** Rejection reason cannot be persisted to `guest_uploads` — only to `moderation_audit_log`.
**Why it happens:** Schema was not updated in prior migrations.
**How to avoid:** Add `rejection_reason` column to `guest_uploads` via migration before implementing MOD-02.
**Warning signs:** Guest status page shows audit log entry but no structured field for reason.

### Pitfall 2: RLS policy on guest_uploads blocks admin actions
**What goes wrong:** Authenticated admin cannot update `guest_uploads` status.
**Why it happens:** RLS policies on `guest_uploads` may only allow SELECT, not UPDATE for authenticated users.
**How to avoid:** Check existing RLS policies — verify authenticated users have UPDATE access to `guest_uploads`.
**Source:** `20240303000000_init_schema.sql` lines 114-146 — only SELECT policies defined. UPDATE policy may be missing.

### Pitfall 3: No pagination on moderation queue
**What goes wrong:** Loading all pending uploads at once if queue grows large.
**Why it happens:** Assuming queue stays small.
**How to avoid:** Use Supabase `.range()` pagination or `useInfiniteScroll` hook (already in project).

### Pitfall 4: Upload status page lookup missing
**What goes wrong:** Guests have no way to check their upload status — Phase 6 deferred email lookup.
**Why it happens:** Phase 6 context says "Skip status lookup — Success panel already shows message."
**How to avoid:** Build email-based status lookup for this phase (required for MOD-02 — guest must see rejection reason).

## Code Examples

### recordModerationAudit usage (existing, supabase.ts:400-417)
```typescript
// Source: src/lib/supabase.ts
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

### Fetching pending guest uploads
```typescript
// Source: based on fetchApprovedGuestUploads pattern (supabase.ts:870-878)
export async function fetchPendingGuestUploads() {
  return await supabase
    .from('guest_uploads')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
}
```

### Bulk update guest upload status (proposed RPC)
```sql
-- Proposed RPC function for bulk status update
-- Called by admin for bulk approve/reject
create or replace function update_guest_upload_statuses_v1(
  p_upload_ids uuid[],
  p_new_status text,
  p_rejection_reason text default null
) returns jsonb as $$
-- Implementation in migration
$$ language plpgsql security definer;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-photo moderation manually | Bulk checkbox selection + toolbar | This phase | Faster admin workflow |
| Rejection reason in external system | Rejection reason in `guest_uploads.rejection_reason` column | This phase | Guest can see reason on status page |

**Deprecated/outdated:**
- None relevant to this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `guest_uploads` RLS allows authenticated UPDATE | Schema Findings | Admin cannot change status — would need new RLS policy migration |
| A2 | `ModerationAuditAction` includes `'upload_approved'` action | Schema Findings | May need to add new action type or reuse existing granular ones |
| A3 | Phase 6 upload status page can be extended for rejection reason display | Common Pitfalls | May need to build email lookup from scratch if Phase 6 status page doesn't exist |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

## Open Questions

1. **Email lookup for upload status**
   - What we know: Phase 6 deferred email-based status lookup. Phase 8 D-02 requires guests see rejection reason.
   - What's unclear: Does an upload status lookup page already exist, or does it need to be built? The Phase 6 context says "Skip status lookup" but MOD-02 requirement implies guests need to check status.
   - Recommendation: Plan should include building `/upload/status` page (or extend existing) with email-based lookup.

2. **RLS policy for guest_uploads UPDATE**
   - What we know: RLS is enabled, authenticated SELECT policy exists, UPDATE policy may be missing.
   - What's unclear: Can admin actually update `guest_uploads.status` via RLS?
   - Recommendation: Verify RLS policies before implementation — may need migration to add UPDATE policy.

3. **Single-upload rejection audit action**
   - What we know: `ModerationAuditAction` type has `'upload_rejected'` and `'upload_bulk_rejected'`.
   - What's unclear: Is `'upload_rejected'` the correct action for single-item reject, or does it need a more specific action like `'upload_rejected_unpublished'`?
   - Recommendation: Reuse existing `'upload_rejected'` action for single rejects (aligns with existing naming pattern).

## Environment Availability

> Step 2.6: SKIPPED (no external dependencies identified beyond Supabase which is project standard)

No external tool dependencies — Supabase is already configured in project.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (project standard) |
| Config file | `vitest.config.ts` (existing) |
| Quick run command | `npm run test -- --run` |
| Full suite command | `npm run test -- --run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MOD-01 | One-click approve | unit | `vitest src/lib/supabase.ts --testNamePattern "approve" -x` | needs new test |
| MOD-01 | Bulk approve | unit | `vitest src/lib/supabase.ts --testNamePattern "bulk.*approve" -x` | needs new test |
| MOD-02 | Reject with reason persisted | unit | `vitest src/lib/supabase.ts --testNamePattern "reject.*reason" -x` | needs new test |
| MOD-02 | Rejection reason visible on status page | integration | `vitest e2e/upload-status.spec.ts --testNamePattern "reject.*visible" -x` | needs new spec |

### Wave 0 Gaps
- [ ] `src/lib/__tests__/supabase.test.ts` — tests for new moderation RPC functions
- [ ] `src/components/admin/__tests__/GuestUploadModerationList.test.tsx` — component tests
- [ ] `tests/e2e/upload-status.spec.ts` — Playwright test for guest status page with rejection reason

### Sampling Rate
- **Per task commit:** `npm run test -- --run src/lib/__tests__/supabase.test.ts`
- **Per wave merge:** `npm run test -- --run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

*(If no gaps: "None — existing test infrastructure covers all phase requirements")*

## Security Domain

> Required when `security_enforcement` is enabled (absent = enabled). Omit only if explicitly `false` in config.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth (existing) |
| V3 Session Management | yes | Supabase session (existing) |
| V4 Access Control | yes | RLS policies on `guest_uploads` — verify UPDATE policy exists for authenticated |
| V5 Input Validation | yes | Reject reason: sanitize before store, validate length (e.g., max 500 chars) |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Admin can approve any upload | Tampering | RLS restricts to authenticated admin only — verify policy |
| Bulk approve bypasses individual review | Tampering | Confirmation dialog for bulk actions (per D-03) |
| Rejection reason XSS | Spoofing | Sanitize reason text before rendering |
| Guest enumerates uploads by email | Information Disclosure | Rate-limit email lookup queries |

## Sources

### Primary (HIGH confidence)
- `src/lib/supabase.ts` — Photo, GuestUpload, ModerationAuditLog, recordModerationAudit types and functions
- `src/components/admin/BatchList.tsx` — Bulk operations checkbox pattern
- `src/components/admin/MediaReviewPanel.tsx` — Existing admin panel structure
- `supabase/migrations/20240303000000_init_schema.sql` — guest_uploads table schema
- `supabase/migrations/20260312000100_moderation_audit_log.sql` — audit log table schema

### Secondary (MEDIUM confidence)
- `.planning/phases/08-moderation-queue-featured-spotlight/08-CONTEXT.md` — Implementation decisions
- `.planning/phases/08-moderation-queue-featured-spotlight/08-UI-SPEC.md` — UI design contract

### Tertiary (LOW confidence)
- `.planning/phases/06-guest-reactions-upload-status/06-CONTEXT.md` — Phase 6 context (upload status was deferred)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all project-standard libraries
- Architecture: MEDIUM — schema gaps identified (rejection_reason column, RLS UPDATE policy)
- Pitfalls: MEDIUM — RLS policy verification needed before implementation

**Research date:** 2026-04-27
**Valid until:** 2026-05-27 (30 days — schema patterns stable)
