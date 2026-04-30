# Phase 15: Activity Feed - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-29
**Phase:** 15-activity-feed
**Areas discussed:** Activity card design, Realtime subscription strategy, Pagination & filtering approach, Empty state design

---

## Activity Card Design

| Option | Description | Selected |
|--------|-------------|----------|
| Thumbnail left, info right | Compact, image-forward | ✓ |
| Thumbnail top, info below | Stacked vertically | |
| Text-only list item | Minimalist, no image | |

**User's choice:** Thumbnail left, info right
**Notes:** Compact and image-forward — card style should feel warm and on-brand

| Option | Description | Selected |
|--------|-------------|----------|
| Cream/white gradient | Matches GuestHighlightReel warm style | ✓ |
| White with shadow | Standard card look | |
| Transparent with hover | Modern, minimal | |

**User's choice:** Cream/white gradient (recommended)
**Notes:** Matches GuestHighlightReel style — warm, on-brand

| Option | Description | Selected |
|--------|-------------|----------|
| Small square | Like GuestHighlightReel — 4/3 or square aspect | ✓ |
| Medium rectangle | Rectangular thumbnails showing more | |

**User's choice:** Small square (recommended)
**Notes:** Consistent with GuestHighlightReel thumbnail style

---

## Realtime Subscription Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| One activity_log channel | One unified channel for all activity types | ✓ |
| Three separate channels | One per table — more granular, more complex | |

**User's choice:** One activity_log channel (recommended)
**Notes:** Easier to manage, fewer edge cases

| Option | Description | Selected |
|--------|-------------|----------|
| "X new activity" banner | Click prepends items to top without scrolling | ✓ |
| Auto-prepend with highlight | New items appear with subtle highlight animation | |
| Silent prepend | No banner — just silently loads new items | |

**User's choice:** "X new activity" banner (recommended)
**Notes:** Clean and functional

---

## Pagination & Filtering Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Load all, filter client-side | Fast filtering, more initial data | ✓ |
| Paginated fetch | Less initial data, needs API support | |

**User's choice:** Load all, filter client-side (recommended)
**Notes:** Fast filtering, no additional fetch needed

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-infinite scroll | Automatically loads more as user scrolls | ✓ |
| Load More button | More control for users, easier to implement | |

**User's choice:** Auto-infinite scroll
**Notes:** Smoother experience

---

## Empty State Design

| Option | Description | Selected |
|--------|-------------|----------|
| "No activity yet" message | Warm, inviting | |
| "Be the first" prompt | Friendly message with links to upload and guestbook | ✓ |
| Simple text only | Just text, no illustration or CTA | |

**User's choice:** "Be the first" prompt
**Notes:** Encourages contribution rather than just saying "nothing here"

---

## Claude's Discretion

- Animation duration choices (300ms transitions, 150ms micro)
- Exact thumbnail dimensions (aspect ratio 4/3 vs square)
- Filter toggle visual style
- Card shadow/spacing details

---

*Discussion completed: 2026-04-29*
