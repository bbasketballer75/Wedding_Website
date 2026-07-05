# Guestbook & Share Pages — Cinematic Overhaul Design

## Overview

Revamp both the Guestbook (`/guestbook`) and Share/Upload (`/upload`) pages to feel cinematic, premium, and intentional — matching the dark aesthetic of the timeline film card and footer. The pages currently feel generic and overcomplicated visually; the goal is to keep all existing functionality while making the presentation elegant.

## Design Direction

**Chosen approach: Dark background with glass panels (Approach B)**

- Full dark canvas: `bg-[linear-gradient(to_b,rgba(12,8,5,1),rgba(22,14,6,1))]`
- Subtle gold atmosphere glows (non-interactive `blur-3xl` orbs)
- All interactive panels: `bg-white/6 backdrop-blur-md border border-gold-200/15 rounded-2xl`
- Typography: display font for headlines, `text-white` body, `text-white/55` secondary

---

## Guestbook Page (`/guestbook`)

### Hero

- `BookHeart` icon in a small glass badge with gold tint
- Large display-font headline: e.g. "Leave a note."
- One-line subtext in `text-white/55`

### Composer Panel

- Single glass card (no tab switching — text-only)
- Fields: name input, message textarea
- Send button full-width at bottom of card
- Framer Motion fade-in on mount

### Message Feed

- Each message is a glass card:
  - Avatar: gold-ringed initial circle
  - Name + date in small caps (`text-[11px] uppercase tracking-[0.2em]`)
  - Message body in `text-white/80`
  - Reaction row (existing emoji reactions, styled with gold/warm accents)
  - Expandable comment thread (existing, styled to match)
- Cards animate in on scroll (`useInView` / `whileInView`)
- "Load more" button at bottom if more than initial visible count

---

## Share / Upload Page (`/upload`)

### Hero

- `Upload` icon in glass badge
- Headline: e.g. "Share your photos."
- One-line subtext

### Upload Zone Panel

- Large glass card with dashed gold border dropzone
- Drag-and-drop target with hover state (border brightens, subtle glow)
- File thumbnail previews below dropzone (existing grid layout)
- Clear file removal (×) per thumbnail

### Form Panel

- Second glass card below upload zone
- Fields: Name, Email, Message (optional)
- Submit button full-width

### Social Share

- Compact row of icon-only buttons below a thin gold divider (`via-gold-300/40`)
- Copy link, Facebook, Twitter/X — no labels needed, just icons in glass circles

---

## Shared Tokens

| Element         | Value                                                               |
| --------------- | ------------------------------------------------------------------- |
| Page background | `bg-[linear-gradient(to_b,rgba(12,8,5,1),rgba(22,14,6,1))]`         |
| Glass panel     | `bg-white/6 backdrop-blur-md border border-gold-200/15 rounded-2xl` |
| Primary text    | `text-white`                                                        |
| Secondary text  | `text-white/55`                                                     |
| Gold accent     | `text-gold-400` / `border-gold-300/40`                              |
| Avatar ring     | `ring-2 ring-gold-400/40`                                           |

---

## Out of Scope

- No new backend changes
- No new message types (voice/video recording UI stays removed)
- No routing changes
