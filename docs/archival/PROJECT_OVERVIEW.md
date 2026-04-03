# Project Overview: Austin & Jordyn's Wedding Archive

This document provides a comprehensive overview of the technical architecture, key features, and development workflows for the Austin & Jordyn Wedding Website.

## 🏗️ Technical Architecture

The application is a modern **Single Page Application (SPA)** built with React and Vite. It is designed for high performance, visual richness, and interactive engagement.

### Frontend
- **Frontend**: React (TypeScript), Vite
- **Build Tool**: Vite (Extremely fast HMR and optimized production builds).
- **State Management**: React Hooks (useState, useEffect, useContext) and custom service-based data fetching.
- **Styling**: Vanilla CSS (CSS3) using custom design tokens for typography, colors, and layout. No heavy CSS frameworks are used to ensure maximum control and minimal bundle size.
- **Animations**:
    - **Framer Motion**: Used for page transitions, element-level animations, and complex layout changes.
    - **Anime.js**: Used for specialized animations like the Halloween effects and SVG path manipulation.

### Backend & Infrastructure
- **Hosting**: Netlify (Global CDN, automated deployments from Git).
- **Edge Functions**: Used for dynamic OpenGraph metadata generation to support rich link previews on social platforms without requiring a full SSR setup.
- **Database**: Supabase (PostgreSQL) – stores guestbook entries, photo metadata, and administrative configurations.
- **Authentication**: Supabase Auth (Email/Password) – secures the admin dashboard.
- **Storage**: Supabase Storage – hosts thousands of wedding photos and videos across multiple buckets (Gallery, Guest Uploads, Assets).

## ✨ Key Features

### 1. Interactive Engagement Story
A visually immersive section telling the story of our proposal and engagement, featuring:
- **SVG Animations**: Custom-drawn, dynamic spider webs and fog effects for a "Halloween" theme.
- **Polaroid Gallery**: Draggable, interactive polaroid photos.
- **Audio Integration**: Context-aware ambient sounds with smooth fade logic.

### 2. Comprehensive Wedding Gallery
A high-performance media browser with advanced features:
- **Face-Driven Browsing**: Guests can filter photos by specific people using tags.
- **Auto-Sync Workflow**: Integration with **digiKam** for offline face-tagging, synced to Supabase via custom scripts.
- **Guest Uploads**: A dedicated portal for guests to submit their own memories from the big day.

### 3. Digital Guestbook
A real-time communication hub where friends and family can leave messages:
- **Moderation Queue**: Admin panel to review and approve messages before they go live.
- **Optimistic Updates**: Smooth UX for message submission.

### 4. Interactive Guest Map
A Leaflet-based map showing the locations of our celebration and where our guests traveled from.

## 🛠️ Development & Deployment

### Local Development
Follow the steps in [SETUP_COMPLETE.md](./SETUP_COMPLETE.md) to start the local dev server and connect to the Supabase environment.

### Deployment Workflow
Deploys are automated via **Netlify Git integration**. Merging to `main` triggers a production build and deployment.
See [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) for pre-deployment steps.

### Media Workflow
Managing thousands of high-resolution photos and 4K videos requires a disciplined workflow:
1. **Import**: Pull photos into local storage.
2. **Tagging**: Use digiKam for face recognition and person tagging.
3. **Sync**: Use `scripts/sync-people.js` to upload tags and photo metadata to Supabase.
4. **Optimization**: Videos are optimized and hosted via Cloudinary/Supabase Storage.

## 🔒 Security & Privacy
The site uses **Content Security Policy (CSP)** and other standard security headers to protect users. Administrative routes are protected by Supabase Auth and RLS (Row Level Security) policies.

---
*Last updated: April 3, 2026*
