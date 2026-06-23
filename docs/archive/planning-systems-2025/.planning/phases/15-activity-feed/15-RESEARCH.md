# Phase 15: Activity Feed - Research

**Researched:** 2026-04-29
**Domain:** Social Features / Activity Feed (SOC-01, SOC-02, SOC-03)
**Confidence:** HIGH

## Summary

Phase 15 implements a social activity feed at `/activity` that aggregates guest photo uploads, guestbook messages, and featured moments chronologically. The key technical challenge is unifying three distinct data sources into a single realtime stream. The implementation requires: (1) a new `activity_log` table to serve as a unified realtime channel, (2) database triggers on source tables to populate it, (3) a new `ActivityFeedPage` with client-side filtering and infinite scroll, and (4) Supabase Realtime subscriptions for live updates.

**Primary recommendation:** Create `activity_log` as a write-through cache fed by triggers on `guest_uploads`, `guestbook_messages`, and `site_editorial_features`. Subscribe to the single `activity_log` channel for realtime. Client-side filtering and pagination of pre-loaded data (D-06, D-07) keeps the implementation simple and fast.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Thumbnail on left, info (name + type + time) on right — compact, image-forward
- **D-02:** Card background: cream/white gradient (matches GuestHighlightReel warm style)
- **D-03:** Thumbnail size: small square (4/3 or square aspect)
- **D-04:** Single `activity_log` channel — one unified channel for all activity types
- **D-05:** "X new activity" banner — click prepends new items to top without scrolling
- **D-06:** Load all activity on mount, filter client-side
- **D-07:** Auto-infinite scroll — automatically loads more as user scrolls
- **D-08:** "Be the first to contribute" prompt for empty state
- **D-09:** Feed aggregates from: guest_uploads (status='approved'), guestbook_messages, site_editorial_features
- **D-10:** Chronological order: created_at DESC
- **D-11:** Pagination: 20 items per page
- **D-12:** Filter toggles: All | Photos | Guestbook | Moments
- **D-13:** Active filter persists during session (client-side)
- **D-14:** No additional fetch needed for filtering

### Claude's Discretion
- Exact card animation timing (use 300ms baseline)
- Whether to use a Zustand store or local state for feed state
- Implementation of the "X new activity" banner click behavior details

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SOC-01 | Activity Feed Page — chronological feed of approved guest uploads, guestbook messages, and featured moments at `/activity` | Unified query across 3 tables, ActivityFeedPage component, infinite scroll via existing `useInfiniteScroll` hook |
| SOC-02 | Realtime Updates — new activity appears without refresh via Supabase Realtime subscription | `activity_log` table with INSERT trigger, single realtime channel subscription, "New activity" banner |
| SOC-03 | Filtering — filter toggles (All / Photos / Guestbook / Moments) that persist during session | Client-side filtering of pre-loaded data, sessionStorage for filter state persistence |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Activity feed data aggregation | API / Backend | — | Unified query across 3 tables, potentially via RPC or view |
| Realtime subscription | API / Backend | Browser / Client | Supabase Realtime channel on `activity_log` table |
| Feed UI rendering | Browser / Client | — | React component with Framer Motion animations |
| Filter state management | Browser / Client | — | Client-side filtering, sessionStorage persistence |
| Infinite scroll pagination | Browser / Client | — | Existing `useInfiniteScroll` hook, AbortController for race condition handling |
| New activity banner | Browser / Client | — | Prepending state, click-to-scroll behavior |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | 19.2.4 | UI framework | Project baseline |
| Supabase JS | 2.99.0 | Backend client + realtime | Project baseline |
| Zustand | 5.0.11 | State management | Project baseline — use for `activityFeedStore` |
| Framer Motion | 12.35.2 | Animations | Project baseline — 300ms transitions per Phase 13/14 |
| React Router v7 | 7.13.1 | Routing | Project baseline |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `useInfiniteScroll` (existing) | — | Infinite scroll with AbortController | Reuse for pagination |
| `cn` / `clsx` | 2.1.1 | Class name utility | Card class composition |
| lucide-react | 0.577.0 | Icons | Activity type icons (Camera, MessageCircle, Star) |

### No New Dependencies Required
All required packages are already installed.

---

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Activity Feed Architecture                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────────┐  │
│  │  guest_uploads   │    │guestbook_messages│    │site_editorial_features│  │
│  │  (status='appvd')│    │                  │    │                      │  │
│  └────────┬─────────┘    └────────┬─────────┘    └──────────┬───────────┘  │
│           │                       │                          │              │
│           └───────────────────────┼──────────────────────────┘              │
│                                   ▼                                         │
│                    ┌────────────────────────────┐                           │
│                    │   INSERT TRIGGER           │                           │
│                    │  (on each source table)    │                           │
│                    └────────────┬───────────────┘                           │
│                                   ▼                                         │
│                    ┌────────────────────────────┐                           │
│                    │      activity_log          │  ← Unified realtime source │
│                    │  (id, type, source_id,     │                           │
│                    │   source_type, created_at) │                           │
│                    └────────────┬───────────────┘                           │
│                                   │                                         │
│                    ┌──────────────┴───────────────┐                        │
│                    │   Supabase Realtime          │                        │
│                    │   (INSERT on activity_log)   │                        │
│                    └──────────────┬───────────────┘                        │
│                                   │                                         │
│  ┌────────────────────────────────▼────────────────────────────────────┐  │
│  │                     ActivityFeedPage (/activity)                       │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │  FilterToggle: [All] [Photos] [Guestbook] [Moments]              │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │  ActivityCard (type, name, thumbnail, timestamp)               │  │  │
│  │  │  ActivityCard                                                   │  │  │
│  │  │  ActivityCard                                                   │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  │  ┌───────────────┐  ← Intersection Observer sentinel                 │  │
│  │  │ Load More     │     triggers useInfiniteScroll.loadMore()        │  │
│  │  └───────────────┘                                                   │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │  "X new activity" banner (AnimatePresence, top of feed)        │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
src/
├── pages/
│   └── Activity.tsx              # New lazy-loaded page
├── components/
│   ├── activity/
│   │   ├── ActivityFeed.tsx       # Main feed container
│   │   ├── ActivityCard.tsx        # Individual activity item
│   │   ├── ActivityFilters.tsx     # Filter toggle buttons
│   │   └── NewActivityBanner.tsx   # "X new activity" banner
│   └── sections/
│       └── EmptyActivityState.tsx # "Be the first to contribute"
├── stores/
│   └── activityFeedStore.ts        # Zustand store for feed state
├── hooks/
│   └── useActivityRealtime.ts      # Realtime subscription hook
└── lib/
    └── supabase/
        └── activity.ts             # Activity-specific Supabase queries
```

### Pattern 1: Unified Activity Query
**What:** Single query that unions data from 3 tables with type discrimination
**When to use:** Fetching initial feed load
**Example:**
```typescript
// Pseudocode — actual implementation via RPC or UNION view
async function fetchActivityFeed(limit = 20, offset = 0) {
  const [uploads, messages, features] = await Promise.all([
    supabase.from('guest_uploads').select('id, guest_name as name, photo_urls[1] as thumbnail, created_at').eq('status', 'approved'),
    supabase.from('guestbook_messages').select('id, name, media_url as thumbnail, created_at'),
    supabase.from('site_editorial_features').select('id, title as name, source_url as thumbnail, created_at').eq('is_active', true),
  ])
  // Merge, sort by created_at DESC, apply pagination
}
```

### Pattern 2: Single Realtime Channel
**What:** Subscribe to one `activity_log` channel, not 3 separate channels
**When to use:** SOC-02 realtime updates
**Example:**
```typescript
// Source: Based on supabase.ts realtime config (params.eventsPerSecond: 10)
const channel = supabase
  .channel('activity_log')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'activity_log'
  }, (payload) => {
    setNewItems(prev => [payload.new, ...prev])
  })
  .subscribe()

// Cleanup on unmount
return () => supabase.removeChannel(channel)
```

### Pattern 3: Client-Side Filtering
**What:** Filter pre-loaded data without additional fetches
**When to use:** SOC-03 filter toggles (D-06, D-13, D-14)
**Example:**
```typescript
const [activeFilter, setActiveFilter] = useState<'all' | 'photos' | 'guestbook' | 'moments'>('all')
const filteredItems = useMemo(() => {
  if (activeFilter === 'all') return allItems
  return allItems.filter(item => item.type === activeFilter)
}, [allItems, activeFilter])
```

### Pattern 4: Activity Card (Reference: GuestHighlightReel)
**What:** Thumbnail left, info right, cream gradient background, rounded-2xl
**When to use:** Each activity item display
**Example:**
```typescript
// Based on GuestHighlightReel.tsx lines 158-173 and 78-153
<div className="flex gap-3 p-3 rounded-xl bg-gradient-to-br from-cream-50 to-gold-50/40">
  <img src={thumbnail} className="w-16 h-16 rounded-lg object-cover" />
  <div className="flex-1 min-w-0">
    <p className="font-medium text-charcoal-800 truncate">{name}</p>
    <p className="text-sm text-charcoal-500">{typeLabel} · {timeAgo}</p>
  </div>
</div>
```

### Anti-Patterns to Avoid
- **Filtering server-side:** D-06 mandates client-side filtering — no per-filter fetch
- **Multiple realtime channels:** D-04 mandates single `activity_log` channel
- **Blocking scroll on new items:** D-05 banner prepends without scrolling — use `scrollTop` not `scrollTo`
- **Loading spinner on initial mount:** PageLoader (Suspense fallback) handles this

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Infinite scroll | Custom scroll listener | `useInfiniteScroll` hook (existing) | Already handles AbortController, race conditions, cleanup |
| Realtime subscription | Raw WebSocket | Supabase channel API | Already configured in supabase.ts, handles reconnection |
| Time formatting | Custom date formatter | `date-fns` (already installed) | Handles locales, relative time, edge cases |
| Class composition | Template literals | `cn()` / `clsx` (existing) | Safely merges conditional classes |

---

## Common Pitfalls

### Pitfall 1: Realtime Memory Leaks
**What goes wrong:** Subscriptions persist after unmount, causing memory leaks and duplicate handlers
**Why it happens:** Missing cleanup on component unmount
**How to avoid:** Always call `supabase.removeChannel(channel)` in cleanup function; use `useRef` to track channel instance
**Warning signs:** Duplicate items in feed, console warnings about unremoved channels

### Pitfall 2: Race Conditions in Infinite Scroll
**What goes wrong:** Fast scrolling triggers multiple concurrent loads, items appear out of order
**Why it happens:** No concurrency control between load operations
**How to avoid:** The existing `useInfiniteScroll` hook uses `pendingLoadRef` to prevent concurrent loads
**Warning signs:** Items 15-20 appear before items 0-14, `isLoading` stuck in true

### Pitfall 3: Stale Filter State
**What goes wrong:** Active filter resets on page navigation or is lost on refresh
**Why it happens:** Filter state not persisted when it should be (D-13 says session-persist)
**How to avoid:** Use `sessionStorage.setItem('activity-filter', activeFilter)` on change
**Warning signs:** Users report filter resetting unexpectedly

### Pitfall 4: Large Initial Load
**What goes wrong:** Loading all activity on mount causes slow initial page render
**Why it happens:** Contradiction between D-06 (load all) and performance best practices
**How to avoid:** The 3-source aggregation typically has modest data volume; if problematic, paginate initial load to 40 items with infinite scroll continuing
**Warning signs:** Initial paint > 2 seconds, Lighthouse performance score drop

### Pitfall 5: Incorrect Activity Type Detection
**What goes wrong:** Featured moments show wrong icon or link to wrong destination
**Why it happens:** `site_editorial_features` has multiple `source_type` values
**How to avoid:** Map `source_type` to display type: `guest_upload` → photos, `guestbook_message` → guestbook, `custom`/`film_chapter` → moments

---

## Code Examples

### New Activity Banner (Framer Motion)
```typescript
// Source: Adapted from GuestHighlightReel.tsx lines 156-186 (quote indicator pattern)
// SOC-02: "X new activity" banner appears when new items arrive
<AnimatePresence>
  {newItemsCount > 0 && (
    <motion.button
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      onClick={() => {
        setItems(prev => [...newItems, ...prev])
        setNewItems([])
      }}
      className="sticky top-4 z-10 mx-auto rounded-full bg-gold-500 px-4 py-2 text-sm font-medium text-white shadow-lg"
    >
      {newItemsCount} new activity
    </motion.button>
  )}
</AnimatePresence>
```

### Filter Toggle (Client-Side)
```typescript
// Source: Adapted from GuestHighlightReel.tsx lines 174-186 (dot indicator pattern)
// SOC-03, D-12, D-13: Filter persists during session
const [activeFilter, setActiveFilter] = useState<'all' | 'photos' | 'guestbook' | 'moments'>(() => {
  if (typeof sessionStorage !== 'undefined') {
    return (sessionStorage.getItem('activity-filter') as FilterType) || 'all'
  }
  return 'all'
})

const handleFilterChange = (filter: FilterType) => {
  setActiveFilter(filter)
  sessionStorage.setItem('activity-filter', filter)
}

<div className="flex gap-2">
  {(['all', 'photos', 'guestbook', 'moments'] as const).map(filter => (
    <button
      key={filter}
      onClick={() => handleFilterChange(filter)}
      className={cn(
        'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
        activeFilter === filter
          ? 'bg-gold-500 text-white'
          : 'bg-cream-200 text-charcoal-600 hover:bg-cream-300'
      )}
    >
      {filter.charAt(0).toUpperCase() + filter.slice(1)}
    </button>
  ))}
</div>
```

### Realtime Subscription Hook
```typescript
// Source: Based on supabase.ts realtime config (params.eventsPerSecond: 10)
// SOC-02: New activity appears without refresh
function useActivityRealtime(onNewActivity: (item: ActivityItem) => void) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    channelRef.current = supabase
      .channel('activity_feed')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'activity_log'
      }, (payload) => {
        onNewActivity(payload.new as ActivityItem)
      })
      .subscribe()

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [onNewActivity])
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Multiple channel subscriptions | Single `activity_log` channel | Phase 15 (this phase) | Simplified realtime logic, single cleanup path |
| Server-side filtering | Client-side filtering (D-06) | Phase 15 (this phase) | Instant filter response, no network per filter change |
| Page-level pagination | Auto-infinite scroll (D-07) | Phase 15 (this phase) | Smoother UX, uses existing `useInfiniteScroll` hook |

**Deprecated/outdated:**
- `moderation_audit_log` table name similarity — not related, different purpose

---

## Assumptions Log

> List all claims tagged `[ASSUMED]` in this research. The planner and discuss-phase use this section to identify decisions that need user confirmation before execution.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `activity_log` table does not exist yet | Standard Stack | Requires migration to create; if it exists, migration still safe (CREATE TABLE IF NOT EXISTS) |
| A2 | Supabase realtime is enabled on `activity_log` | Architecture Patterns | Requires `ALTER PUBLICATION` or RLS + realtime enablement; may need Supabase dashboard config |
| A3 | Database trigger syntax is compatible | Don't Hand-Roll | PostgreSQL trigger syntax assumed; need to verify Supabase Postgres version |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

---

## Open Questions

1. **Activity log table creation approach**
   - What we know: `activity_log` table needed as unified realtime source
   - What's unclear: Whether to use a PostgreSQL view, materialized view, or physical table with triggers
   - Recommendation: Physical table with triggers (INSERT on source tables) — most reliable for realtime

2. **Initial feed load size**
   - What we know: D-06 says "load all activity on mount"
   - What's unclear: What constitutes "all" for a wedding site with years of content? Photo count?
   - Recommendation: Load 100 most recent items initially, infinite scroll for older items

3. **Featured moments inclusion criteria**
   - What we know: `site_editorial_features` has `is_active` flag and `slot` field
   - What's unclear: Should ALL active features appear, or only specific slots like `home_moment_of_the_week`?
   - Recommendation: Include all `is_active = true` features — let editors control what appears via the existing admin UI

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build/dev | ✓ | >=20.19.0 | — |
| npm | Package install | ✓ | 11.11.0 | — |
| Supabase CLI | Migrations | ✓ | 2.78.1 | — |
| Vitest | Unit tests | ✓ | 4.0.18 | — |
| Playwright | E2E tests | ✓ | 1.58.2 | — |
| date-fns | Time formatting | ✓ | (bundled) | Custom formatter |

**Missing dependencies with no fallback:**
- None identified — all required tools are available

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + Testing Library React 16.3.2 |
| Config file | vitest.config.js (exists) |
| Quick run command | `npm run test:run -- ActivityFeed` |
| Full suite command | `npm run test:run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SOC-01 | Feed renders at `/activity` | E2E | `npm run test:e2e:public` | No — new route |
| SOC-01 | Shows approved uploads, guestbook messages, featured moments | Unit | `npm run test:run -- ActivityFeed` | No — new tests |
| SOC-01 | Pagination works (20 items/page) | Unit | `npm run test:run -- ActivityFeed` | No — new tests |
| SOC-01 | Empty state displays when no activity | E2E | `npm run test:e2e:public` | No — new test |
| SOC-02 | "New activity" banner appears on realtime insert | Unit (mock realtime) | `npm run test:run -- ActivityFeed` | No — new test |
| SOC-02 | No duplicate entries or memory leaks | Unit (cleanup verification) | `npm run test:run -- ActivityFeed` | No — new test |
| SOC-03 | Filter buttons render | Unit | `npm run test:run -- ActivityFilters` | No — new test |
| SOC-03 | Filter shows correct subset | Unit | `npm run test:run -- ActivityFilters` | No — new test |
| SOC-03 | Active filter visually indicated | Unit | `npm run test:run -- ActivityFilters` | No — new test |

### Sampling Rate
- **Per task commit:** `npm run test:run -- ActivityFeed` (target: <30s)
- **Per wave merge:** `npm run test:run` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/activity/ActivityFeed.test.tsx` — covers SOC-01 (render, pagination, empty state)
- [ ] `tests/activity/ActivityFilters.test.tsx` — covers SOC-03 (filter buttons, correct subset, visual indication)
- [ ] `tests/activity/ActivityRealtime.test.tsx` — covers SOC-02 (banner, no duplicates)
- [ ] `tests/activity/NewActivityBanner.test.tsx` — covers banner behavior
- [ ] `tests/activity/ActivityCard.test.tsx` — covers card display for each type
- [ ] `tests/activity/EmptyActivityState.test.tsx` — covers empty state CTA
- [ ] `tests/activity/setup.ts` — shared test utilities and render wrapper

*(If no gaps: "None — existing test infrastructure covers all phase requirements")*

---

## Security Domain

### Applicable ASVS Categories
This phase primarily involves read operations on public data (approved uploads, guestbook messages, active features).

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Activity feed is public read |
| V3 Session Management | No | No auth required for viewing |
| V4 Access Control | Yes | RLS policies ensure only `status='approved'` uploads are shown |
| V5 Input Validation | Yes | Validate all data from Supabase before rendering (XSS prevention) |
| V6 Cryptography | No | No sensitive data in activity feed |

### Known Threat Patterns for Supabase + React

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via unsanitized content | Reputation | React escapes by default; validate `name`, `content` fields |
| RLS bypass | Information Disclosure | Verify `guest_uploads` RLS: `status = 'approved'` check in policy |
| Realtime injection | Tampering | activity_log populated by DB triggers only (not user-supplied INSERT) |

---

## Sources

### Primary (HIGH confidence)
- `src/components/sections/GuestHighlightReel.tsx` — Card layout reference, animation patterns
- `src/lib/supabase.ts` — Supabase client setup, realtime config, type definitions
- `src/hooks/useInfiniteScroll.ts` — Existing pagination hook with AbortController
- `src/stores/uiStore.ts` — Zustand store patterns, sessionStorage usage
- `src/App.tsx` — Route structure, lazy loading pattern, PageTransition wrapper
- `package.json` — Dependency versions

### Secondary (MEDIUM confidence)
- Supabase Realtime documentation — channel subscription pattern
- Phase 13/14 context — 300ms animation baseline, design tokens

### Tertiary (LOW confidence)
- None — all key patterns verified from existing codebase

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified from package.json, existing patterns in codebase
- Architecture: HIGH — uses existing `useInfiniteScroll`, Supabase realtime, Zustand patterns
- Pitfalls: MEDIUM — based on known Supabase realtime gotchas, verified against existing code patterns

**Research date:** 2026-04-29
**Valid until:** 2026-05-29 (30 days — Supabase realtime patterns are stable)
