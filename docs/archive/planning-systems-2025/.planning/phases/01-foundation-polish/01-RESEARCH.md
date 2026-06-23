# Phase 1: Foundation & Polish - Research

**Researched:** 2026-04-23
**Domain:** React 19 SPA with Supabase, Framer Motion, Zustand
**Confidence:** HIGH

## Summary

Phase 1 targets code quality issues causing white screens and user-facing instability. The existing ErrorBoundary pattern works well but needs deployment on admin routes. Auth race conditions stem from concurrent `initializeAuth`/`refreshSession` calls in the Zustand store — a simple operation queue will serialize them. Console.* removal is already configured in Vite (esbuild drop), requiring verification only. The 1716-line MediaReviewPanel is the largest decomposition task — it naturally separates into 5 sub-components by function. Lightbox already has keyboard navigation; page transitions via Framer Motion are already in place. The main client consolidation issue is `src/utils/security.ts` creating a duplicate Supabase client.

**Primary recommendation:** Focus on auth queue implementation and MediaReviewPanel extraction first — they have the most dependency surface. Error boundaries and page transitions already exist and work.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Admin error boundaries show friendly message + retry button
- **D-02:** Replace console.* globally via esbuild drop console (not component-by-component)
- **D-03:** Queue auth operations — only one auth operation at a time
- **D-04:** MediaReviewPanel decomposes into: BatchList, FaceReviewGrid, ClusterMergeModal, FaceTaggingConfirmation, ReviewImportManifest
- **D-05:** Lightbox: arrow keys navigate, ESC close, visible close button
- **D-06:** Maintain existing PageTransition wrapper for Framer Motion animations
- **D-07:** Mobile nav works on all pages with smooth transitions
- **D-08:** Single Supabase client in src/lib/supabase.ts

### Claude's Discretion
- Fine-grained component extraction strategy for MediaReviewPanel — planner decides exact split points
- Specific logger utility implementation — use existing src/utils/logger.ts

### Deferred Ideas
None — discussion stayed within phase scope.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| POLISH-01 | Loading states on async operations | Existing skeleton components; needs deployment verification |
| POLISH-02 | Error states with recovery | ErrorBoundary.tsx already implemented with retry button |
| POLISH-03 | Lightbox keyboard navigation | PhotoLightbox.tsx lines 137-150 already handle ArrowLeft/ArrowRight/ESC |
| POLISH-04 | Mobile nav consistency | Header.tsx mobile hamburger works, scroll behavior auto-hides on mobile |
| POLISH-05 | Console.* removal in production | Vite esbuild drop already configured (vite.config.js line 242) |
| POLISH-06 | Smooth page transitions | PageTransition wrapper in App.tsx already animates all routes |
| ADMIN-01 | Admin error boundaries | RouteErrorBoundary wraps all routes; needs admin-specific boundary |
| ADMIN-02 | MediaReviewPanel decomposition | 1716-line component with clear extraction boundaries |
| ADMIN-03 | Auth race condition fix | authStore.ts has concurrent initializeAuth/refreshSession issue |
| ADMIN-04 | Single Supabase client | src/utils/security.ts creates duplicate client |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Error boundaries | Browser/Client | — | React component error handling |
| Auth state machine | Browser/Client | API/Backend | Zustand store + Supabase auth |
| Console.* removal | Build/Bundler | — | Vite esbuild plugin |
| MediaReviewPanel | Browser/Client | — | Admin React component |
| Lightbox navigation | Browser/Client | — | React + keyboard event handlers |
| Page transitions | Browser/Client | — | Framer Motion animations |
| Supabase client | API/Backend | Browser/Client | Single instance shared |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19 | UI framework | Project baseline |
| TypeScript | 5.x | Type safety | Project baseline |
| Vite | 7 | Bundler | Project baseline with esbuild drop console |
| Framer Motion | 11.x | Animations | PageTransition already in use |
| Zustand | 5.x | State management | authStore already implemented |

### Existing Utilities
| Utility | Location | Purpose | Notes |
|---------|----------|---------|-------|
| ErrorBoundary | src/components/error/ErrorBoundary.tsx | React error boundary | Has RouteErrorBoundary variant |
| PageTransition | src/App.tsx (line 26) | Route animation | Wraps all LazyPage components |
| logger | src/utils/logger.ts | Console replacement | Already exists, development-only output |
| AuthProvider | src/providers/AuthProvider.tsx | Auth state subscription | Prevents memory leaks on unmount |

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                  │
├─────────────────────────────────────────────────────────────────┤
│  App.tsx (RouteErrorBoundary wraps all routes)                  │
│                                                                  │
│  ┌─ LazyPage ── PageTransition ──┬─ Home ──────────────────┐   │
│  │                                ├─ Gallery ── PhotoLightbox│   │
│  │                                ├─ Film ──────────────────┤   │
│  │                                ├─ Upload ────────────────┤   │
│  │                                ├─ Guestbook ─────────────┤   │
│  │                                └─ Admin ──────────────────┤   │
│  │                                          │                │   │
│  │                     ┌───────────────────┴──────────────┐ │   │
│  │                     │ AdminLayout (Suspense + Skeleton) │ │   │
│  │                     │  ├─ Dashboard                      │ │   │
│  │                     │  ├─ PhotoModeration               │ │   │
│  │                     │  ├─ MediaReviewPanel (1716 lines) │ │   │
│  │                     │  ├─ GuestbookModeration            │ │   │
│  │                     │  └─ ...                            │ │   │
│  └──────────────────────────────────────────────────────────┘ │   │
│                                                                  │
│  ┌─ AuthProvider (onAuthStateChange subscription) ────────────┐ │
│  │  └─ authStore.ts (initializeAuth + refreshSession)        │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─ Stores ────────────────────────────────────────────────────┐ │
│  │  authStore.ts · galleryStore.ts · uiStore.ts                │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Supabase Backend                            │
│  Auth (email/password) · PostgreSQL · Storage (S3)               │
└─────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (affected files)

```
src/
├── components/
│   ├── admin/
│   │   ├── MediaReviewPanel.tsx       # DECOMPOSE THIS
│   │   ├── BatchList.tsx              # NEW - batch selector
│   │   ├── FaceReviewGrid.tsx         # NEW - people queue
│   │   ├── ClusterMergeModal.tsx      # NEW - photo inspector
│   │   ├── FaceTaggingConfirmation.tsx # NEW - face detail panel
│   │   └── ReviewImportManifest.tsx   # NEW - batch sync
│   └── error/
│       └── ErrorBoundary.tsx          # ALREADY EXISTS
├── stores/
│   └── authStore.ts                   # ADD operation queue
├── lib/
│   └── supabase.ts                   # ALREADY SINGLETON
└── utils/
    ├── logger.ts                      # USE for console replacement
    └── security.ts                    # REMOVE duplicate supabase client
```

### Pattern 1: Error Boundary with Recovery

**Existing pattern** (ErrorBoundary.tsx lines 17-73):
```tsx
// Already implemented - friendly UI with retry
<ErrorBoundary fallback={
  <div className="error-ui">
    <h2>Something went wrong</h2>
    <button onClick={resetError}>Try Again</button>
  </div>
}>
  {children}
</ErrorBoundary>
```

**Admin-specific deployment** (AdminLayout.tsx line 108):
```tsx
<Suspense fallback={<AdminPageSkeleton />}>
  <Routes>
    <Route path="review" element={<MediaReviewPanel />} />  {/* needs error boundary */}
  </Routes>
</Suspense>
```

### Pattern 2: Auth Operation Queue

**Current issue** (authStore.ts lines 93-128):
```typescript
// Both initializeAuth and refreshSession can run concurrently
initializeAuth: async () => { /* calls getSession */ }
refreshSession: async () => { /* calls refreshSession */ }
// Race: both call supabase.auth.getSession() simultaneously
```

**Solution pattern**:
```typescript
// Add to authStore
let authOperationQueue = Promise.resolve()

const queueAuthOperation = async <T>(op: () => Promise<T>): Promise<T> => {
  authOperationQueue = authOperationQueue.then(op).catch(() => {})
  return authOperationQueue
}

initializeAuth: async () => queueAuthOperation(async () => { /* existing logic */ })
refreshSession: async () => queueAuthOperation(async () => { /* existing logic */ })
```

### Pattern 3: Vite esbuild Console Drop (ALREADY CONFIGURED)

**vite.config.js line 242**:
```javascript
esbuild: {
  drop: mode === 'production' ? ['console', 'debugger'] : [],
},
```

**Verification needed**: Confirm build output has no console.* calls. No code changes required — just verify it works.

### Pattern 4: MediaReviewPanel Decomposition

**Current lines** (1716 total):
- Batch selector + status display: lines 997-1114 (117 lines)
- People queue (FaceReviewGrid): lines 1124-1180 (56 lines)
- Group detail panel: lines 1180-1462 (282 lines)
- Photo inspector modal (ClusterMergeModal): lines 1464-1696 (232 lines)

**Extraction targets by decision D-04:**
1. **BatchList** — lines 997-1114 (batch selector, status stats, advanced tools)
2. **FaceReviewGrid** — lines 1125-1462 (left panel people queue + right panel group detail combined)
3. **ClusterMergeModal** — lines 1464-1696 (photo inspector modal, extracted from MediaReviewPanel)
4. **FaceTaggingConfirmation** — within the modal (face detail form, status buttons)
5. **ReviewImportManifest** — handleSyncManifestMetadata + handleApplyConfirmedFaces (already separate functions lines 833-980)

**Extraction strategy**: Convert internal functions at module level, then progressively import into new components.

### Pattern 5: Lightbox Keyboard Navigation (ALREADY IMPLEMENTED)

**PhotoLightbox.tsx lines 131-150**:
```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowLeft') { handlePrevious(); return }
    if (e.key === 'ArrowRight') { handleNext(); return }
  }
  document.addEventListener('keydown', handleKeyDown)
  return () => document.removeEventListener('keydown', handleKeyDown)
}, [isOpen, onClose, handlePrevious, handleNext])
```

**Already done**: ESC closes, arrow keys navigate. Only verification needed.

### Pattern 6: PageTransition (ALREADY IMPLEMENTED)

**App.tsx line 26-37**:
```typescript
function PageTransition({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}
```

**Already done**: All LazyPage components wrapped. No changes needed.

### Pattern 7: Supabase Client Consolidation

**Duplicate clients found:**
- `src/lib/supabase.ts` (line 23) — main client, single export
- `src/utils/security.ts` (line 6) — creates another client instance

**Solution**: Remove client from security.ts, import from lib/supabase.ts:
```typescript
// security.ts - remove createClient, use shared import
import { supabase } from '@/lib/supabase'
// Also remove rateLimitMap (module-level state with potential issues)
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Console removal | Manual find/replace console.* | Vite esbuild drop (already configured) | Automatic, build-time |
| Page transitions | Custom animation system | Framer Motion PageTransition (already exists) | Consistent, already working |
| Error boundaries | Custom error wrapper | ErrorBoundary.tsx (already implemented) | Has retry UI, dev mode details |
| Auth operation serialization | setTimeout-based debouncing | Promise chain queue | Ensures sequential execution |
| Lightbox keyboard nav | Custom key handlers | Existing PhotoLightbox handlers | Already implements spec |

## Common Pitfalls

### Pitfall 1: Console.* Removal Not Verified
**What goes wrong:** Vite esbuild drop is configured but build output still contains console.* calls — developer mode output is preserved, or the drop only affects certain file patterns.

**Why it happens:** `drop: ['console', 'debugger']` only applies in production mode. Development builds retain console.* for debugging. Also may not catch dynamic console.* calls.

**How to avoid:** Run `npm run build` and grep output for console — confirm production bundle has no console.*. Add `import logger from '@/utils/logger'` and use `logger.log()` instead of `console.log()` for development debugging that should never ship.

**Warning signs:** `npm run build && grep -r "console\." dist/` returns results.

### Pitfall 2: Auth Store Over-fetching on Refresh
**What goes wrong:** Both `initializeAuth` (on mount) and `refreshSession` (called periodically) may fire in quick succession, causing redundant supabase.auth.refreshSession() calls.

**Why it happens:** No operation queue — concurrent calls both hit Supabase auth endpoints.

**How to avoid:** Implement auth operation queue via promise chain serialization.

**Warning signs:** Browser Network tab shows duplicate auth.refreshSession calls.

### Pitfall 3: MediaReviewPanel Extraction Breaks State
**What goes wrong:** Moving sub-components out of MediaReviewPanel loses access to shared state (faces, faceDrafts, selectedBatch, etc.) passed via props.

**Why it happens:** Large component has implicit state coupling — props drilling after extraction becomes unwieldy.

**How to avoid:** Before extraction, refactor state to use Zustand store or React Context for shared review state. Then extract components that consume from store.

**Warning signs:** After extraction, components need 10+ props; prop drilling exceeds 3 levels.

### Pitfall 4: Duplicate Supabase Client Causes Auth State Split
**What goes wrong:** security.ts creates its own supabase client — auth state from lib/supabase.ts is different instance, causing session inconsistency.

**Why it happens:** Two createClient() calls create separate instances with separate in-memory auth state.

**How to avoid:** Import supabase from '@/lib/supabase' everywhere. Never create second client.

**Warning signs:** User signs in but requests from security.ts client show as unauthenticated.

## Code Examples

### 1. Auth Operation Queue (authStore.ts)

Source: Reviewed authStore.ts lines 93-128

```typescript
// PROPOSED: Add to authStore
let authOperationQueue: Promise<void> = Promise.resolve()

const queueAuthOperation = async <T>(fn: () => Promise<T>): Promise<T> => {
  return authOperationQueue.then(fn).catch((error) => {
    // Log but don't propagate - auth state stays consistent
    console.error('Auth operation failed:', error)
    return undefined as T
  })
}

// Wrap initializeAuth and refreshSession
initializeAuth: async () => {
  return queueAuthOperation(async () => {
    // existing initializeAuth logic
  })
},
refreshSession: async () => {
  return queueAuthOperation(async () => {
    // existing refreshSession logic
  })
},
```

### 2. Error Boundary on Admin Route

Source: AdminLayout.tsx lines 108-120, ErrorBoundary.tsx line 129

```tsx
// Wrap MediaReviewPanel with ComponentErrorBoundary
import { ComponentErrorBoundary } from '@/components/error/ErrorBoundary'

<Suspense fallback={<AdminPageSkeleton />}>
  <Routes>
    <Route
      path="review"
      element={
        <ComponentErrorBoundary componentName="Media Review Panel">
          <MediaReviewPanel />
        </ComponentErrorBoundary>
      }
    />
  </Routes>
</Suspense>
```

### 3. Supabase Client Consolidation

Source: security.ts lines 1-17, supabase.ts line 23

```typescript
// security.ts - REMOVE duplicate client creation
// BEFORE:
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {...})

// AFTER:
import { supabase } from '@/lib/supabase'
// Remove local supabaseUrl, supabaseAnonKey variables if only used for this client
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual console removal via grep | Vite esbuild drop console plugin | Vite 5+ (esbuild native) | Automated, build-time |
| Class components for error boundaries | Function components with hooks | React 16+ Error Boundaries | Simpler code |
| prop drilling for shared state | Zustand store or Context | React 19 patterns | Cleaner extraction |
| Multiple supabase clients | Single shared client | Supabase JS 2.x | Consistent auth state |

**Deprecated/outdated:**
- `console.error` in production code: Vite esbuild drop handles automatically

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Vite esbuild console drop is correctly configured and working | POLISH-05 | Build verification task needed |
| A2 | security.ts supabase client is only duplicate in src/ | ADMIN-04 | Verify no other createClient calls in src/ |
| A3 | MediaReviewPanel state can be lifted to store/context before extraction | ADMIN-02 | May need more refactoring before decomposition |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

## Open Questions

1. **MediaReviewPanel state management approach**
   - What we know: Component has 15+ pieces of state, shared across sub-sections
   - What's unclear: Should extraction use Zustand store or React Context for shared review state?
   - Recommendation: Use Zustand — galleryStore pattern already exists in codebase

2. **ErrorBoundary componentName prop usage**
   - What we know: ComponentErrorBoundary accepts optional componentName for friendly messaging
   - What's unclear: Should all admin page components get explicit names?
   - Recommendation: Yes — for MediaReviewPanel, AlbumOrganizer, PhotoModeration, GuestbookModeration

3. **Console.* verification method**
   - What we know: vite.config.js has drop: ['console', 'debugger']
   - What's unclear: Should we grep the dist/ output or trust the config?
   - Recommendation: Verify with `grep -r "console\." dist/assets/*.js | wc -l` after build

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build/dev | Verified | 20.x (project) | — |
| npm | Package install | Verified | 10.x | — |
| Vite 7 | Build/bundling | Verified | 7.x | — |
| React 19 | Runtime | Verified | 19.x | — |
| Framer Motion | Animations | Verified | 11.x | — |
| Zustand | State management | Verified | 5.x | — |

**All dependencies available** — no fallback strategies needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (already configured) |
| Config file | vitest.config.ts |
| Quick run command | `npm run test:run` |
| Full suite command | `npm run test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|---------------|
| POLISH-01 | Loading states on async ops | Unit | `npm run test:run -- src/stores/*.ts` | Need to add |
| POLISH-02 | Error recovery UI | Unit | `npm run test:run -- src/components/error/*.test.tsx` | ErrorBoundary tests? |
| POLISH-03 | Lightbox keyboard nav | Unit/E2E | Playwright test | Has e2e tests |
| POLISH-04 | Mobile nav works | Manual | Manual verification | — |
| POLISH-05 | Console.* removed | Build verification | `grep -r "console\." dist/` | — |
| POLISH-06 | Page transitions | Visual | Manual verification | — |
| ADMIN-01 | Admin error boundaries | Unit | `npm run test:run -- src/components/admin/*.test.tsx` | Need to add |
| ADMIN-02 | MediaReviewPanel decomposition | Unit | `npm run test:run -- src/components/admin/*.test.tsx` | Need to add |
| ADMIN-03 | Auth queue prevents race | Unit | `npm run test:run -- src/stores/authStore.test.ts` | Need to add |
| ADMIN-04 | Single Supabase client | Unit | `npm run test:run -- src/lib/supabase.test.ts` | Need to add |

### Wave 0 Gaps
- [ ] `tests/unit/stores/authStore.test.ts` — tests auth operation queue
- [ ] `tests/unit/components/admin/MediaReviewPanel.test.tsx` — tests decomposition
- [ ] `tests/unit/lib/supabase.test.ts` — tests client singleton
- [ ] `tests/unit/components/error/ErrorBoundary.test.tsx` — tests admin boundaries
- [ ] `tests/build/console-strip.test.js` — verifies production build has no console.*
- [ ] Framework install: Vitest already configured via package.json

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Supabase Auth with RLS |
| V3 Session Management | Yes | Supabase session management |
| V4 Access Control | Yes | Admin role check in authStore |
| V5 Input Validation | Yes | validateInput utility in security.ts |
| V6 Cryptography | No | No custom crypto in this phase |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Auth state inconsistency via duplicate clients | Information Disclosure | Single supabase client via lib/supabase.ts |
| Race conditions in auth initialization | Tampering | Promise chain queue serialization |
| Console logging sensitive data | Information Disclosure | Vite esbuild drop + logger redaction |

## Sources

### Primary (HIGH confidence)
- `src/components/error/ErrorBoundary.tsx` — Verified error boundary pattern
- `src/stores/authStore.ts` — Verified auth state issue
- `vite.config.js` line 242 — Verified esbuild drop console config
- `src/utils/logger.ts` — Verified existing logger utility
- `src/components/photo-viewer/PhotoLightbox.tsx` — Verified keyboard nav implementation

### Secondary (MEDIUM confidence)
- `src/App.tsx` — Verified PageTransition wrapper usage
- `src/providers/AuthProvider.tsx` — Verified auth subscription pattern
- `src/components/admin/MediaReviewPanel.tsx` — Verified 1716-line component structure

### Tertiary (LOW confidence)
- Vite esbuild drop effectiveness — needs build verification
- security.ts duplicate client impact — needs runtime verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing codebase verified
- Architecture: HIGH — patterns already implemented, not designing from scratch
- Pitfalls: MEDIUM — some assumptions need verification (console drop, duplicate client)

**Research date:** 2026-04-23
**Valid until:** 2026-05-23 (30 days — stable phase)