# Phase 1: Foundation & Polish - Discussion Log

> **Audit trail only.** Decisions are captured in CONTEXT.md.

**Date:** 2026-04-23
**Phase:** 01-foundation-polish
**Areas discussed:** Error handling, Console replacement, Auth fixes

---

## Error Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Friendly message + retry | Clear error with retry button, doesn't crash the page | ✓ |
| Silent log | Catch error, log silently, show minimal indicator | |

**User's choice:** Friendly message + retry

---

## Console Replacement

| Option | Description | Selected |
|--------|-------------|----------|
| Everywhere at once | Replace all console.* in production build globally | ✓ |
| File by file | Component by component, use logger utility throughout | |

**User's choice:** Everywhere at once

---

## Auth Fixes

| Option | Description | Selected |
|--------|-------------|----------|
| Queue operations | Queue auth operations, only one runs at a time | ✓ |
| State machine | Explicit states (idle, loading, authenticated, error) | |

**User's choice:** Queue operations

---

## Claude's Discretion

MediaReviewPanel exact split strategy — delegated to planner
Logger utility implementation details — delegated to planner
