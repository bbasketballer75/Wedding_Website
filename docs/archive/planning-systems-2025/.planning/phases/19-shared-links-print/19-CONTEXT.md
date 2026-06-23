# Phase 19: Shared Links & Print — Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Guests can generate a persistent, unique public showcase album representing their entire contribution footprint (photo/video uploads, guestbook messages, and approved claimed photos) and access a high-end print ordering interface inside the photo lightbox.

**Specific Scope (SC-03, PR-01):**
- **Sharing Generation:** Persistent, unique guest sharing tokens mapped to guest emails, generating cohesive showcase albums.
- **Showcase Landing Page:** Public `/guest/:token` showcase pages rendering a gorgeous chronological photos tab (approved uploads + approved claims) and cursive-styled guestbook messages.
- **Print Ordering Dialog:** Lightbox integration with an "Order Prints" button, triggering a glassmorphic provider selection modal (Shutterfly or Artifact Uprising).
- **Auto-copy & Guide:** Auto-copy of high-resolution photo URLs to the clipboard on print provider click with visual step instructions.
- **Fallback Page:** Friendly, responsive expired/invalid token fallback screen.

**Out of Scope:**
- Directly uploading to print provider via API (as the standard providers do not support direct image URL injection through URL queries).
- Editing contributions from the public showcase route (read-only view).

</domain>

<decisions>
## Implementation Decisions

### Shared Album Links (SC-03)
- **D-01:** Persistent unique token mapping ensures one guest email is mapped to exactly one secure UUID share token.
- **D-02:** Double-source compilation gathers approved uploads matching guest email, approved guestbook messages, and approved claimed photos linked to their verified guest identity.
- **D-03:** Guest privacy safeguard ensures guest emails are never leaked or exposed to the client in the public `/guest/:token` route.
- **D-04:** Upload Success Banner styled elegantly with gold-gradient and a copy button to instantly access the new guest album link.

### Print Redirect & Clipboard Bridge (PR-01)
- **D-05:** "Order Prints" button in the `PhotoLightbox` toolbar.
- **D-06:** Glassmorphic provider selection modal featuring Artifact Uprising (premium matte/wedding albums) and Shutterfly (classic large/canvas prints).
- **D-07:** Clipboard bridge: Automatically copies the photo high-res URL to the clipboard on provider click with a smooth, glassmorphic toast instructing the user to paste it.

### Layout & Animations
- **D-08:** Standardized border radius: `rounded-xl`.
- **D-09:** Transitions: 300ms ease-out, micro-interactions 150ms.
- **D-10:** Color accents: HSL gold highlights `#d4af37`, warm cream backgrounds `#faf8f5`.

</decisions>

<canonical_refs>
## Canonical References

### Phase Definition
- `.planning/ROADMAP.md` — Phase 19 goals and success criteria
- `.planning/REQUIREMENTS.md` §SC-03, §PR-01 — Shared links and print requirements

### Existing Code
- `src/lib/supabase.ts` — DB helpers (already has the database query layer implemented!)
- `src/components/photo-viewer/PhotoLightbox.tsx` — Main photo viewing component where the "Order Prints" button will live
- `src/pages/Upload.tsx` — Page where we will mount the gold share card on upload success
- `src/App.tsx` — Main React App router

</canonical_refs>

<code_context>
## Existing Code Insights

### Database Helpers
- `getOrCreateShareToken(email)` and `fetchGuestContributionsByToken(token)` are already implemented in `src/lib/supabase.ts`.

### Lightbox UI
- `PhotoLightbox` contains actions for download, comments, likes, and swipe gesture controls. We will add `PrintModal` inside it.

### App Routing
- `src/App.tsx` utilizes `lazy` React page loading and dynamic React Router routes.

</code_context>
