---
phase: 15
slug: activity-feed
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-30
---

# Phase 15 — Validation Strategy

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
| 15-01-01 | 01 | 1 | SOC-01 | T-15-01 | activity_log table created with proper RLS | unit | `npm run test -- --run` | ✅ | ⬜ pending |
| 15-01-02 | 01 | 1 | SOC-01 | T-15-01 | Triggers fire on source table inserts | unit | `npm run test -- --run` | ✅ | ⬜ pending |
| 15-01-03 | 01 | 1 | SOC-01 | T-15-01 | Zustand store persists filter state | unit | `npm run test -- --run` | ✅ | ⬜ pending |
| 15-02-01 | 02 | 2 | SOC-01 | — | /activity route renders ActivityFeed | e2e | `npm run test:e2e -- --run` | ✅ | ⬜ pending |
| 15-02-02 | 02 | 2 | SOC-03 | — | Filter toggles persist client-side | e2e | `npm run test:e2e -- --run` | ✅ | ⬜ pending |
| 15-02-03 | 02 | 2 | SOC-02 | T-15-02 | Realtime subscription fires on new activity | e2e | `npm run test:e2e -- --run` | ✅ | ⬜ pending |
| 15-02-04 | 02 | 2 | SOC-01 | — | Infinite scroll loads more at threshold | e2e | `npm run test:e2e -- --run` | ✅ | ⬜ pending |
| 15-02-05 | 02 | 2 | SOC-02 | — | NewActivityBanner prepends items on click | unit | `npm run test -- --run` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/tests/activityFeedStore.test.ts` — Zustand store tests
- [ ] `src/tests/useActivityRealtime.test.ts` — Hook tests
- [ ] `src/tests/activityCard.test.tsx` — Component tests

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Supabase realtime connection | SOC-02 | Requires live Supabase instance | Monitor browser console for realtime subscription messages |
| Visual layout matching UI-SPEC | SOC-01 | Visual inspection required | Compare ActivityCard screenshot against 15-UI-SPEC.md layout specs |

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