# Responsive Design Overhaul — Design Doc

**Date:** 2026-03-28
**Approach:** Systematic page-by-page pass (Approach A)

## Goal

Make every page and shared component adapt visually to all viewport sizes and orientations: portrait phone, landscape phone, iPad portrait/landscape, desktop, and ultrawide.

## Problem

The site has a solid mobile foundation (152 responsive class instances, good max-width constraints) but clear gaps:
- No tablet (`md:`) breakpoints on Film, Gallery, Upload — desktop layout forced on iPad
- Gallery photo grid jumps from 1 column directly to 4 with nothing in between
- Film uses a JS `matchMedia` listener to detect portrait orientation and blurs the entire page — aggressive and brittle
- Upload file preview thumbnails hardcoded at `grid-cols-3` (breaks at small sizes)
- Guestbook sidebar only activates at `2xl:` (1536px) — invisible on standard 1280px desktops
- No CSS-native orientation handling anywhere

---

## Breakpoint Model

All pages follow this four-tier model consistently:

| Tier | Tailwind | Width |
|------|----------|-------|
| Mobile portrait (default) | *(base)* | 320–479px |
| Large phone / landscape phone | `sm:` | 480–767px |
| Tablet | `md:` | 768–1023px |
| Tablet landscape / small desktop | `lg:` | 1024–1279px |
| Desktop | `xl:` | 1280–1535px |
| Large desktop | `2xl:` | 1536px+ |

**Max content width:** `max-w-7xl mx-auto` for wide pages (Gallery, Film), `max-w-6xl` for text-heavy pages (Guestbook, Upload). Prevents ultrawide stretching.

**Orientation:** CSS-only via `@media (orientation: landscape)` — no JavaScript media query listeners. Added as a custom Tailwind variant in global CSS.

---

## Per-Page Design

### Home
- Already strong. Small additions: `2xl:` cap on hero text size, ensure section padding and gap scale gracefully at large desktop.

### Film (highest priority)
- **Replace JS portrait overlay** with inline CSS `@media (orientation: portrait) and (max-width: 767px)` nudge — "Rotate for the full experience" hint instead of blurring the whole page
- Film chapters: horizontal scroll strip on mobile → two columns at `md:` → side panel at `xl:`
- Family tree + highlights: single column → two columns at `md:` → side-by-side at `lg:`
- Video player: `aspect-video` preserved, container pads at all sizes

### Gallery
- Control bar (sort/filter/search): stacks vertically on portrait phone → inline at `md:`
- Photo grid: `grid-cols-1` → `sm:grid-cols-2` → `md:grid-cols-3` → `lg:grid-cols-4`
- Lightbox: full-screen on portrait phone; info panel at `lg:`; landscape phone fills viewport width, minimal chrome

### Guestbook
- Featured note card: full width on mobile, `max-w-2xl` at `md:`
- Feed grid: 1 col → `xl:grid-cols-2` (currently `2xl:grid-cols-2`)
- Sidebar: activate at `xl:` instead of `2xl:`

### Upload
- File preview thumbnails: `grid-cols-2 sm:grid-cols-3 md:grid-cols-4` (currently hardcoded `grid-cols-3`)
- Share panel sidebar: expose at `xl:`, stack below form on tablet/mobile

### Header
- Improve horizontal scroll UX on mobile: add `-webkit-overflow-scrolling: touch` and visible scroll indicators
- Nav link gap/padding: tighten at base, expand at `sm:`

### Footer
- 3-card grid: `grid-cols-1 sm:grid-cols-3` (currently squishes on small phones)

---

## Shared Components

### PhotoLightbox
- Portrait phone: full-screen image, info panel collapsed/scrollable below
- Landscape phone: image fills width, minimal info chrome
- Desktop: two-column layout (image + panel)

---

## Testing Targets

Every page verified at:
- 390×844 — iPhone 15 portrait
- 844×390 — iPhone 15 landscape
- 768×1024 — iPad portrait
- 1024×768 — iPad landscape
- 1440×900 — standard desktop
- 1920×1080 — large desktop

---

## Out of Scope
- New layout wrapper components (changes stay as Tailwind class edits)
- Hamburger menu (4 nav items works fine with improved scroll UX)
- 3XL / ultrawide beyond `2xl:` (no content stretching issues beyond 1536px with max-width constraints)
- Admin pages (internal tool, not guest-facing)
