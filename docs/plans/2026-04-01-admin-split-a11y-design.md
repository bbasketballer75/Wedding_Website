# Design: Admin Code-Split, A11y Fixes & Console Drop

**Date:** 2026-04-01
**Status:** Approved
**Scope:** Admin.tsx extraction (Approach B), ShareModal/PhotoLightbox focus traps, vite drop_console

---

## Problem

`src/pages/Admin.tsx` is 3,880 lines — a single file containing seven distinct admin sections, all shared utilities, and all sub-components. It is unnavigable for development and loads all ~1,450 lines of `PhotoModeration` even when the user navigates to a different admin section.

Additionally:

- `ShareModal` and `PhotoLightbox` are missing `role="dialog"`, `aria-modal`, and focus trapping — keyboard and screen reader users cannot use them correctly.
- `drop_console: false` in `vite.config.js` means all `console.*` calls ship to production.

---

## Decisions

### Admin split: Approach B (internal sub-files with React.lazy)

`App.tsx` is unchanged. `Admin.tsx` becomes a thin re-export of `AdminLayout`. `AdminLayout` owns the internal React Router `<Routes>` and lazy-loads each section. Each section becomes its own file under `src/pages/admin/`.

Chose B over A (app-level routes) because it avoids touching `App.tsx` routing — a higher-risk change — while still achieving per-section code splitting.

### A11y: reuse existing `focusManagement.ts`

`src/accessibility/focusManagement.ts` already exports `trapFocus`. `KeyboardShortcutsModal.tsx` already demonstrates the correct pattern. ShareModal and PhotoLightbox will follow that same pattern — no new libraries.

---

## File Structure

```
src/pages/Admin.tsx                     # ~60 lines — re-exports AdminLayout
src/pages/admin/
  AdminLayout.tsx                       # shell nav, auth guard, Suspense, Routes
  Dashboard.tsx                         # overview stats, workflow steps (~190 lines)
  PhotoModeration.tsx                   # upload review queue (~1,450 lines)
  GuestbookModeration.tsx               # message/note moderation (~250 lines)
  AuditLogView.tsx                      # audit trail (~130 lines)
  FeaturedContentManager.tsx            # featured photo/video slots (~730 lines)
  Analytics.tsx                         # activity charts (~190 lines)
  Settings.tsx                          # read-only config reference (~85 lines)
  utils.ts                              # all pure functions and shared constants
```

---

## AdminLayout — Routing & Lazy Loading

```tsx
const Dashboard              = lazy(() => import('./admin/Dashboard'))
const PhotoModeration        = lazy(() => import('./admin/PhotoModeration'))
const GuestbookModeration    = lazy(() => import('./admin/GuestbookModeration'))
const AuditLogView           = lazy(() => import('./admin/AuditLogView'))
const FeaturedContentManager = lazy(() => import('./admin/FeaturedContentManager'))
const Analytics              = lazy(() => import('./admin/Analytics'))
const Settings               = lazy(() => import('./admin/Settings'))

<Suspense fallback={<AdminPageSkeleton />}>
  <Routes>
    <Route index element={<Dashboard />} />
    <Route path="photos" element={<PhotoModeration />} />
    <Route path="guestbook" element={<GuestbookModeration />} />
    <Route path="audit" element={<AuditLogView />} />
    <Route path="featured" element={<FeaturedContentManager />} />
    <Route path="analytics" element={<Analytics />} />
    <Route path="settings" element={<Settings />} />
    <Route path="*" element={<Navigate to="/admin" replace />} />
  </Routes>
</Suspense>
```

`AdminPageSkeleton` is a pulsing content-shaped placeholder matching the admin card layout.

---

## Utility Extraction (utils.ts)

Pure functions with no React dependencies extracted verbatim:

- `buildGuestTaggingCommands`, `normalizeTags`, `createPromotionDraft`
- `getGuestVideoVisibilityLabel`, `buildGuestVideoPromotionPatch`
- `getPublishedPhotoCount`, `buildGuestUploadMediaEntries`
- `buildApprovedFingerprintSet`, `buildPendingFingerprintSet`
- `getGuestUploadDuplicateInsight`, `getModerationState`
- `formatMemoryTrailLabel`, `getAdminAuditActor`
- `groupAuditEntries`, `appendAuditEntry`
- `formatAuditTimestamp`, `getAuditActorLabel`
- `getAdminRouteMeta`, `adminNavSections`, `adminRouteMeta`

Sub-components used by only one section (`AuditTrailList`, `CompactAuditHistory`, `AdminSignalRow`, `WorkflowStep`, `StatCard`) stay co-located in their section file.

---

## A11y: ShareModal & PhotoLightbox

Both get the pattern from `KeyboardShortcutsModal.tsx`:

```tsx
// On the modal root element:
role="dialog"
aria-modal="true"
aria-labelledby="modal-title-id"

// useEffect on open:
useEffect(() => {
  if (!isOpen) return
  const previousFocus = document.activeElement as HTMLElement
  modalRef.current?.focus()
  const release = FocusManager.trapFocus(modalRef.current!)
  return () => {
    release()
    previousFocus?.focus()
  }
}, [isOpen])
```

No new dependencies. Uses existing `src/accessibility/focusManagement.ts`.

---

## Performance: drop_console

```js
// vite.config.js line 236
drop_console: true,   // was false
```

One line. Strips all `console.*` calls from the production bundle at build time.

---

## What This Does NOT Include

- E2E tests for the admin panel (addressed in a follow-up)
- PhotoItem keyboard accessibility (follow-up)
- TypeScript `any` cleanup in `useWorkers.ts` (follow-up)

---

## Success Criteria

- `npx tsc --noEmit` passes
- `npx eslint src/` passes
- Admin panel navigates correctly to all sections in browser
- PhotoModeration JS chunk only loads when `/admin/photos` is visited
- ShareModal and PhotoLightbox trap focus correctly (tab cycles within modal, Escape closes)
- Production build has no `console.*` calls
