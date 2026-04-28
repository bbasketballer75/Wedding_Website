# Phase 8: Moderation Queue & Featured Spotlight - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin can approve or reject guest uploads with one click from a moderation queue. Rejected uploads optionally include a reason visible to the guest. Bulk approve/reject supported. No spotlight/feature system — MOD-03 and GAL-03 (homepage editorial spotlight) are out of scope for this phase.

</domain>

<decisions>
## Implementation Decisions

### Moderation workflow (MOD-01, MOD-02)
- **D-01:** Inline quick-action buttons in the pending queue list — Approve and Reject buttons visible directly on each upload card. No modal or detail view required for basic moderation actions.

### Reject reason visibility (MOD-02)
- **D-02:** Reject reason is visible to the guest when they check their upload status. Reason is saved to `moderation_audit_log` and displayed on the guest's "Your upload status" page.

### Batch operations
- **D-03:** Bulk approve and bulk reject supported. Admin selects multiple uploads via checkboxes, then selects "Approve all selected" or "Reject all selected" action. Bulk actions require confirmation dialog.

### Feature/spotlight system (MOD-03, GAL-03)
- **D-04:** OUT OF SCOPE — No feature or spotlight functionality. Admin only approves/rejects. No editorial slot management for homepage.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project
- `.planning/PROJECT.md` — Wedding website goals, tech stack
- `.planning/REQUIREMENTS.md` — MOD-01, MOD-02 requirements
- `.planning/ROADMAP.md` — Phase 8 description and success criteria

### Prior Phase Context
- `.planning/phases/01-foundation-polish/01-CONTEXT.md` — Phase 1 decisions
- `.planning/phases/02-gallery-performance/02-CONTEXT.md` — Phase 2 decisions
- `.planning/phases/03-upload-experience/03-CONTEXT.md` — Phase 3 decisions
- `.planning/phases/04-navigation-design/04-CONTEXT.md` — Phase 4 decisions
- `.planning/phases/05-social-sharing/05-CONTEXT.md` — Phase 5 decisions
- `.planning/phases/06-guest-reactions-upload-status/06-CONTEXT.md` — Phase 6 decisions
- `.planning/phases/07-gallery-virtualization/07-CONTEXT.md` — Phase 7 decisions

### Schema (already in place)
- `src/lib/supabase.ts` — Photo type with `status: 'pending' | 'approved' | 'rejected'`, `ModerationAuditLog`, `ModerationAuditAction` types

### Existing Code
- `src/components/admin/MediaReviewPanel.tsx` — Existing admin panel (face/batch review), will need pending-guest-uploads section added
- `src/components/admin/BatchList.tsx` — List component that could be repurposed for moderation queue
- `src/pages/Gallery.tsx` — Upload status lookup page (Phase 6), needs to show reject reason

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- MediaReviewPanel.tsx: Existing admin panel structure — can extend with guest-upload moderation tab/section
- BatchList.tsx: Reusable list component with checkbox selection — good pattern for bulk operations
- Zustand stores: auth, gallery, ui — can add moderation state if needed

### Established Patterns
- Zustand for state management
- Framer Motion for animations
- Gold theme accents (#d4af37)
- Bulk operations via checkbox selection + toolbar action (pattern exists in BatchList)
- Confirmation dialog before destructive actions

### Integration Points
- Gallery.tsx → Upload status lookup (Phase 6): extend to show reject reason
- MediaReviewPanel.tsx → Add guest upload moderation tab (new section alongside face review)
- Supabase schema: photos.status, moderation_audit_log table, record_moderation_audit RPC

</code_context>

<specifics>
## Specific Ideas

No specific references from discussion — open to standard approaches for implementation.
</specifics>

<deferred>
## Deferred Ideas

### MOD-03 / GAL-03 (Feature/Spotlight System)
- Admin feature/spotlight approved content to homepage editorial slot — NOT in scope for Phase 8
- Homepage featured content spotlight — NOT in scope for Phase 8
- These can be revisited as a future phase if desired
</deferred>

---
*Phase: 08-moderation-queue-featured-spotlight*
*Context gathered: 2026-04-27*
