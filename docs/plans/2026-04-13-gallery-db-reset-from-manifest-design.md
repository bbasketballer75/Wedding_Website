# Gallery DB Reset from Manifest — Design

## Goal

Replace the 542 stale rows in the `photos` table with the 1,414 correctly-structured
records from the enriched working manifest, so all four gallery collection tabs
(Proposal/curated, Bach+ette, Wedding Photos, Guest Photos) display the right photos
with correct album grouping, tags, faces, and sort order.

## Context

- The existing 542 DB rows use old album/category naming (`wedding-photos`, `proposal`)
  and have empty tags, faces, and `album_sort_order = 0`.
- The manifest (`publish/wedding-photo-import-manifest.json`) contains 1,414 entries
  covering Bach+ette (508), Wedding Day/professional (577), and Guest Uploads (329).
- Media files are already uploaded to the `wedding-media` bucket from a prior publish run.
- Proposal/engagement photos stay hardcoded as `curatedPhotos` in `Gallery.tsx`; they must
  NOT be inserted into the DB to avoid duplicates.

## Approach

New standalone script: `scripts/reset-photos-from-manifest.mjs`

1. **Delete** all existing rows from `photos`.
2. **Filter** manifest entries — skip any whose `inferCanonicalAlbum()` resolves to `'Engagement'`.
3. **Assign `album_sort_order`** per album, sequential starting at 1, in manifest order.
4. **Insert** all remaining rows in batches of 100.

No file uploads. Imports utilities from `scripts/photo-batch-utils.mjs`.

## Row Mapping

| DB column          | Source                                            |
| ------------------ | ------------------------------------------------- |
| `url`              | `toSiteMediaPath(photoRowDraft.url)`              |
| `thumbnail`        | `toSiteMediaPath(photoRowDraft.thumbnail)`        |
| `download_url`     | same as `url`                                     |
| `album`            | `inferCanonicalAlbum(topLevelFolder, sourcePath)` |
| `category`         | same as `album`                                   |
| `tags`             | `photoRowDraft.tags`                              |
| `faces`            | `photoRowDraft.faces`                             |
| `album_sort_order` | sequential per album, 1-based, manifest order     |
| `is_professional`  | `photoRowDraft.is_professional`                   |
| `date`             | `photoRowDraft.date` (ISO string)                 |
| `caption`          | `photoRowDraft.caption`                           |
| `location`         | `photoRowDraft.location`                          |
| `photographer`     | `photoRowDraft.photographer`                      |
| `likes`            | `0`                                               |

## Usage

```
node scripts/reset-photos-from-manifest.mjs \
  "C:/Users/bbask/Pictures/Wedding Master - Enriched Working"
```

Requires `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`.

## Expected Result

| Collection tab | Expected rows |
| -------------- | ------------- |
| Proposal       | 0 (hardcoded) |
| Bach+ette      | 508           |
| Wedding Photos | 577           |
| Guest Photos   | 329           |
| **Total**      | **1,414**     |

## Out of Scope

- File uploads (already done)
- Changes to `Gallery.tsx` or `deriveCollection()` — the existing mapping already handles
  `Bach+ette`, `Wedding Day`, and `Guest Uploads` album values correctly
