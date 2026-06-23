# Phase 6: Guest Reactions & Upload Status - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-25
**Phase:** 06-guest-reactions-upload-status
**Areas discussed:** Reaction tracking approach, upload status lookup, add reaction UX

---

## Reaction Tracking Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Per-guest reaction tracking (logged in users) | Reactions persist to DB per guest, track who reacted | |
| Anonymous but unique (one heart per entry) | Anyone can react, but only once per entry | ✓ |
| Session-based (localStorage fingerprint) | Like Phase 5's upload resume — fingerprint-based deduplication | |

**User's choice:** Anonymous but unique (one heart per entry)
**Notes:** User specified: "I don't want people to have to log in." Recommended option 2 or 3. Chose option 2 (anonymous but unique) which uses localStorage UUID fingerprint per browser to prevent duplicate hearts per entry.

---

## Upload Status Lookup

| Option | Description | Selected |
|--------|-------------|----------|
| Email-based lookup modal | Modal triggered from 'Check your status' link on upload success. Uses email as lookup key. | |
| Skip status lookup | Simplest: keep success panel as-is, no lookup feature. Deferred idea. | ✓ |

**User's choice:** Skip status lookup
**Notes:** Success panel already shows "Your photo is being reviewed" message. User chose to skip email-based lookup feature.

---

## Add Reaction UX

| Option | Description | Selected |
|--------|-------------|----------|
| Expand picker | Same experience as now. Click smiley, picker appears, select emoji. Confirmed guests see their reaction highlighted. | ✓ |
| Direct heart button | Instant single-tap heart. No picker. Simpler but less expressive. | |

**User's choice:** Expand picker (recommended)
**Notes:** Keep existing picker UX where guests tap "Add a reaction" button, see emoji options (love, clap, laugh, wow), and select one.

---

## Deferred Ideas

- **Upload status lookup** — Email-based status lookup feature was discussed but deferred to future phase. Success panel already shows "pending review" message.
