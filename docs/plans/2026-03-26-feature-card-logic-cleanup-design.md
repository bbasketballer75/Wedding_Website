# Feature & Card Logic Cleanup — Design Doc

**Date:** 2026-03-26
**Scope:** Film, Gallery, Guestbook, Upload pages
**Goal:** Cut features that add noise, reorganize sections so page flows match how guests actually move through content.

---

## Film (`/film`)

### Problem

- The family tree is embedded _inside_ the hero `editorial-panel`, forcing guests to scroll through it before reaching the video player. The hero becomes oversized and the family tree feels incidental rather than intentional.
- Guest video highlights render _after_ the "After the film / Where to next" CTA, so the intended last step on the page isn't actually last.

### Changes

1. **Extract family tree out of the hero panel into its own section.** The hero keeps only: eyebrow, h1, body copy, and metadata pills. The family tree becomes a standalone section (with its own heading/description) positioned between the hero and the video player — same order in the flow, cleaner presentation.
2. **Move guest highlights above the CTA.** Section order becomes: Hero → Family Tree → Video Player + Chapters → Parent Dances → Guest Highlights → After the Film CTA.

---

## Gallery (`/gallery`)

### Problem

- Two photo count indicators appear simultaneously: "1008 visible" in the header and "24 on screen" in the results section. Both show counts but from different perspectives — this is redundant noise.
- Face recognition ("BROWSE PEOPLE") sits inline next to the masonry/grid toggle in the control bar. These are drastically different levels of action — one is a layout preference, the other is a complex AI feature — and placing them side by side makes the control bar feel busy.

### Changes

1. **Remove the "X on screen" badge** from the results section. Keep only the "X visible" badge in the header.
2. **Demote face recognition** from the inline control bar. Remove the `FaceRecognition` button from the horizontal toolbar row and replace with a lower-prominence text link or small pill below the control bar (e.g. "Browse by person →"). This keeps the feature available without making it visually equivalent to a layout toggle.

---

## Guestbook (`/guestbook`)

### Problem

- Voice and video note types exist in both the composer and the filter tabs, but most guests leave text notes. The extra types add visual complexity to both composing and reading.
- Reactions (emoji responses) and comment threads on each message card turn the guestbook into a lightweight social feed. For a wedding guestbook the tone should be quieter — people read the notes, they don't debate them.
- Filter tabs ("Everything", "Written", "Voice", "Video") become meaningless if everything is text.

### Changes

1. **Cut voice and video from the composer.** The composer only supports text notes. The `messageTypeMeta` and type-selection UI is removed.
2. **Remove the filter tabs entirely.** With only one note type, filtering by type has no value. Remove the "Everything / Written / Voice / Video" tab row.
3. **Strip message cards to: name, date, note.** Remove reactions, comment threads, type badges, and avatar rings. Each card shows who wrote it, when, and what they said — nothing else.

---

## Upload (`/upload`)

### Problem

- The "Pass the site along" share panel appears _above_ the dropzone. The page's primary purpose is uploading guest photos and videos, but the first substantive content after the hero is a site-sharing widget — wrong hierarchy.
- The three `uploadHighlights` info cards ("Private review first", "Large moments welcome", "Contact details kept with the upload") read as filler. They don't help a guest complete the upload; they just add visual bulk before the dropzone.

### Changes

1. **Move "Pass the site along" below the file queue and contact form.** Upload action (dropzone → queue → contact form → submit) comes first. Sharing the site URL is a secondary, optional action that belongs after the primary task is complete.
2. **Remove the three highlight info cards.** Cut `uploadHighlights` and their rendered section entirely. The dropzone itself (with its instruction copy) is sufficient onboarding.

---

## What is not changing

- Visual treatment (dark cinematic on Guestbook/Upload, light cream on Film/Gallery) — unchanged.
- All existing Supabase data fetching and write logic — unchanged.
- The family tree component itself, the video player, photo grid, lightbox, dropzone, file queue, contact form — all unchanged.
- Navigation, header, footer — unchanged.
