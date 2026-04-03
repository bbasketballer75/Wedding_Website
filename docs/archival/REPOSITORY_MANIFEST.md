# Repository Manifest - The Poradas Wedding Archive

This document serves as a high-level map of the Austin & Jordyn Wedding Website repository, now transitioned into its final archival state.

## 📁 Repository Structure

| Directory | Purpose | Key Contents |
| :--- | :--- | :--- |
| `docs/archival/` | **Central Archive Hub** | All maintenance, setup, and historical docs. |
| `src/` | **Application Source** | React components and functional logic. |
| `src/data/` | **Archival Content** | Static data for engagement and wedding stories. |
| `supabase/` | **Backend Infrastructure** | Database schema, migrations, and edge functions. |
| `e2e/`, `tests/` | **Verification Suite** | Playwright and Vitest configuration. |
| `scripts/` | **Utility Scripts** | Tools for media processing and data maintenance. |

## 📖 Essential Documentation Index

All documents are located in `docs/archival/`:

- **[PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md)**: The technical blueprint and feature summary.
- **[SETUP_COMPLETE.md](./SETUP_COMPLETE.md)**: Instructions for local development and archival access.
- **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)**: Configuration details for the backend database and media buckets.
- **[GALLERY_OPERATIONS.md](./GALLERY_OPERATIONS.md)**: How to manage photos, face-tagging, and batch uploads.
- **[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)**: Guide for redeploying the archive to Netlify.
- **[SECURITY.md](./SECURITY.md)**: Security protocols and data protection details.

## 🎞️ Core Archival Assets

- **The Wedding Film**: Managed via `VideoSection.tsx`, using assets from the `guest-videos` bucket.
- **Curated Gallery**: Curated collections defined in `Gallery.tsx` and `PhotoGrid.tsx`.
- **Guestbook**: Persistent user-generated content stored in the `guest_messages` table.

---

---

*Created April 2026 for the permanent digital preservation of our celebration.*
