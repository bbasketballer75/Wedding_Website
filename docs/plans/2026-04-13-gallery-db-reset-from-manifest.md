# Gallery DB Reset from Manifest — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the 542 stale rows in the `photos` table with all 1,414 manifest records so every gallery collection tab shows the correct photos with proper album grouping, tags, faces, and sort order.

**Architecture:** A single standalone Node.js script reads the enriched working manifest, deletes all existing `photos` rows, then inserts fresh rows mapped from each manifest entry's `photoRowDraft`. Engagement entries are skipped because those photos are hardcoded as curated proposal photos in the UI. Media files are already in storage — no uploads needed.

**Tech Stack:** Node.js ESM, `@supabase/supabase-js`, `dotenv`, existing `scripts/photo-batch-utils.mjs` helpers

---

### Task 1: Write `scripts/reset-photos-from-manifest.mjs`

**Files:**
- Create: `scripts/reset-photos-from-manifest.mjs`

**Step 1: Create the script**

```js
import 'dotenv/config'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import {
  inferCanonicalAlbum,
  readJson,
  toSiteMediaPath,
} from './photo-batch-utils.mjs'

const PROJECT_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const workingRoot = process.argv[2]
const dryRun = process.argv.includes('--dry-run')

if (!workingRoot) {
  console.error('Usage: node scripts/reset-photos-from-manifest.mjs <working-root> [--dry-run]')
  process.exit(1)
}

if (!PROJECT_URL) throw new Error('Missing VITE_SUPABASE_URL')
if (!SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function normalizeDateValue(value) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString()
}

function chunk(items, size) {
  const chunks = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

async function main() {
  const manifestPath = path.join(
    path.resolve(workingRoot),
    'publish',
    'wedding-photo-import-manifest.json',
  )
  const manifest = await readJson(manifestPath)

  // Build rows, skipping Engagement entries
  const sortCounters = Object.create(null)
  const rows = []

  for (const entry of manifest) {
    const topLevelFolder = String(entry.sourceRelativePath || '').split('/')[0] || ''
    const album = inferCanonicalAlbum(topLevelFolder, entry.sourceRelativePath ?? '')

    if (album === 'Engagement') continue

    sortCounters[album] = (sortCounters[album] || 0) + 1
    const albumSortOrder = sortCounters[album]
    const draft = entry.photoRowDraft

    rows.push({
      url: toSiteMediaPath(draft.url),
      thumbnail: toSiteMediaPath(draft.thumbnail),
      download_url: toSiteMediaPath(draft.download_url ?? draft.url),
      caption: draft.caption ?? null,
      album,
      category: album,
      location: draft.location ?? null,
      date: normalizeDateValue(draft.date),
      photographer: draft.photographer ?? null,
      is_professional: Boolean(draft.is_professional),
      tags: draft.tags ?? [],
      faces: draft.faces ?? [],
      album_sort_order: albumSortOrder,
      likes: 0,
    })
  }

  // Print summary
  const countsByAlbum = rows.reduce((acc, row) => {
    acc[row.album] = (acc[row.album] || 0) + 1
    return acc
  }, {})
  console.log(`Manifest rows: ${manifest.length}`)
  console.log(`Publishable rows (Engagement excluded): ${rows.length}`)
  for (const [album, count] of Object.entries(countsByAlbum)) {
    console.log(`  ${album}: ${count}`)
  }

  if (dryRun) {
    console.log('\n--dry-run: no DB changes made')
    console.log('Sample row (first):', JSON.stringify(rows[0], null, 2))
    return
  }

  // Delete all existing rows
  console.log('\nDeleting all existing photo rows...')
  const { error: deleteError } = await supabase
    .from('photos')
    .delete()
    .not('id', 'is', null)

  if (deleteError) throw deleteError
  console.log('All existing rows deleted.')

  // Insert in batches of 100
  console.log(`Inserting ${rows.length} rows in batches of 100...`)
  let inserted = 0

  for (const batch of chunk(rows, 100)) {
    const { error } = await supabase.from('photos').insert(batch)
    if (error) throw error
    inserted += batch.length
    process.stdout.write(`\r  ${inserted}/${rows.length}`)
  }

  console.log(`\nDone. Inserted ${inserted} rows.`)
}

await main()
```

**Step 2: Commit the script**

```bash
git add scripts/reset-photos-from-manifest.mjs
git commit -m "feat(scripts): add reset-photos-from-manifest script"
```

---

### Task 2: Dry run — verify mapping before touching the DB

**Files:**
- Run: `scripts/reset-photos-from-manifest.mjs`

**Step 1: Run the dry run**

```bash
node scripts/reset-photos-from-manifest.mjs \
  "C:/Users/bbask/Pictures/Wedding Master - Enriched Working" \
  --dry-run
```

**Step 2: Verify the output matches expected counts**

Expected output:
```
Manifest rows: 1414
Publishable rows (Engagement excluded): 1414
  Bach+ette: 508
  Wedding Day: 577
  Guest Uploads: 329

--dry-run: no DB changes made
Sample row (first): {
  "url": "/media/Bach+ette/Photos/000001.webp",
  "thumbnail": "/media/_thumbs/Bach+ette/Photos/000001.webp",
  ...
  "album": "Bach+ette",
  "category": "Bach+ette",
  "tags": ["bach+ette", "Bach+ette", "bach-ette"],
  "album_sort_order": 1,
  ...
}
```

If counts don't match, check that `inferCanonicalAlbum` resolves correctly for each source folder. The manifest has no Engagement entries, so the publishable count should equal the manifest count (1414).

If the `url` in the sample row doesn't start with `/media/`, check the `toSiteMediaPath` import from `photo-batch-utils.mjs` — it should prefix with `/media`.

---

### Task 3: Execute the reset

**Step 1: Run without `--dry-run`**

```bash
node scripts/reset-photos-from-manifest.mjs \
  "C:/Users/bbask/Pictures/Wedding Master - Enriched Working"
```

Expected output:
```
Manifest rows: 1414
Publishable rows (Engagement excluded): 1414
  Bach+ette: 508
  Wedding Day: 577
  Guest Uploads: 329

Deleting all existing photo rows...
All existing rows deleted.
Inserting 1414 rows in batches of 100...
  1414/1414
Done. Inserted 1414 rows.
```

**Step 2: Verify the DB via Supabase MCP**

Run this SQL via the Supabase MCP (project `qrupgckiykxkzyeifftd`):

```sql
SELECT album, COUNT(*) as count,
  COUNT(CASE WHEN array_length(tags, 1) > 0 THEN 1 END) as has_tags,
  COUNT(CASE WHEN jsonb_array_length(faces) > 0 THEN 1 END) as has_faces,
  MIN(album_sort_order) as min_sort,
  MAX(album_sort_order) as max_sort
FROM photos
GROUP BY album
ORDER BY album;
```

Expected result:
```
album          | count | has_tags | has_faces | min_sort | max_sort
Bach+ette      |   508 |      508 |         ? |        1 |      508
Guest Uploads  |   329 |      329 |         ? |        1 |      329
Wedding Day    |   577 |      577 |         ? |        1 |      577
```

(has_faces will vary — not all photos have recognized faces.)

**Step 3: Commit**

No code changes in this task — commit a note in the plan if anything needed adjusting, otherwise just note it's done.
