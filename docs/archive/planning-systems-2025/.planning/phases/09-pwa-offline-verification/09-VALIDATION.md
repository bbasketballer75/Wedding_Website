---
phase: 9
slug: pwa-offline-verification
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-04-28
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual (DevTools Cache Storage, Chrome offline mode) |
| **Config file** | N/A — PWA configuration in vite.config.js |
| **Quick run command** | DevTools Application tab → Cache Storage inspection |
| **Full suite command** | DevTools offline mode + gallery navigation |
| **Estimated runtime** | ~5 minutes per full verification |

---

## Sampling Rate

- **After task 1 (runtime caching config):** Manual browser test — load gallery, check Cache Storage for `gallery-images-v1` cache
- **After task 2 (workbox-window integration):** Manual browser test — trigger SW update, verify toast appears
- **Phase gate:** Full offline testing checklist — all 5 success criteria verified manually

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 09-01 | 1 | PWA-01 | Manual | DevTools Cache Storage | N/A | ⬜ pending |
| 09-01-02 | 09-01 | 1 | PWA-01 | Manual | DevTools SW inspection | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No test stubs needed — PWA runtime caching and workbox-window integration are configured via vite.config.js and are verified through browser DevTools only.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PWA caches Supabase storage image URLs for offline access | PWA-01 | SW caching requires browser Cache Storage API | 1. Open gallery, scroll through photos 2. Open DevTools → Application → Cache Storage 3. Verify `gallery-images-v1` cache exists with entries |
| Guest can browse previously-viewed gallery photos while offline | PWA-01 | Offline mode must be tested in browser | 1. Load gallery with photos 2. Chrome DevTools → Network tab → check "Offline" 3. Reload gallery 4. Verify previously-viewed photos load from cache |
| Offline browsing works for photos in any album | PWA-01 | Each album must be tested separately | 1. Repeat above for Engagement, Bach+ette, Wedding Day, Guest Uploads tabs |
| PWA update notification appears when new version available | PWA-01 | SW update toast requires live SW registration | 1. Build with updated SW 2. Open site without closing tab 3. Verify toast appears instead of blank page |
| Offline fallback tested and working | PWA-01 | Fallback behavior is UI-only | 1. Toggle offline mode 2. Navigate to a page with uncached resources 3. Verify offline.html or graceful error |

---

## Validation Sign-Off

- [x] All tasks have manual verification (PWA offline behavior requires browser testing)
- [x] Sampling continuity: tasks are verified sequentially in browser
- [ ] `nyquist_compliant: true` set in frontmatter (set after execution completes)
- [ ] Phase gate: all 5 success criteria manually verified

**Approval:** pending
