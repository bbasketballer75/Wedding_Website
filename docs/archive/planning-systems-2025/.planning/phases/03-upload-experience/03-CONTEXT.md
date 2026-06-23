# Phase 3: Upload Experience Polish - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Upload experience gives guests visible progress feedback, specific error messages with recovery options, and clear confirmation after submitting. Phase delivers: determinate progress bar with percentage, differentiated error types with retry, and verified success panel.

</domain>

<spec_lock>
## Requirements (locked via 03-UI-SPEC.md)

**3 requirements are locked.** See `03-UI-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `03-UI-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC):**
- Replace indeterminate shimmer bar with determinate progress bar showing percentage
- Differentiate error types (network timeout, file too large, upload slot, R2 failure, unknown) with specific messages
- Success panel already implemented and verified against design system

**Out of scope (from SPEC):**
- Upload queue persistence to localStorage (deferred to ADV-02)
- Guest upload status notifications (deferred to ADV-03)
- Bulk upload / resume capability

</spec_lock>

<decisions>
## Implementation Decisions

### Progress Tracking (UPLOAD-01)
- **D-01:** Use XMLHttpRequest with `xhr.upload.onprogress` — Native progress events, well-supported, matches UI-SPEC spec

### Error Detection (UPLOAD-02)
- **D-02:** Error enum with type guards — Create typed error enum, detect error type at catch block, show specific message per UI-SPEC error differentiation table

### Claude's Discretion
- Exact XHR wrapper implementation (can reuse existing uploadFileToR2 structure)
- Error enum values and type guard function signatures
- Whether to extract progress state into component state or localStorage

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project
- `.planning/PROJECT.md` — Wedding website overhaul goals
- `.planning/REQUIREMENTS.md` — UPLOAD-01, UPLOAD-02, UPLOAD-03 requirements
- `.planning/ROADMAP.md` — Phase 3 description and success criteria

### Prior Phase Context
- `.planning/phases/01-foundation-polish/01-CONTEXT.md` — Phase 1 decisions (auth queue pattern, error boundaries)
- `.planning/phases/02-gallery-performance/02-CONTEXT.md` — Phase 2 decisions (Zustand for state, sessionStorage caching)

### Phase Specs
- `.planning/phases/03-upload-experience/03-UI-SPEC.md` — **Locked requirements** (MUST read)

### Codebase
- `src/pages/Upload.tsx` — Existing upload component to modify (replace shimmer, add error differentiation)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Upload.tsx: All upload logic in one component — progress bar, queue display, error states, success panel
- UploadingFile interface: {id, file, status, preview, publicUrl, errorMessage} — status already tracks uploading/complete/error
- retryUpload function: Already wired, just needs error type to be specific

### Established Patterns
- Framer Motion for animations (existing in component)
- Component-local state with useState (files, name, email, message, etc.)
- fetch-based R2 upload with presigned URL from Netlify function

### Integration Points
- `uploadFileToR2` function (line 116): Where progress tracking needs to be added
- Error catch block (line 169): Where error type detection needs to be added
- Upload queue UI (lines 595-695): Where shimmer → determinate bar replacement happens

</code_context>

<specifics>
## Specific Ideas

No specific references from discussion — open to standard approaches for implementation.
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.
</deferred>

---
*Phase: 03-upload-experience*
*Context gathered: 2026-04-24*
