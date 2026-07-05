import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type GuestUploadRow = {
  id: string
  guest_name: string
  guest_email: string
  photo_urls: string[]
  created_at: string
}

type PhotoRow = {
  id: string
  url: string
  thumbnail: string
  category: string | null
  is_professional: boolean
  faces: unknown[]
  created_at: string
}

type ExportManifestItem = {
  photoId: string
  url: string
  thumbnail?: string | null
  filename: string
  relativePath: string
  category?: string | null
  guestName?: string | null
  guestEmail?: string | null
  guestUploadId?: string | null
  createdAt?: string | null
}

type ExportManifest = {
  batchKey: string
  label: string
  createdAt: string
  exportableUploadCount: number
  exportablePhotoCount: number
  items: ExportManifestItem[]
}

type SyncUpdate = {
  photoId: string
  url: string
  filename: string
  faces: Array<{
    id: string
    name: string
    x: number
    y: number
    box?: {
      left: number
      top: number
      width: number
      height: number
    } | null
  }>
}

function slugify(value: string) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function sanitizeSegment(value: string | null | undefined) {
  return slugify(value || '') || 'guest'
}

function extensionFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname
    const match = pathname.match(/\.[A-Za-z0-9]+$/)
    return match ? match[0] : '.jpg'
  } catch {
    return '.jpg'
  }
}

function buildExportFilename(photo: PhotoRow) {
  const ext = extensionFromUrl(photo.url)
  return `guest-photo-${photo.id}${ext}`
}

function buildRelativePath(photo: PhotoRow, upload: GuestUploadRow) {
  const category = sanitizeSegment(photo.category || 'guest-uploads')
  const guest = sanitizeSegment(upload.guest_name)
  return `Guest Uploads/${category}/${guest}/${buildExportFilename(photo)}`
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

async function requireAdmin(request: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const authHeader = request.headers.get('Authorization') ?? ''

  if (!authHeader) {
    throw new Error('Missing Authorization header')
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const { data, error } = await adminClient.auth.getUser()
  if (error || !data.user) {
    throw new Error('Could not verify admin user')
  }

  const role = data.user.app_metadata?.role
  if (role !== 'admin') {
    throw new Error('Admin access required')
  }

  return {
    user: data.user,
    adminClient: createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }),
  }
}

async function fetchExportableGuestRows(adminClient: ReturnType<typeof createClient>) {
  const { data: uploads, error: uploadError } = await adminClient
    .from('guest_uploads')
    .select('id, guest_name, guest_email, photo_urls, created_at')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })

  if (uploadError) throw uploadError

  const approvedUploads = (uploads || []) as GuestUploadRow[]
  const candidateUrls = [
    ...new Set(approvedUploads.flatMap(upload => upload.photo_urls || []).filter(Boolean)),
  ]
  const photoRows: PhotoRow[] = []

  for (const urlChunk of chunk(candidateUrls, 40)) {
    const { data, error } = await adminClient
      .from('photos')
      .select('id, url, thumbnail, category, is_professional, faces, created_at')
      .eq('is_professional', false)
      .in('url', urlChunk)

    if (error) throw error
    photoRows.push(...((data || []) as PhotoRow[]))
  }

  const photoByUrl = new Map(photoRows.map(row => [row.url, row]))
  const manifestItems: ExportManifestItem[] = []
  const exportableUploadIds = new Set<string>()

  for (const upload of approvedUploads) {
    for (const url of upload.photo_urls || []) {
      const photo = photoByUrl.get(url)
      if (!photo) continue

      exportableUploadIds.add(upload.id)
      manifestItems.push({
        photoId: photo.id,
        url: photo.url,
        thumbnail: photo.thumbnail,
        filename: buildExportFilename(photo),
        relativePath: buildRelativePath(photo, upload),
        category: photo.category,
        guestName: upload.guest_name,
        guestEmail: upload.guest_email,
        guestUploadId: upload.id,
        createdAt: upload.created_at,
      })
    }
  }

  return {
    approvedUploads,
    manifestItems,
    exportableUploadCount: exportableUploadIds.size,
    exportablePhotoCount: manifestItems.length,
  }
}

async function prepareExport(
  adminClient: ReturnType<typeof createClient>,
  user: { id: string; email?: string | null }
) {
  const { manifestItems, exportableUploadCount, exportablePhotoCount } =
    await fetchExportableGuestRows(adminClient)

  const createdAt = new Date().toISOString()
  const batchKey = `guest-face-tagging-${createdAt.replace(/[:.]/g, '-')}`
  const manifest: ExportManifest = {
    batchKey,
    label: `Guest uploads ${createdAt.slice(0, 10)}`,
    createdAt,
    exportableUploadCount,
    exportablePhotoCount,
    items: manifestItems,
  }

  const { error } = await adminClient.from('guest_face_tagging_batches').insert({
    batch_key: batchKey,
    label: manifest.label,
    status: 'prepared',
    exportable_upload_count: exportableUploadCount,
    exportable_photo_count: exportablePhotoCount,
    created_by_user_id: user.id,
    created_by_email: user.email ?? null,
    metadata: {
      first_relative_paths: manifestItems.slice(0, 10).map(item => item.relativePath),
    },
  })

  if (error) throw error

  return manifest
}

async function syncTaggedBatch(
  adminClient: ReturnType<typeof createClient>,
  user: { id: string; email?: string | null },
  payload: { batchKey: string; label: string; createdAt: string; updates: SyncUpdate[] }
) {
  const updates = payload.updates || []
  let syncedPhotoCount = 0
  let skippedPhotoCount = 0
  const missingPhotoIds: string[] = []

  for (const update of updates) {
    const { data: existing, error: fetchError } = await adminClient
      .from('photos')
      .select('id, url, faces')
      .eq('id', update.photoId)
      .maybeSingle()

    if (fetchError) throw fetchError

    if (!existing) {
      skippedPhotoCount += 1
      missingPhotoIds.push(update.photoId)
      continue
    }

    const normalizedFaces = (update.faces || []).map(face => ({
      id: face.id,
      name: face.name,
      x: face.x,
      y: face.y,
      box: face.box ?? null,
    }))

    const { error: updateError } = await adminClient
      .from('photos')
      .update({
        faces: normalizedFaces,
      })
      .eq('id', update.photoId)

    if (updateError) throw updateError
    syncedPhotoCount += 1
  }

  const status = missingPhotoIds.length > 0 && syncedPhotoCount === 0 ? 'failed' : 'synced'
  const { error } = await adminClient.from('guest_face_tagging_batches').upsert(
    {
      batch_key: payload.batchKey,
      label: payload.label,
      status,
      synced_photo_count: syncedPhotoCount,
      skipped_photo_count: skippedPhotoCount,
      synced_by_user_id: user.id,
      synced_by_email: user.email ?? null,
      last_synced_at: new Date().toISOString(),
      last_error:
        missingPhotoIds.length > 0 ? `Missing photo rows: ${missingPhotoIds.join(', ')}` : null,
      updated_at: new Date().toISOString(),
      metadata: {
        source: 'edge-sync',
        upload_count: updates.length,
      },
    },
    { onConflict: 'batch_key' }
  )

  if (error) throw error

  return {
    batchKey: payload.batchKey,
    syncedPhotoCount,
    skippedPhotoCount,
    missingPhotoIds,
  }
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user, adminClient } = await requireAdmin(request)
    const payload = await request.json()
    const action = payload?.action

    if (action === 'prepare_export') {
      const manifest = await prepareExport(adminClient, user)
      return jsonResponse({ manifest })
    }

    if (action === 'sync_tagged_batch') {
      const result = await syncTaggedBatch(adminClient, user, payload)
      return jsonResponse(result)
    }

    return jsonResponse({ error: 'Unsupported action' }, 400)
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
})
