---
phase: 02
slug: gallery-performance
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-24
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vite.config.ts (vitest setup) |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test -- --run && npm run build` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | GALLERY-01 | — | N/A | build | `npm run build` | N/A | pending |
| 02-01-02 | 01 | 1 | GALLERY-01 | — | N/A | build | `npm run build` | N/A | pending |
| 02-02-01 | 02 | 1 | GALLERY-02 | — | N/A | build | `npm run build` | N/A | pending |
| 02-02-02 | 02 | 1 | GALLERY-02 | — | N/A | build | `npm run build` | N/A | pending |
| 02-02-03 | 02 | 1 | GALLERY-02 | — | N/A | build | `npm run build` | N/A | pending |
| 02-02-04 | 02 | 1 | GALLERY-02 | — | N/A | build | `npm run build` | N/A | pending |
| 02-03-01 | 03 | 2 | GALLERY-03 | — | N/A | build | `npm run build` | N/A | pending |
| 02-03-02 | 03 | 2 | GALLERY-03 | — | N/A | build | `npm run build` | N/A | pending |
| 02-03-03 | 03 | 2 | GALLERY-03 | — | N/A | build | `npm run build` | N/A | pending |
| 02-04-01 | 04 | 2 | GALLERY-04 | — | N/A | build | `npm run build` | N/A | pending |
| 02-04-02 | 04 | 2 | GALLERY-04 | — | N/A | build | `npm run build` | N/A | pending |
| 02-04-03 | 04 | 2 | GALLERY-04 | — | N/A | build | `npm run build` | N/A | pending |

*Status: pending · green · red · flaky*

---

## Wave 0 Requirements

- [ ] `npm run build` passes before Phase 2 execution (baseline verification)
- [ ] Existing test infrastructure covers all phase requirements (vitest configured in vite.config.ts)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Lightbox prefetch behavior | GALLERY-04 | Visual inspection required for perceived smoothness | Open gallery, click through images, verify no visible loading between adjacent images |
| Blur placeholder appearance | GALLERY-03 | Visual inspection of progressive loading effect | Load gallery, observe blur placeholder fade-in on images with blurHash |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
