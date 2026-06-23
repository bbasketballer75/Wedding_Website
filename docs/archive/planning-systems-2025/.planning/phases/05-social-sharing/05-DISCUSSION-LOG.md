# Phase 5: Social Sharing & Upload Resume - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-25
**Phase:** 05-social-sharing
**Areas discussed:** Share Modal + OG Tags, Upload Queue Persistence, Resume Detection & UX

---

## Share Modal + OG Tags

| Option | Description | Selected |
|--------|-------------|----------|
| A — Share URL with photo ID | e.g., `/gallery?shared=abc123` | ✓ |
| B — Deep link per photo | Dedicated URL per photo | |
| C — JS-only dynamic sharing | No URL change, less reliable | |

**User's choice:** A — Share URL with photo ID
**Notes:** Clean URLs, works without JS initially, social sites can scrape the URL and get correct og:image

### OG Tag Detection Approach

| Option | Description | Selected |
|--------|-------------|----------|
| A — Read URL param in GallerySEO | SEOHead reads window.location | ✓ |
| B — Pass through router props | Gallery page passes to GallerySEO | |
| C — Dedicated OG endpoint | /api/og/[photoId] edge function | |

**User's choice:** A — Read URL param in GallerySEO component
**Notes:** Simple, works with existing SEOHead infrastructure

### Social Preview Content

| Option | Description | Selected |
|--------|-------------|----------|
| A — Photo-centric | "Wedding Photo by [Photographer]" | ✓ |
| B — Generic + Photo | "Austin & Jordyn's Wedding" | |
| C — Custom per photo | Use photo captions from DB | |

**User's choice:** A — Photo-centric
**Notes:** Title: "Wedding Photo from Austin & Jordyn's Wedding"; Description includes event type

---

## Upload Queue Persistence

| Option | Description | Selected |
|--------|-------------|----------|
| A — File metadata + fingerprint | Store metadata, match on resume | ✓ |
| B — Full file via IndexedDB | Store blobs in IndexedDB, keys in localStorage | |
| C — Service Worker intercept | SW intercepts and retries failed uploads | |

**User's choice:** A — File metadata + fingerprint only
**Notes:** Avoids localStorage size limits; File objects can't be serialized anyway

---

## Resume Detection & UX

### Where to Show Incomplete Uploads

| Option | Description | Selected |
|--------|-------------|----------|
| A — Show in queue immediately | On page mount, check localStorage, display in queue | ✓ |
| B — Dedicated Resume banner | Dismissible banner, click expands | |
| C — Silent background resume | Auto-attempt, subtle indicator | |

**User's choice:** A — Show in queue immediately
**Notes:** Guest can continue or clear them

### Resume Matching Approach

| Option | Description | Selected |
|--------|-------------|----------|
| A — Auto-match by fingerprint | Match file by fingerprint | ✓ |
| B — Manual re-select + confirm | Show match, guest confirms | |
| C — Fingerprint in filename suggestion | Suggest filename to help guest find file | |

**User's choice:** A — Auto-match by fingerprint
**Notes:** System finds matching file when guest re-selects

### Resume Upload Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| A — Byte-range resume | Continue from last byte, needs Range header support | |
| B — Full restart with dedup | Re-upload whole file, server skips if fingerprint exists | ✓ |
| C — Chunked with tracking | Upload in chunks, track completion per chunk | |

**User's choice:** B — Full restart with deduplication
**Notes:** Simpler, works everywhere, acceptable for wedding site volumes

---

## Claude's Discretion

All implementation details deferred to planning:
- Exact GallerySEO detection and photo metadata fetch
- ShareModal prop wiring from lightbox
- localStorage key naming convention
- Queue UI differentiation for resumed vs new uploads

## Deferred Ideas

None — all discussion stayed within phase scope.
