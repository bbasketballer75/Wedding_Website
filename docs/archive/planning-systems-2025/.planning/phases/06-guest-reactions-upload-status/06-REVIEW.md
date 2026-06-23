---
phase: 06-guest-reactions-upload-status
reviewed: 2026-04-24T17:45:00Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - src/pages/Guestbook.tsx
findings:
  critical: 0
  warning: 1
  info: 0
  total: 1
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-04-24T17:45:00Z
**Depth:** standard
**Files Reviewed:** 1
**Status:** issues_found

## Summary

Reviewed `src/pages/Guestbook.tsx` (798 lines). The implementation is generally well-structured with proper TypeScript types, optimistic UI updates for reactions, and a good UX pattern (local state for replies). One logical bug was found in the pagination reset effect.

## Warnings

### WR-01: Pagination reset on new message submission

**File:** `src/pages/Guestbook.tsx:307-309`
**Issue:** The `useEffect` that resets `visibleCount` runs whenever `messages.length` changes. When a user submits a new message, `messages` is updated with the new item prepended, causing `messages.length` to increase by 1. This triggers the effect and resets `visibleCount` back to `INITIAL_VISIBLE_MESSAGES`, undoing the pagination the user may have scrolled through.

```typescript
useEffect(() => {
  setVisibleCount(INITIAL_VISIBLE_MESSAGES)
}, [messages.length])
```

This means after posting a message, the feed jumps back to showing only the first 8 messages, forcing the user to click "Read more notes" again.

**Fix:** Move the reset logic into the submit handler, or use a different trigger such as comparing the previous messages array length before the update. Alternatively, only reset when truly adding a message (not on initial load):

```typescript
// Option A: Reset only when a new message is added (not on initial load)
const prevMessagesLengthRef = useRef(messages.length)
useEffect(() => {
  if (messages.length > prevMessagesLengthRef.current) {
    setVisibleCount(INITIAL_VISIBLE_MESSAGES)
  }
  prevMessagesLengthRef.current = messages.length
}, [messages.length])

// Option B: Remove the effect entirely and reset in the submit handler
// where you already call: setVisibleCount(INITIAL_VISIBLE_MESSAGES)
```

The submit handler at line 467 already calls `setVisibleCount(INITIAL_VISIBLE_MESSAGES)` explicitly, so the effect is redundant and causes the bug.

---

_Reviewed: 2026-04-24T17:45:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_