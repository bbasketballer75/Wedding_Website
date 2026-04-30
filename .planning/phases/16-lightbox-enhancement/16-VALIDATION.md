---
phase: 16
slug: lightbox-enhancement
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-30
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test:e2e -- --run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run`
- **After every plan wave:** Run `npm run test:e2e -- --run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | LB-01 | — | Pinch-to-zoom works 1x-3x, double-tap 1x/2x | unit | `npm run test -- --run` | ✅ | ⬜ pending |
| 16-01-02 | 01 | 1 | LB-02 | — | Zoom-aware swipe (pan when zoomed, navigate when 1x) | unit | `npm run test -- --run` | ✅ | ⬜ pending |
| 16-01-03 | 01 | 1 | LB-03 | — | EXIF info panel shows metadata with fallback | e2e | `npm run test:e2e -- --run` | ✅ | ⬜ pending |
| 16-01-04 | 01 | 1 | LB-04 | — | Download button triggers onDownload prop | unit | `npm run test -- --run` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/tests/photoLightbox.test.tsx` — PhotoLightbox component tests
- [ ] `src/tests/useTouchGestures.test.ts` — Touch gesture hook tests

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pinch-to-zoom feel | LB-01 | Touch gestures require physical device | Test on mobile device or simulator |
| Swipe navigation feel | LB-02 | Velocity and threshold tuning | Test on mobile device or simulator |

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