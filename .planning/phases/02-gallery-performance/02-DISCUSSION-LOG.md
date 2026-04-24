# Phase 2: Gallery Performance & UX - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 02-gallery-performance
**Areas discussed:** Caching Strategy, LQIP Approach, Lightbox Prefetching, Type Consolidation

---

## Caching Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| In-memory only | Zustand store only — fastest, data lost on refresh | |
| sessionStorage | sessionStorage persistence — survives refresh, adds hydration complexity | ✓ |
| LRU cache | In-memory + LRU eviction — memory-managed, requires custom impl or lib | |

**User's choice:** sessionStorage
**Notes:** Wants data to survive page refresh. Willing to handle state hydration complexity.

---

## LQIP Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Blur hash | Server generates blur placeholder, best visual quality, requires backend support | ✓ |
| Dominant color | Extract color from image — simple, works without server changes | |
| CSS placeholder | Gray placeholder background — easiest to implement | |

**User's choice:** Blur hash
**Notes:** Best visual quality is worth the implementation effort.

---

## Lightbox Prefetching

| Option | Description | Selected |
|--------|-------------|----------|
| Aggressive (both) | Prefetch next+prev images while viewing — smoother nav, more bandwidth | ✓ |
| Conservative (next only) | Prefetch only next OR prev — balance between UX and bandwidth | |
| None | No prefetching — faster initial load, acceptable nav lag | |

**User's choice:** Aggressive (both)
**Notes:** Smoother navigation is worth the extra bandwidth.

---

## Type Consolidation

| Option | Description | Selected |
|--------|-------------|----------|
| supabase.ts canonical | supabase.ts defines all DB types — GalleryImage wraps it for display | |
| types/index.ts canonical | types/index.ts GalleryImage is canonical — supabase types map to it | |
| Separate with mapping | Keep separate — use at boundary layers only | |

**User's choice:** "i dont know which is proper for this project"
**Notes:** User unfamiliar with project patterns. Marked as Claude's discretion in CONTEXT.md — planner should analyze codebase and recommend an approach.

---

## Claude's Discretion

- Exact blur hash implementation strategy (client-side fallback if server doesn't provide)
- sessionStorage hydration timing and error handling
- Specific LRU cache size limits if sessionStorage proves insufficient
- Type canonical source recommendation from codebase analysis

## Deferred Ideas

None — discussion stayed within phase scope.
