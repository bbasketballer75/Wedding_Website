# Phase 7: Gallery Virtualization - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-25
**Phase:** 07-gallery-virtualization
**Areas discussed:** Virtualization strategy, Prefetch scope, Lightbox behavior, Row height measurement

---

## Virtualization Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Row-container approach | Group items into visual rows filling viewport width. Each row is one virtualized item. | ✓ |
| Same-height row approach | Fixed row height, fill left-to-right with cropping. Simpler but loses true masonry. | |
| Estimated heights | Use aspect ratio to estimate, correct with ResizeObserver. Most complex. | |

**User's choice:** Row-container approach
**Notes:** Each row calculated based on aspect ratios and target row height (~280px). Photos within rows use flex layout with consistent height, cropping may occur.

---

## Prefetch Scope

| Option | Description | Selected |
|--------|-------------|----------|
| ±2 (5 total) | Conservative, ~10MB for typical photos. | |
| ±3 (7 total) | Recommended default, ~14MB. Standard gallery approach. | |
| ±5 (11 total) | More seamless, ~22MB. Better for heavy scrolling. | ✓ |

**User's choice:** ±5 (11 total)
**Notes:** Loads high-res versions for 11 photos total. Preloaded stored in Map for instant lightbox navigation.

---

## Lightbox Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Portal to body | Lightbox via React Portal to document.body, outside virtualized container. Scroll preserved. | ✓ |
| Within scroll container | Fixed/absolute inside gallery container. Can conflict with virtualization. | |
| Separate overlay layer | Sibling div at gallery level with higher z-index, not a portal. | |

**User's choice:** Portal to body
**Notes:** Clean separation, preserved scroll position, no virtualization recalculations during lightbox.

---

## Row Height Measurement

| Option | Description | Selected |
|--------|-------------|----------|
| ResizeObserver + dynamic measurement | hasFixedSize=false, measure actual heights with ResizeObserver, store in Map. | ✓ |
| Estimated heights with correction | Start with aspect ratio estimates, correct with ResizeObserver over time. | |
| Initial measure pass | One-time invisible render to measure all heights, then cache. | |

**User's choice:** ResizeObserver + dynamic measurement
**Notes:** hasFixedSize=false on useVirtualizer. On new photo load or resize, re-measure affected rows.

---

## Claude's Discretion

- Exact target row height value (280px or other)
- How to handle the column breakpoint changes (when viewport crosses sm/md/lg)
- PrefetchMap implementation details (memory management, eviction strategy)
- PhotoLightbox refactoring for portal integration

---
*Phase: 07-gallery-virtualization*
*Discussion: 2026-04-25*