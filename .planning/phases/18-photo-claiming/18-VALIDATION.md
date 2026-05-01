---
phase: 18
slug: photo-claiming
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-30
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (already in project) |
| **Config file** | `vite.config.ts` with test config |
| **Quick run command** | `npm run test -- src/stores/claimStore.test.ts` |
| **Full suite command** | `npm run test:run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- src/stores/ --passwithno-tests`
- **After every plan wave:** Run `npm run test:run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 1 | SC-01 | T-18-01 | Email enumeration protected (same message for existing/non-existing) | unit | `npm run test -- src/lib/claimUtils.test.ts` | ❌ W0 | ⬜ pending |
| 18-01-02 | 01 | 1 | SC-01 | T-18-02 | Code brute force protected (3 attempts, 10-min expiry) | unit | `npm run test -- src/lib/claimUtils.test.ts` | ❌ W0 | ⬜ pending |
| 18-01-03 | 01 | 1 | SC-01 | — | Gallery filter correctly applies attributedEmail | unit | `npm run test -- src/stores/galleryStore.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/stores/claimStore.test.ts` — unit tests for claim flow state management
- [ ] `src/lib/claimUtils.test.ts` — unit tests for email lookup, code generation/validation, claim orchestration
- [ ] `src/stores/galleryStore.test.ts` — unit tests for attributedEmail filter

*Existing infrastructure: Vitest already in project, no framework installation needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Magic link email delivery | SC-01 | Requires actual email sending via Supabase | Open Guest Uploads, click "Claim My Photos", enter email, verify email received |
| "No photos found" message | SC-01/D-04 | UI text verification | Enter email with no uploads, verify same message as found case |
| Gold button styling | D-06 | Visual design verification | Inspect ClaimButton component for gold accent color usage |

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