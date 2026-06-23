# Phase 18: Photo Claiming — Discussion Log

This log captures the reasoning and alignment around the implementation details of the Photo Claiming feature (SC-01 and SC-02).

## Grey Areas & Proposals

### Area 1: Claim Entry Points and Verification Flow (SC-01)
- **Question 1.1:** Where should the "Claim My Photos" entry point be located?
  - *Recommended:* A highly polished, gold-accented call-to-action button or banner on the Guest Uploads page (`/upload`), plus a general menu option or gallery header item.
  - *Decided:* Add a prominent "Claim My Photos" banner/card on the `Upload.tsx` page and a "Claim Photos" button on the `People.tsx` header.
- **Question 1.2:** How will email identity verification work?
  - *Recommended:* A seamless hybrid verification. The guest enters their email, and the system queries `guest_uploads`. If matches exist, the guest receives a 6-digit OTP code (Supabase Auth OTP/Magic Link) to verify their email. To ensure flawless local testing and developer velocity, we will implement a dual-mode verification: a live Supabase Auth flow with a beautiful developer fallback simulation panel when Supabase configuration is missing.
  - *Decided:* Dual-mode (Supabase Auth OTP + Dev Sandbox fallback simulation).
- **Question 1.3:** What occurs immediately after a guest enters their email during the claim flow?
  - *Recommended:* The UI displays a card-based grid of "Pending & Mapped Uploads" with a glassmorphic blurred overlay, showing the user exactly what they will be claiming once verified.
  - *Decided:* Show the blurred preview grid with an OTP input card floating on top.

### Area 2: Face Cluster Claiming in People Gallery (SC-02)
- **Question 2.1:** How does a user initiate a claim for a face cluster?
  - *Recommended:* When viewing the People page (`/people`), a general "Claim My Face" button is available in the header. Additionally, clicking into any face cluster detail page or hovering a card will show a clean, gold "Is this you? Claim these photos" prompt.
  - *Decided:* Add an elegant modal trigger "Is this you? Claim this face cluster" on individual person detail layouts.
- **Question 2.2:** How do face cluster claims integrate with guest identities?
  - *Recommended:* When a user claims a face cluster, they enter their name and verified email. This inserts a record into a new `photo_claims` table, which maps the `guest_identity_id` to either the face cluster name (`confirmed_name` in `media_review_faces`) or specific `photo_id`s containing that face.
  - *Decided:* Map `guest_identities` to `media_review_faces` (via `confirmed_name`) and record specific photo mappings in `photo_claims`.

### Area 3: Admin Moderation Panel Integration (SC-01 & SC-02)
- **Question 3.1:** Where do admins moderate claim requests?
  - *Recommended:* Add a dedicated "Claims Moderation" tab to the existing Admin dashboard (`src/pages/admin/Dashboard.tsx` or as a subcomponent), showing guest name, email, claimed face cluster / photo count, and Approve/Reject buttons.
  - *Decided:* Add a highly styled "Claims" tab in the Admin panel.
- **Question 3.2:** What are the downstream effects of approving a claim?
  - *Recommended:* 
    1. The face cluster name in `media_review_faces` is marked as confirmed and associated with the guest's email.
    2. A new relationship is established, rendering a public `/guest/:token` shareable URL (enabling Phase 19).
    3. Mapped guest names display as interactive, gold-accented badges in the Photo Lightbox metadata panel (e.g., "Tagged: Jordyn Porada, Sarah Mike").
  - *Decided:* Auto-update face tag associations, sync verified guest name across lightboxes, and log the action in `moderation_audit_log`.

---

*Date: 2026-05-21*
*Status: Captured autonomously via Smart Discuss*
