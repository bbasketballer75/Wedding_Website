# Technology Stack

This document records the technology stack used by the Post-Wedding Archive website.

---

## 💻 Core Technologies

- **Programming Languages:**
  - **TypeScript:** Used for type safety, robust frontend development, and type-safe backend integrations.
  - **JavaScript:** Used for scripts, utility tasks, and configuration files.

- **Frontend Framework & Tooling:**
  - **React:** Used for building component-based, interactive user interfaces.
  - **Vite:** Used as the modern build tool and development server.

- **Backend & Database:**
  - **Supabase:** Serves as the Backend-as-a-Service (BaaS) provider.
    - **PostgreSQL:** Relational database for structured data (guestbook entries, metadata, etc.).
    - **Storage:** Bucket storage for user-uploaded and archive media files.
    - **Auth:** Managed user authentication for couple administration or guest access.
    - **Edge Functions:** Serverless TypeScript functions for server-side APIs and integrations.

---

## 🎨 Styling & Animation

- **CSS / Tailwind CSS:**
  - Vanilla CSS custom design tokens for theme styling.
  - Tailwind CSS (`@tailwindcss/vite` integration) for utility classes.
- **Framer Motion / Anime.js:** Used for fluid animations, transitions, and interface micro-interactions.

---

## 🧪 Testing & Quality Assurance

- **Vitest:** Core unit and component test runner.
- **Playwright:** End-to-end (E2E) testing framework for SEO, page flows, and visual regression tests.
