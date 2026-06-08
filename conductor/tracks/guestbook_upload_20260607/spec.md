# Track Specification: Enhance Guestbook and Guest Photo Upload Verification Workflow

This specification details the enhancements required for the guestbook signing experience and guest photo uploads, including the moderation queue and metadata sync workflows.

---

## 1. Objective

Refine the guestbook submission and photo upload flow to make it seamless and secure for guests, and provide a secure, cost-effective admin dashboard/moderation pipeline for the couple to approve uploads before they appear in the public gallery.

---

## 2. Requirements

### Guestbook & Photo Upload Flow

- **Sign & Upload:** Guests can leave text messages and attach multiple photos in one session.
- **Drag-and-Drop Uploader:** An elegant UI allowing drag-and-drop file uploading, complete with client-side image compression, loading states, and live previews.
- **Access Control:** The upload interface is publicly open but contains basic spam-prevention checks (e.g., Honeypot fields, rate limiting, and basic validations).

### Moderation Queue (Backend & DB)

- **Pending Queue:** Uploaded photos are stored in a `guest_photos` table with status `pending`.
- **Supabase Storage Bucket:** Photos are uploaded to a `guest-uploads` folder/bucket.
- **Admin Dashboard:** A private admin page displaying all `pending` photos with "Approve" and "Reject" actions.
  - **Approve:** Changes status to `approved`, making the photo visible in the public guest gallery.
  - **Reject:** Changes status to `rejected`, removing the photo from the public queue and marking it for deletion from storage.

### Metadata Syncing & Face Tagging

- **DigiKam Face Tag Integration:** Sync face-tag metadata using `scripts/sync-guest-photo-face-metadata.mjs`.
- **Automation:** Ensure approved guest photos can be exported and indexed under the correct face tags when running the batch processing script.

---

## 3. Technology Stack & Integration

- **Frontend:** React, TypeScript, Tailwind CSS, Framer Motion
- **Backend & DB:** Supabase Database (Postgres), Supabase Storage (Object Storage), Supabase Edge Functions for admin authorization and deletion tasks
- **Testing:** Vitest for component/unit validation, Playwright for end-to-end user flows
