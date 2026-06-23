# Phase 3: Upload Experience Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 03-upload-experience
**Areas discussed:** Progress tracking, Error detection

---

## Progress tracking

| Option | Description | Selected |
|--------|-------------|----------|
| XHR with onprogress (Recommended) | Use XMLHttpRequest for R2 PUT — direct progress events, well-supported, matches UI-SPEC spec | ✓ |
| Fetch + ReadableStream | Modern streams approach — more complex, potential edge cases | |
| You decide | Trust implementation to pick best approach | |

**User's choice:** XHR with onprogress (Recommended)
**Notes:** Standard approach for file upload progress, aligns with UI-SPEC requirement

---

## Error detection

| Option | Description | Selected |
|--------|-------------|----------|
| Error enum with type guards (Recommended) | Create typed error enum, detect type at catch, show specific message per UI-SPEC table | ✓ |
| Status code + error message matching | Check HTTP status, parse error message strings, branch on known patterns | |
| You decide | Trust implementation to pick best approach | |

**User's choice:** Error enum with type guards (Recommended)
**Notes:** Clean typed approach aligns with TypeScript best practices

---

## Claude's Discretion

Areas where user deferred to implementation decision:
- Exact XHR wrapper implementation
- Error enum values and type guard signatures
- Progress state management approach (component vs localStorage)

## Deferred Ideas

None — discussion stayed within phase scope.
