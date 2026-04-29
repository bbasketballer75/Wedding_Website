---
phase: 13
slug: accessibility-motion
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-04-28
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm run test:run` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:run` on affected test files
- **After every plan wave:** Run `npm run test` full suite
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 13-01 | 1 | UX-10 | — | N/A | unit | `npm run test:run -- --grep "CustomCursor"` | ✅ | ⬜ pending |
| 13-01-02 | 13-01 | 1 | UX-10 | — | N/A | unit | `npm run test:run` | ✅ | ⬜ pending |
| 13-02-01 | 13-02 | 1 | UX-11 | — | N/A | manual | grep `focus:ring-(--color-gold)` | N/A | ⬜ pending |
| 13-03-01 | 13-03 | 1 | UX-09 | — | N/A | manual | aria-label grep | N/A | ⬜ pending |
| 13-04-01 | 13-04 | 1 | UX-12 | — | N/A | manual | code verification | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/components/ui/UIComponents.test.tsx` — add test for reduced motion return null behavior (custom cursor tests already exist here with matchMedia mock at lines 8-20)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Focus ring uses gold CSS variable | UX-11 | Visual + grep verification required | `grep -r "focus:ring-" src/components` and verify `(--color-gold)` pattern |
| Aria-labels on interactive elements | UX-09 | Visual accessibility audit | Inspect icon-only buttons in GalleryHeader, Toast, Search, PhotoItem |
| DarkModeToggle 300ms animation | UX-12 | Code verification sufficient | Read DarkModeToggle.tsx and confirm `duration: 0.3` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
