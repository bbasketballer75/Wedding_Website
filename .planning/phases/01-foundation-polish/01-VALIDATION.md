---
phase: 01
slug: foundation-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-23
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vite.config.ts (vitest configured via plugin) |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test:run` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test:run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | ADMIN-03 | T-01-01 | Auth queue serializes operations | unit | `npm run test` | N/A | ⬜ pending |
| 01-01-02 | 01 | 1 | ADMIN-04 | — | Single Supabase client | unit | `npm run test` | N/A | ⬜ pending |
| 01-02-01 | 02 | 1 | ADMIN-01, POLISH-01, POLISH-02 | T-01-02 | Error boundaries show graceful UI | unit | `npm run test` | N/A | ⬜ pending |
| 01-03-01 | 03 | 2 | POLISH-03 | — | Lightbox keyboard nav | e2e | `npm run test:e2e` | N/A | ⬜ pending |
| 01-03-02 | 03 | 2 | POLISH-04 | — | Hamburger menu works | e2e | `npm run test:e2e` | N/A | ⬜ pending |
| 01-03-03 | 03 | 2 | POLISH-05 | — | Console stripped in build | build | `grep -r "console\." dist/` | dist/ | ⬜ pending |
| 01-03-04 | 03 | 2 | POLISH-06 | — | Page transitions consistent | e2e | `npm run test:e2e` | N/A | ⬜ pending |
| 01-04-01 | 04 | 3 | ADMIN-02 | T-01-03 | MediaReviewPanel decomposed | unit | `npm run test` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/authStore.test.ts` — auth queue serialization tests
- [ ] `tests/unit/errorBoundary.test.ts` — error boundary rendering tests
- [ ] `tests/unit/mediaReviewStore.test.ts` — MediaReviewPanel store tests

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual error boundary rendering | ADMIN-01, POLISH-02 | Requires browser visual verification | Load admin page, throw error, verify graceful UI |
| Lightbox keyboard navigation | POLISH-03 | Keyboard interaction test | Open lightbox, press arrow keys, verify navigation |
| Console.* stripped | POLISH-05 | Build artifact check | Run `npm run build`, grep dist/ for console.* |
| Page transition animation | POLISH-06 | Visual/animation check | Navigate between pages, verify smooth transitions |
| Hamburger menu animation | POLISH-04 | Mobile viewport + animation | Resize to mobile, open hamburger, verify smooth |
| MediaReviewPanel decomposition | ADMIN-02 | Visual + functional admin test | Load MediaReviewPanel, verify all 5 sub-components render |

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
