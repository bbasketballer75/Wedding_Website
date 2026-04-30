---
phase: 19
slug: shared-links-print
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-04-30
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (already in project) |
| **Config file** | `vite.config.ts` with test config |
| **Quick run command** | `npm run test -- src/lib/shareUtils.test.ts` |
| **Full suite command** | `npm run test:run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- src/lib/ --passwithno-tests`
- **After every plan wave:** Run `npm run test:run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 19-00-01 | 01 | 0 | SC-03/PR-01 | — | Wave 0 test scaffolds created | unit | `npm run test -- src/lib/shareUtils.test.ts tests/guestShared.test.ts` | ✅ | ⬜ pending |
| 19-01-01 | 01 | 1 | SC-03 | T-19-01 | Token is UUID v4 (high entropy) - brute force infeasible | unit | `npm run test -- src/lib/shareUtils.test.ts` | ✅ | ⬜ pending |
| 19-01-02 | 01 | 1 | SC-03/PR-01 | T-19-02 | UNIQUE constraint prevents token collisions | unit | `npm run test -- src/lib/shareUtils.test.ts` | ✅ | ⬜ pending |
| 19-01-03 | 01 | 1 | SC-03 | — | Share button copies correct link to clipboard | e2e | Playwright | ✅ | ⬜ pending |
| 19-01-04 | 01 | 1 | SC-03 | — | GuestShared page shows guest uploads and guestbook messages | unit | `npm run test -- src/lib/shareUtils.test.ts` | ✅ | ⬜ pending |
| 19-01-05 | 01 | 1 | PR-01 | T-19-03 | Print redirect uses public URLs only | unit | `npm run test -- src/lib/shareUtils.test.ts` | ✅ | ⬜ pending |
| 19-01-06 | 01 | 1 | SC-03/PR-01 | — | Human verification of shared album and print flows | manual | See checkpoint task | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/lib/shareUtils.test.ts` — unit tests for token generation, print URL construction, and ensureGuestShareToken
- [x] `tests/guestShared.test.ts` — unit tests for GuestShared page data fetching logic

*Existing infrastructure: Vitest already in project, no framework installation needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Shared link generation on upload | SC-03 | Requires actual upload flow | Go to /upload, submit guest upload, verify share link appears |
| GuestShared page in incognito | SC-03 | No login required verification | Open /guest/{token} in incognito, verify photos and guestbook messages shown |
| Invalid token error UI | SC-03 | UI text verification | Visit /guest/invalid-token, verify friendly error message |
| Print button opens correct URL | PR-01 | External URL verification | Click Print in lightbox, verify correct provider opens in new tab |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
