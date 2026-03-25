# Skill: Media Batch Workflow and Gallery Operations

## Overview

This skill enables Codex to work with the sophisticated wedding photo processing pipeline, including batch cataloging, face detection, digiKam integration, and gallery curation.

## Media Workflow Architecture

```
Source Photos → Catalog → Analyze → Organize → Optimize → Publish → Gallery
                    ↓
               Face Detection → Review → Export Manifest
                    ↓
               digiKam Integration (optional)
```

## Quick Commands

```bash
# Full workflow in one command
npm run media:batch:prepare -- "<source-root>" "<working-root>"

# Individual stages
npm run media:batch:catalog -- "<source-root>" "<working-root>/catalog"
npm run media:batch:analyze -- "<source-root>" "<working-root>/catalog"
npm run media:batch:faces -- "<source-root>" "<working-root>"
npm run media:batch:organize -- "<source-root>" "<working-root>"
npm run media:batch:optimize -- "<working-root>/organized" "<working-root>/optimized"
npm run media:batch:export -- "<working-root>"
npm run media:batch:publish -- "<working-root>"
npm run media:batch:review:push -- "<working-root>"
```

## Source Folder Conventions

Top-level folders are mapped to gallery collections:

| Folder Pattern | Collection |
|---------------|------------|
| `*MikaylaByersPhotography*` | Professional |
| `Guest-Shared*` | Guest Uploads |
| `Bachelor+ette` | Bach+ette |
| `Engagement` | Engagement |

Other folders land in review/unsorted paths.

## Workflow Stages

### 1. Catalog (`catalog/`)

Creates inventory of all media:

```bash
npm run media:batch:catalog -- "C:/WeddingPhotos" "C:/Working/catalog"
```

**Outputs:**
- `wedding-master-inventory.json` - Base inventory with EXIF data
- `wedding-master-inventory.csv` - Spreadsheet view
- `wedding-master-summary.md` - Human-readable summary

### 2. Analyze (`catalog/`)

Detects duplicates, similar shots, and live photos:

```bash
npm run media:batch:analyze -- "C:/WeddingPhotos" "C:/Working/catalog"
```

**Outputs:**
- `wedding-master-analysis.json` - Duplicate groups, similar shots, live-photo pairs
- `wedding-master-analysis.md` - Readable report
- `wedding-master-inventory.enriched.json` - Inventory with group memberships

**Review:**
- Check duplicate groups (exact copies)
- Review similar-shot groups (pick best)
- Note live-photo pairs (iOS live photos)

### 3. Face Detection (`faces/`)

Detects and clusters faces:

```bash
npm run media:batch:faces -- "C:/WeddingPhotos" "C:/Working"
```

**Outputs:**
- `face-detections.json` - Raw face coordinates
- `face-clusters.json` - Grouped faces by person
- `face-review.json` - **EDIT THIS** to name people
- `face-clusters.md` - Summary
- `crops/<cluster-id>/` - Face thumbnails for review

**Editing `face-review.json`:**

```json
{
  "clusters": [
    {
      "id": "cluster-001",
      "representativeFaceId": "face-001",
      "sampleCount": 45,
      "confirmedName": "Austin Porada",
      "mergeIntoClusterId": null,
      "shouldSplit": false
    }
  ]
}
```

### 4. Organize (`organized/`)

Copies originals into review-friendly structure:

```bash
npm run media:batch:organize -- "C:/WeddingPhotos" "C:/Working"
```

**Structure:**
```
organized/
├── Professional/
│   └── photo-001.jpg
├── Ceremony/
│   └── photo-002.jpg
└── Review/
    └── Exact Duplicates/
        └── photo-003.jpg
```

### 5. Optimize (`optimized/`)

Creates display and thumbnail assets:

```bash
npm run media:batch:optimize -- "C:/Working/organized" "C:/Working/optimized"
```

**Outputs:**
- `.webp` display images (optimized quality)
- `_thumbs/` thumbnail images
- `optimized-manifest.json`

### 6. Export (`publish/`)

Creates import-ready manifest:

```bash
npm run media:batch:export -- "C:/Working"
```

**Outputs:**
- `wedding-photo-import-manifest.json` - Ready for upload
- `wedding-photo-import-manifest.md` - Human-readable

### 7. Publish

Uploads to CDN and syncs to database:

```bash
npm run media:batch:publish -- "C:/Working"
```

**What it does:**
1. Uploads optimized images to Cloudflare R2
2. Inserts rows into Supabase `photos` table
3. Skips `Engagement` category (preserves editorial overlay)
4. Generates publish report

**Outputs:**
- `wedding-photo-publish-report.json`
- `wedding-photo-publish-report.md`

### 8. Review Push

Stages face review artifacts in admin panel:

```bash
npm run media:batch:review:push -- "C:/Working"
```

**What it does:**
- Uploads face crops to private bucket
- Populates admin review tables
- Allows browser-based face confirmation

## digiKam Integration

When digiKam is your face-tagging source of truth:

```bash
# 1-3. Catalog, analyze, organize as normal
npm run media:batch:catalog -- "<source>" "<working>/catalog"
npm run media:batch:analyze -- "<source>" "<working>/catalog"
npm run media:batch:organize -- "<source>" "<working>"

# 4. Open organized/ folder in digiKam
# 5. Enable face tags in Settings → Metadata
# 6. Run Tools → Detect and Recognize Faces
# 7. Confirm names in People view
# 8. Write metadata: Album → Write Metadata to Files

# 9. Import digiKam face tags
npm run media:batch:faces:digikam -- "<working>"

# 10. Continue with optimize, export, publish
npm run media:batch:optimize -- "<working>/organized" "<working>/optimized"
npm run media:batch:export -- "<working>"
npm run media:batch:publish -- "<working>"
```

## Guest Upload Face Tagging Loop

For tagging faces in approved guest photos:

```bash
# Export approved guest photos for tagging
npm run media:guest:tag:export -- "C:/GuestTagging"

# 1. Open organized/ folder in digiKam
# 2. Detect and recognize faces
# 3. Confirm names in People view
# 4. Write metadata to files

# Sync face tags back to live gallery
npm run media:guest:tag:sync -- "C:/GuestTagging"
```

Or use the browser-based flow:
1. Go to `/admin/photos`
2. Use "Guest Face Tagging" panel
3. Download zipped batch
4. Tag in digiKam
5. Upload back in browser
6. Sync runs browser-side

## Gallery Curation

### Collection Tabs

The public gallery has these lanes:
- `All` - Everything
- `Professional` - Photographer photos
- `Guest Uploads` - Guest-submitted photos
- `Engagement` - Proposal/engagement photos
- `Bach+ette` - Bachelor/bachelorette party
- `Wedding Day` - Ceremony and reception

### Source vs Collection

Every photo has:
- `source`: `professional` or `guest` (indicates origin)
- `collection`: The themed lane it appears in

Example: A professional photo can appear in `Engagement` collection.

### Admin Approval Workflow

1. Go to `/admin/photos`
2. Review pending guest uploads
3. Fill curation fields:
   - `caption` - Photo description
   - `category` - Which collection tab
   - `tags` - Search/filter tags
   - `location` - Where taken
4. Approve to publish to gallery
5. Keep `source=guest` for labeling

### Face Review in Admin

1. Run `media:batch:review:push`
2. Go to `/admin/review`
3. Confirm names on face clusters
4. Merge duplicate clusters
5. Request splits for mixed clusters
6. Apply confirmed tags to gallery

## Data Structures

### Photo Row (Supabase)

```typescript
interface Photo {
  id: string
  url: string           // CDN URL
  thumbnail: string     // Thumbnail URL
  caption: string
  category: string      // Collection tab
  location: string
  date: string          // ISO timestamp
  likes: number
  photographer: string
  is_professional: boolean
  tags: string[]
  faces: FaceTag[]      // Face bounding boxes + names
  source: 'professional' | 'guest'
  created_at: string
}

interface FaceTag {
  name: string
  x: number            // Center x (0-1)
  y: number            // Center y (0-1)
  width: number        // Box width (0-1)
  height: number       // Box height (0-1)
}
```

### Import Manifest

```typescript
interface ImportManifest {
  photos: {
    id: string
    sourcePath: string
    optimizedPath: string
    thumbnailPath: string
    metadata: {
      caption: string
      category: string
      date: string
      tags: string[]
      faces: FaceTag[]
    }
  }[]
}
```

## Best Practices

### Workflow Tips

1. **Always review before publishing** - Check `analysis.md` and `face-clusters.md`
2. **Keep engagement separate** - The code has editorial engagement photos; batch publish skips them
3. **Guest uploads stay guest** - Don't change `source` when approving
4. **Face naming is optional** - Unnamed faces won't appear in people filters

### Storage Management

```bash
# Check storage usage
supabase storage list buckets

# Clean up old review artifacts
supabase storage empty media-review-artifacts
```

### Performance

- Optimized images are ~200KB WebP
- Thumbnails are ~20KB WebP
- Face crops are stored in private bucket only
- Lazy loading for gallery images

## Troubleshooting

### Face detection not working

```bash
# Re-run faces stage
npm run media:batch:faces -- "<source>" "<working>"

# Check for model files
ls node_modules/@vladmandic/human/models/
```

### Duplicate detection missed some

- Increase similarity threshold in config
- Manual review in `organized/Review/Exact Duplicates/`

### digiKam tags not importing

1. Verify XMP sidecars exist: `photo.jpg.xmp`
2. Check digiKam wrote face regions, not just tags
3. Re-run `media:batch:faces:digikam`

### Publish failed mid-way

```bash
# Check report for what succeeded
open publish/wedding-photo-publish-report.md

# Re-run to continue (idempotent)
npm run media:batch:publish -- "<working>"
```
