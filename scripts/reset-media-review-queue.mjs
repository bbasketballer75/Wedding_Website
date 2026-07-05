import 'dotenv/config'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { writeJson, writeMarkdown } from './photo-batch-utils.mjs'

const PROJECT_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!PROJECT_URL) {
  throw new Error('Missing VITE_SUPABASE_URL')
}

if (!SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
}

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

function chunk(items, size) {
  const chunks = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

async function listStorageObjects(bucket, folder) {
  const files = []
  let offset = 0

  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(folder, {
      limit: 100,
      offset,
    })

    if (error) {
      throw error
    }

    const entries = data || []
    for (const entry of entries) {
      const nextPath = folder ? `${folder}/${entry.name}` : entry.name
      if (entry.id === null) {
        files.push(...(await listStorageObjects(bucket, nextPath)))
      } else {
        files.push(nextPath)
      }
    }

    if (entries.length < 100) {
      break
    }

    offset += 100
  }

  return files
}

async function deleteStoragePrefix(bucket, prefix) {
  if (!bucket || !prefix) return []

  const files = await listStorageObjects(bucket, prefix)

  for (const fileChunk of chunk(files, 100)) {
    const { error } = await supabase.storage.from(bucket).remove(fileChunk)

    if (error) {
      throw error
    }
  }

  return files
}

async function main() {
  const { data: batches, error } = await supabase
    .from('media_review_batches')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) {
    throw error
  }

  const legacyBatches = (batches || []).filter(
    batch => !String(batch.batch_key || '').startsWith('guest-review-batch-')
  )

  if (legacyBatches.length === 0) {
    console.log('No legacy media review batches found. Nothing to reset.')
    return
  }

  const batchIds = legacyBatches.map(batch => batch.id)
  const removedArtifacts = []

  for (const batch of legacyBatches) {
    const deletedFiles = await deleteStoragePrefix(batch.artifact_bucket, batch.artifact_prefix)
    removedArtifacts.push({
      batchId: batch.id,
      batchKey: batch.batch_key,
      artifactBucket: batch.artifact_bucket,
      artifactPrefix: batch.artifact_prefix,
      deletedObjectCount: deletedFiles.length,
      deletedObjects: deletedFiles,
    })
  }

  const { error: faceDeleteError } = await supabase
    .from('media_review_faces')
    .delete()
    .in('batch_id', batchIds)

  if (faceDeleteError) {
    throw faceDeleteError
  }

  const { error: clusterDeleteError } = await supabase
    .from('media_review_clusters')
    .delete()
    .in('batch_id', batchIds)

  if (clusterDeleteError) {
    throw clusterDeleteError
  }

  const { error: batchDeleteError } = await supabase
    .from('media_review_batches')
    .delete()
    .in('id', batchIds)

  if (batchDeleteError) {
    throw batchDeleteError
  }

  const report = {
    deletedBatchCount: legacyBatches.length,
    deletedBatchIds: batchIds,
    deletedAt: new Date().toISOString(),
    batches: legacyBatches.map(batch => ({
      id: batch.id,
      batchKey: batch.batch_key,
      label: batch.label,
      status: batch.status,
      workingRoot: batch.working_root,
    })),
    removedArtifacts,
  }

  const reportPath = path.join(process.cwd(), 'tmp', 'media-review-reset-report.json')
  const summaryPath = path.join(process.cwd(), 'tmp', 'media-review-reset-report.md')

  await writeJson(reportPath, report)
  await writeMarkdown(summaryPath, [
    '# Media Review Reset Report',
    '',
    `Deleted legacy review batches: **${legacyBatches.length}**`,
    `Generated at: \`${report.deletedAt}\``,
    '',
    ...legacyBatches.flatMap(batch => [`- \`${batch.label}\` (\`${batch.batch_key}\`)`]),
  ])

  console.log(
    `Deleted ${legacyBatches.length} legacy media review batch${legacyBatches.length === 1 ? '' : 'es'}.`
  )
  console.log(`Wrote reset report to ${reportPath}`)
}

await main()
