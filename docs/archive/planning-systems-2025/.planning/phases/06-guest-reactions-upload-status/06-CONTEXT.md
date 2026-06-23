# Phase 6: Guest Reactions & Upload Status - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Guests can heart guestbook entries with optimistic UI and persistent counts. Upload status confirmation is already in place — the "pending review" success panel exists. Phase delivers: heart reactions with session-based deduplication (no login required).

</domain>

<decisions>
## Implementation Decisions

### Reaction Tracking (GAL-02)
- **D-01:** Anonymous but unique reactions — Guests react without logging in. Use localStorage UUID fingerprint to track who reacted. One reaction per entry per browser session (same approach as upload resume fingerprint in Phase 5).

- **D-02:** Optimistic UI with rollback — Heart count updates immediately when tapped. If the DB update fails, restore previous state. Proper rollback already specified in success criteria.

- **D-03:** Reactions stored as `Record<string, number>` in guestbook_messages.reactions JSON column. Already matches current schema.

### Add Reaction UX (GAL-02)
- **D-04:** Expand picker — Keep the existing picker UX where guests tap "Add a reaction" button, see emoji options (love, clap, laugh, wow), and select one. The picker confirms their choice. Confirmed reactions shown highlighted.

### Upload Status (UPL-02)
- **D-05:** Skip status lookup — Success panel already shows "Your photo is being reviewed." No email-based lookup feature in this phase. Consider future phase if needed.

### Claude's Discretion
- Exact localStorage key naming for reaction fingerprints
- How to visually highlight a guest's own reaction vs other reactions
- Whether to show reaction counts that update without page refresh (Supabase Realtime consideration — future phase)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project
- `.planning/PROJECT.md` — Wedding website overhaul goals
- `.planning/REQUIREMENTS.md` — GAL-02, UPL-02 requirements
- `.planning/ROADMAP.md` — Phase 6 description and success criteria

### Prior Phase Context
- `.planning/phases/01-foundation-polish/01-CONTEXT.md` — Phase 1 decisions (auth queue, error boundaries)
- `.planning/phases/02-gallery-performance/02-CONTEXT.md` — Phase 2 decisions (Zustand for state, sessionStorage caching)
- `.planning/phases/03-upload-experience/03-CONTEXT.md` — Phase 3 decisions (XHR progress tracking, error enum pattern)
- `.planning/phases/04-navigation-design/04-CONTEXT.md` — Phase 4 decisions (gold theme, skeleton screens)
- `.planning/phases/05-social-sharing/05-CONTEXT.md` — Phase 5 decisions (upload resume fingerprint approach)

### Codebase
- `src/pages/Guestbook.tsx` — Existing guestbook page with MessageCard, handleAddReaction function, REACTION_TYPES array
- `src/lib/supabase.ts` — GuestbookMessage type with reactions: Json | null column
- `src/utils/storage.ts` — Safe localStorage utilities (use for fingerprint persistence)
- `src/pages/Upload.tsx` — buildFileFingerprint function as reference for fingerprint approach

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Guestbook.tsx: MessageCard already has reactions display, handleAddReaction function, localReactions state, reactionPicker state
- REACTION_TYPES array: Already defined with love/clap/laugh/wow emojis — reuse for reaction picker
- MessageCard: Already shows reactions as pill badges with count — needs enhancement for per-session highlighting
- reactionPickerForId state: Already manages picker visibility

### Established Patterns
- Optimistic UI updates (from Gallery.tsx lightbox, Upload.tsx progress)
- localStorage fingerprint (buildFileFingerprint in Upload.tsx for upload resume)
- Zustand stores for shared state
- Framer Motion for animations

### Integration Points
- Guestbook.tsx → MessageCard: handleAddReaction prop passed to each card
- localStorage → Guestbook.tsx: Store reaction fingerprint for session deduplication
- supabase → Guestbook.tsx: Update guestbook_messages.reactions JSON column

</code_context>

<specifics>
## Specific Ideas

No specific references from discussion — open to standard approaches for implementation.
</specifics>

<deferred>
## Deferred Ideas

### Upload Status Lookup
- Email-based status lookup was discussed but deferred. Success panel shows "pending review" message. Future phase could add a "Check your status" flow using email lookup against guest_uploads table.

</deferred>

---
*Phase: 06-guest-reactions-upload-status*
*Context gathered: 2026-04-25*
