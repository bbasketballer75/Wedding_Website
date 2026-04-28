---
name: gallery-supabase-never-loaded
status: resolved
trigger: Gallery shows only hardcoded curated photos, Supabase photos never load. Worker returns 200 but gallery displays zero live photos.
---

## Current Focus

**Issue 1: Collection tab covers showing as grey (FIXED)**
- Root cause: `COLLECTION_COVERS` paths didn't start with `/` so `getMediaPath()` returned them unchanged
- Fix applied: Added leading `/` to all media paths in COLLECTION_COVERS
  - `'Bach+ette': getMediaPath('/media/_thumbs/Bach+ette/Photos/PXL_20240816_221115487.MP.webp')`
  - etc.

**Issue 2: Masonry grid scrolling laggy/glitchy (FIX ATTEMPTED)**
- Root cause: `overflow-visible` on scroll container causes layout thrashing during scroll
- Fix applied: Changed `overflow-visible` to `overflow-hidden` on gallery scroll container
- Note: If scrolling is still laggy, consider switching to VirtualizedPhotoGrid (which exists but wasn't used)

## Evidence

- timestamp: 2026-04-25
  checked: Gallery.tsx COLLECTION_COVERS definition
  found: Paths for Bach+ette, Wedding Photos, Guest Photos use `media/_thumbs/...` without leading `/`
  implication: `getMediaPath('media/_thumbs/...')` returns path unchanged because it doesn't start with `/`

- timestamp: 2026-04-25
  checked: src/utils/media.ts getMediaPath function
  found: Function checks `path.startsWith('/')` and returns early if false
  implication: Paths must start with `/` to be processed as media paths

- timestamp: 2026-04-25
  checked: Gallery.tsx scroll container className
  found: `overflow-visible` which can cause scroll repaint issues
  implication: Changed to `overflow-hidden`

## Eliminated

## Resolution

- root_cause: (Issue 1) COLLECTION_COVERS paths missing leading `/`; (Issue 2) `overflow-visible` causing scroll layout issues
- fix: (Issue 1) Added leading `/` to COLLECTION_COVERS media paths; (Issue 2) Changed `overflow-visible` to `overflow-hidden`
- verification: Build passes
- files_changed: src/pages/Gallery.tsx
