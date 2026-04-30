# Phase 18: Photo Claiming - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Guests can claim photos they uploaded by verifying their email address. No login required — email verification is sufficient. Claiming is automatic if the guest's email matches upload records.

**Specific scope (SC-01 only):**
- "Claim My Photos" entry point on Guest Uploads page
- Guest enters email, system verifies they have uploads
- Both magic link AND one-time code verification options
- Email verification proves ownership
- Photos automatically attributed to claimer via email matching
- Claimed photos appear in "My Photos" collection in gallery

**Out of scope (deferred post-launch):**
- SC-02 (face cluster claiming) — deferred, no face confirmation in this phase
- Any face tagging or People gallery claiming flow
</domain>

<decisions>
## Implementation Decisions

### Claiming Flow (SC-01)
- **D-01:** "Claim My Photos" button on Guest Uploads page
- **D-02:** Guest enters email — system checks if they have uploads
- **D-03:** If guest has uploads: send verification (magic link or code)
- **D-04:** If guest has no uploads: show "No photos found for this email" message
- **D-05:** Email verification sufficient — no login required

### Verification Method
- **D-06:** Support both magic link AND one-time code (guest chooses)
- **D-07:** Magic link: single-use token embedded in URL, instant verification
- **D-08:** One-time code: 6-digit code, guest types on site

### Post-Claim Experience
- **D-09:** Claimed photos automatically attributed to claimer via email matching
- **D-10:** "My Photos" collection in gallery shows claimed uploads
- **D-11:** Photos tagged with uploader email as attribution
- **D-12:** No separate "/my-photos" route — collection embedded in main gallery with filter

### Edge Cases
- **D-13:** Must have uploaded photos to claim — no claiming photos you didn't upload
- **D-14:** Claiming is automatic on verification — guest doesn't need to select specific photos
- **D-15:** Multiple guests can claim same moment (separate uploads, no conflict)
- **D-16:** SC-02 (face claiming) deferred to post-launch — phase focuses on email-only

### Out of Scope (Post-Launch)
- Face cluster confirmation ("Is this you?" prompt) — SC-02 deferred
- People gallery face claiming
- Face tagging integration

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Definition
- `.planning/ROADMAP.md` — Phase 18 goal, requirements (SC-01, SC-02), success criteria
- `.planning/REQUIREMENTS.md` §SC — Social Features requirements detail

### Prior Context
- `.planning/phases/15-activity-feed/15-CONTEXT.md` — Auth patterns, Zustand store approach
- `.planning/phases/17-download-management/17-CONTEXT.md` — Download queue, Zustand patterns
- `.planning/phases/11-design-token-unification/11-CONTEXT.md` — Gold brand color, designTokens

### Existing Code
- `src/stores/authStore.ts` — Supabase auth patterns
- `src/stores/galleryStore.ts` — Gallery filtering, view modes
- `src/lib/supabase.ts` — Supabase client setup

### Database
- `supabase/migrations/` — `guest_uploads` table with email field
- `supabase/migrations/` — Face cluster tables (for future SC-02)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `authStore.ts` — Supabase auth with session management (can extend for claim flow)
- `galleryStore.ts` — Gallery filtering by tags/attributes (for "My Photos" collection filter)
- `downloadStore.ts` — Zustand store with sessionStorage persistence

### Established Patterns
- Email magic link: Supabase auth `MagicLink` pattern
- One-time code: custom verification flow with code storage
- Zustand stores for UI state management
- Framer Motion for animations

### Integration Points
- Guest Uploads page → "Claim My Photos" button
- Gallery page → filter for "My Photos" (uploader email match)
- Supabase Auth → magic link or custom code verification

</code_context>

<specifics>
## Specific Ideas

- "Claim My Photos" button should match gold accent styling (D-06 from Phase 11)
- Email verification page should be simple: enter email → receive code/link → done
- "My Photos" collection appears as a filter option in gallery header
- Progress indicator during verification sending

</specifics>

<deferred>
## Deferred Ideas

### Post-Launch (SC-02)
- Face cluster claiming via "Is this you?" prompt in People gallery
- Face tagging and face cluster linking to guest uploads
- Photo attribution via face recognition

</deferred>

---

*Phase: 18-photo-claiming*
*Context gathered: 2026-04-30*