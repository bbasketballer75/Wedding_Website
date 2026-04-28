/**
 * Sync Wedding Day photo filenames between Supabase and R2
 * Supabase has DSC00XXX.webp filenames but R2 has timestamp-based names
 * This script updates Supabase records to use actual R2 filenames
 */

const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3')

const SUPABASE_URL = 'https://qrupgckiykxkzyeifftd.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFydXBnY2tpeWt4a3p5ZWlmZnRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwNTU4NzgsImV4cCI6MjA5MTYzMTg3OH0.sDM5xixgJk_qcreYT7kp8nwiQz6jCISnCtAu4_gHkUg'

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || 'eeb5d94194e46f57e8c91d48edf9719a'
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || 'fa9bb76945943d79b604ad5f2231a15a'
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '4c7f51c2a8cf8ecf61c8e915b44dbb44e729b39a851174bd0f01a927dc1c3bbe'

async function fetchSupabasePhotos() {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/photos?select=id,thumbnail,url,album_sort_order&album=eq.Wedding%20Day&order=album_sort_order.asc`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      }
    }
  )
  return response.json()
}

async function fetchR2Files() {
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  })

  const files = []
  let token

  do {
    const command = new ListObjectsV2Command({
      Bucket: 'wedding-media',
      Prefix: 'professional/photos/wedding-photos/',
      MaxKeys: 1000,
      ContinuationToken: token,
    })
    const result = await s3.send(command)
    result.Contents?.forEach(obj => files.push(obj.Key))
    token = result.NextContinuationToken
  } while (token)

  files.sort()
  return files
}

async function updateSupabasePhoto(id, thumbnail, url) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/photos?id=eq.${id}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        thumbnail,
        url,
      })
    }
  )
  return response.ok
}

function extractFilename(key) {
  // Extract just the filename from R2 key like "professional/photos/wedding-photos/20250511_180812-0b9c.webp"
  return key.split('/').pop()
}

async function main() {
  console.log('Fetching Supabase Wedding Day photos...')
  const supabasePhotos = await fetchSupabasePhotos()
  console.log(`Found ${supabasePhotos.length} Supabase photos`)

  console.log('Fetching R2 Wedding Day files...')
  const r2Files = await fetchR2Files()
  console.log(`Found ${r2Files.length} R2 files`)

  if (supabasePhotos.length !== r2Files.length) {
    console.error(`WARNING: Count mismatch! Supabase: ${supabasePhotos.length}, R2: ${r2Files.length}`)
    const min = Math.min(supabasePhotos.length, r2Files.length)
    console.error(`Proceeding with first ${min} records...`)
  }

  console.log('\nUpdating Supabase records...')
  let updated = 0
  let errors = 0

  for (let i = 0; i < Math.min(supabasePhotos.length, r2Files.length); i++) {
    const photo = supabasePhotos[i]
    const r2Key = r2Files[i]
    const filename = extractFilename(r2Key)

    const newThumbnail = `/media/_thumbs/Professional/Wedding Day/Photos/${filename}`
    const newUrl = `/media/Professional/Wedding Day/Photos/${filename}`

    if (photo.thumbnail === newThumbnail) {
      console.log(`  [SKIP] ${i+1}: ${filename} - already correct`)
      continue
    }

    const ok = await updateSupabasePhoto(photo.id, newThumbnail, newUrl)
    if (ok) {
      console.log(`  [OK] ${i+1}: ${photo.thumbnail} -> ${newThumbnail}`)
      updated++
    } else {
      console.log(`  [ERROR] ${i+1}: Failed to update ${photo.id}`)
      errors++
    }
  }

  console.log(`\nDone! Updated: ${updated}, Errors: ${errors}`)
}

main().catch(console.error)