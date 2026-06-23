# Phase 8: Moderation Queue & Featured Spotlight - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-27
**Phase:** 08-moderation-queue-featured-spotlight
**Areas discussed:** Moderation workflow, Feature selection UX, Homepage spotlight, Reject reason visibility, Batch operations

---

## Moderation Workflow

| Option | Description | Selected |
|--------|-------------|----------|
| Quick inline buttons | Approve/reject directly in queue list | ✓ |
| Dedicated review modal | Click photo to open detail modal | |

**User's choice:** Quick inline buttons (approve/reject) in queue list

---

## Feature Selection UX

| Option | Description | Selected |
|--------|-------------|----------|
| Feature button on approved photos | Admin can mark approved photos as "featured" | |
| Remove featured photo section | No feature system at all | ✓ |

**User's choice:** Remove the featured photo section entirely

---

## Homepage Spotlight

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-spotlight | First 3 approved guest uploads appear automatically | |
| Manual spotlight | Admin picks which content appears | |
| No spotlight | No editorial spotlight on homepage | ✓ |

**User's choice:** No spotlight (GAL-03 out of scope)

---

## Reject Reason Visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, visible to guest | Guest can see rejection reason when checking upload status | ✓ |
| No, internal only | Reason saved to audit log but not shown to guest | |

**User's choice:** Yes, visible to guest

---

## Batch Operations

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, bulk approve/reject | Multi-select with checkbox, bulk actions | ✓ |
| No, one at a time only | Each upload moderated individually | |

**User's choice:** Yes, bulk operations supported

---

## Deferred Ideas

- MOD-03 / GAL-03 (Feature/Spotlight System) — Removed from scope. Admin can approve/reject but not feature content. Can be revisited as a future phase if desired.
