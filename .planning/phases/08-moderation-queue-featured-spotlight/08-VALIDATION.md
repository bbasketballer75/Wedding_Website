---
phase: 8
slug: moderation-queue-featured-spotlight
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-27
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (project standard) |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test -- --run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run src/lib/__tests__/supabase.test.ts` (supabase functions)
- **After every plan wave:** Run `npm run test -- --run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | MOD-01/MOD-02 | T-08-01 | RLS restricts UPDATE to authenticated | manual | `grep -l "rejection_reason" supabase/migrations/*.sql` | N/A | ⬜ pending |
| 08-01-02 | 01 | 1 | MOD-01/MOD-02 | T-08-01/T-08-05 | Sanitize inputs; RLS enforced | unit | `npm run test -- --run src/lib/__tests__/supabase.test.ts` | ❌ W0 | ⬜ pending |
| 08-01-03 | 01 | 1 | MOD-01/MOD-02 | T-08-01 | Store validates actor from auth | unit | `npm run test -- --run src/stores/*.test.ts` | ❌ W0 | ⬜ pending |
| 08-01-04 | 01 | 1 | MOD-01/MOD-02 | — | BLOCKING: schema push | manual | `supabase db push` | N/A | ⬜ pending |
| 08-02-01 | 02 | 2 | MOD-01/MOD-02 | T-08-03 | Dialog prevents accidental bulk reject | unit | `npm run test -- --run src/components/admin/*.test.tsx` | ❌ W0 | ⬜ pending |
| 08-02-02 | 02 | 2 | MOD-01/MOD-02 | T-08-05 | XSS sanitized by React | unit | `npm run test -- --run src/components/admin/*.test.tsx` | ❌ W0 | ⬜ pending |
| 08-02-03 | 02 | 2 | MOD-01/MOD-02 | T-08-03 | Confirmation required for bulk | unit | `npm run test -- --run src/components/admin/*.test.tsx` | ❌ W0 | ⬜ pending |
| 08-02-04 | 02 | 2 | MOD-01/MOD-02 | T-08-01/T-08-03 | State isolates selection per admin | unit | `npm run test -- --run src/components/admin/*.test.tsx` | ❌ W0 | ⬜ pending |
| 08-02-05 | 02 | 2 | MOD-01/MOD-02 | T-08-01 | Integration with existing panel | manual | `grep "GuestUploadModerationList" src/components/admin/MediaReviewPanel.tsx` | N/A | ⬜ pending |
| 08-02-06 | 02 | 2 | MOD-02 | T-08-02/T-08-06 | Email-scoped lookup; reason only on rejected | integration | `npm run test:e2e -- --grep "upload.*status"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/__tests__/supabase.test.ts` — tests for approveGuestUpload, rejectGuestUpload, bulkApproveGuestUploads, bulkRejectGuestUploads, fetchGuestUploadStatus
- [ ] `src/components/admin/__tests__/GuestUploadModerationList.test.tsx` — component tests for filter tabs, bulk toolbar, card interactions
- [ ] `tests/e2e/upload-status.spec.ts` — Playwright test for guest upload status lookup with rejection reason display

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Schema push (RLS policy + rejection_reason column) | MOD-01/MOD-02 | Requires live Supabase instance | `supabase db push` then verify with `grep "rejection_reason" supabase/migrations/*.sql` |
| MediaReviewPanel integration | MOD-01 | UI integration | Manual check: navigate to /admin, verify Guest Upload Moderation section appears |
| Upload status lookup in Gallery.tsx | MOD-02 | E2E flow | Manual: submit upload, reject with reason, lookup status by email, verify reason shown |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
