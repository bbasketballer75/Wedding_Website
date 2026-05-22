# Phase 18: Photo Claiming — Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can claim photos they uploaded or appear in via email or face cluster verification. Once verified (via a polished Magic Link or OTP email verification flow), guests' claims are routed to an admin moderation queue. Upon approval, their guest identity links to their uploaded photos and face clusters, displaying their verified name on tagged photos.

**Specific Scope (SC-01, SC-02):**
- **Entry Points:** A "Claim My Photos" banner on the Guest Uploads page (`/upload`) and an "Is this you?" button in the People gallery (`/people`).
- **Identity Verification:** Dual-mode email verification using Supabase Auth OTP with a beautiful, client-side developer simulation fallback.
- **Database Schema:** Create `guest_identities` and `photo_claims` tables (and supporting indexes/policies).
- **Admin Panel Integration:** Add a "Claims" tab in the Admin panel to review, approve, and reject guest claims.
- **Lightbox Integration:** Render verified guest names on photos in the lightbox info panel.

**Out of Scope:**
- Automatic face recognition (we use the existing `media_review_faces` and Digikam metadata sync).
- Public shared guest galleries (this is Phase 19).

</domain>

<decisions>
## Implementation Decisions

### Claim Entry Points & Modals (SC-01 & SC-02)
- **D-01:** "Claim My Photos" banner styled elegantly with gold borders and a subtle cream background on the Guest Uploads page.
- **D-02:** "Is this you? Claim this face" prompt on the People/Face detail views to claim face clusters.
- **D-03:** Glassmorphic modal overlay for the claim questionnaire, ensuring a highly premium feel.

### Verification Flow (SC-01)
- **D-04:** Email OTP code verification (Supabase Auth OTP).
- **D-05:** Client-side Developer Fallback Simulation Panel so developers can test the claim verification flow fully without needing SMTP setup.
- **D-06:** Show a blurred preview grid of matching photos behind the OTP entry step to encourage completing the claim.

### Database Tables (SC-01 & SC-02)
- **D-07:** `guest_identities` table containing: `id`, `email`, `session_id`, `display_name`, `created_at`.
- **D-08:** `photo_claims` table containing: `id`, `photo_id`, `guest_identity_id` (foreign key), `claimed_at`.
- **D-09:** RLS enabled for new tables, allowing public inserts (claims) and authenticated read/update (admin panel).

### Admin Moderation (SC-02)
- **D-10:** Add a "Claims" tab in the admin panel to show pending claims.
- **D-11:** Auditing: Every approval or rejection is logged in `moderation_audit_log`.

### Visual Formatting & Animations
- **D-12:** Standardized border radius: `rounded-xl`.
- **D-13:** Transitions: 300ms ease-out, micro-interactions 150ms.
- **D-14:** Color accents: HSL gold highlights `#d4af37`.

</decisions>

<canonical_refs>
## Canonical References

### Phase Definition
- `.planning/ROADMAP.md` — Phase 18 goals and success criteria
- `.planning/REQUIREMENTS.md` §SC — Self-service photo claiming details

### Existing Code
- `src/lib/supabase.ts` — Database queries and types
- `src/pages/People.tsx` — Face cluster grid and metadata builder
- `src/pages/Upload.tsx` — Guest uploads page
- `src/pages/admin/Dashboard.tsx` — Admin dashboard where claims tab will integrate

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/supabase.ts` — Existing RPC methods, pagination, and `guest_uploads` query patterns.
- `src/components/ErrorBoundary.tsx` — Error boundary layout for new moderation views.
- `src/tokens/designTokens.ts` — Elegant styles and cream colors.

### Established Patterns
- Supabase client queries with error handling and serialization.
- Framer Motion `AnimatePresence` for smooth modal entry/exit.
- Flowing modular React components separated by concerns.

### Integration Points
- `src/pages/Upload.tsx` — Inserting the elegant "Claim My Photos" card.
- `src/pages/People.tsx` — Integrating the "Is this you?" button inside face tag interactions.
- `src/pages/admin/Dashboard.tsx` — Inserting the Claims tab.
- `src/components/gallery/PhotoLightbox.tsx` — Displaying tagged guest names from claims.

</code_context>

<specifics>
## Specific Ideas
- The developer fallback verification panel should show a mock code in an alert or developer log so it can be verified with a single click.
- Tagged names in lightboxes should be styled in gold italics to look incredibly premium.

</specifics>

<deferred>
## Deferred Ideas
- Interactive public guest profiles (handled in Phase 19).

</deferred>
