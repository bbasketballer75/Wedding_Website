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
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
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

  const sortCounters = Object.create(null)
  const rows = []

  for (const entry of manifest) {
    const topLevelFolder = String(entry.sourceRelativePath || '').split('/')[0] || ''
    const album = inferCanonicalAlbum(topLevelFolder, entry.sourceRelativePath ?? '')

    if (!album) {
      console.warn(`  Skipping entry with unrecognized album: ${entry.sourceRelativePath}`)
      continue
    }
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

  const { count: existingCount } = await supabase
    .from('photos')
    .select('*', { count: 'exact', head: true })
  console.log(`Deleting ${existingCount ?? 'unknown'} existing rows...`)
  const { error: deleteError } = await supabase
    .from('photos')
    .delete()
    .not('id', 'is', null)

  if (deleteError) throw deleteError
  console.log('All existing rows deleted.')

  console.log(`Inserting ${rows.length} rows in batches of 100...`)
  let inserted = 0

  for (const batch of chunk(rows, 100)) {
    const { error } = await supabase.from('photos').insert(batch)
    if (error) {
      console.error(`\nInsert failed on batch starting at index ${inserted} (batch size ${batch.length})`)
      throw error
    }
    inserted += batch.length
    process.stdout.write(`\r  ${inserted}/${rows.length}`)
  }

  console.log(`\nDone. Inserted ${inserted} rows.`)
}

await main()
