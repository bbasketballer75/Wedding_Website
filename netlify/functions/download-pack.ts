import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import JSZip from 'jszip'

const MAX_PHOTOS = 50

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return { statusCode: 500, body: 'Server configuration error' }
  }

  let photoIds: string[]
  try {
    const body = JSON.parse(event.body ?? '{}')
    photoIds = Array.isArray(body.photoIds) ? body.photoIds : []
  } catch {
    return { statusCode: 400, body: 'Invalid request body' }
  }

  if (photoIds.length === 0) {
    return { statusCode: 400, body: 'No photo IDs provided' }
  }

  if (photoIds.length > MAX_PHOTOS) {
    return { statusCode: 400, body: `Maximum ${MAX_PHOTOS} photos per download` }
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const { data: photos, error } = await supabase
    .from('photos')
    .select('id, url, download_url, caption')
    .in('id', photoIds)

  if (error || !photos) {
    return { statusCode: 500, body: 'Failed to fetch photos' }
  }

  const zip = new JSZip()
  const folder = zip.folder('theporadas-photos')!

  await Promise.all(
    photos.map(async (photo, index) => {
      const url = photo.download_url || photo.url
      try {
        const res = await fetch(url)
        if (!res.ok) return
        const buffer = await res.arrayBuffer()
        const ext = url.split('.').pop()?.split('?')[0] ?? 'jpg'
        const name = photo.caption
          ? `${String(index + 1).padStart(2, '0')}-${photo.caption.replace(/[^a-z0-9]/gi, '-').slice(0, 40)}.${ext}`
          : `photo-${String(index + 1).padStart(2, '0')}.${ext}`
        folder.file(name, buffer)
      } catch {
        // skip failed photos
      }
    })
  )

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="theporadas-photos.zip"',
      'Content-Length': String(zipBuffer.length),
    },
    body: zipBuffer.toString('base64'),
    isBase64Encoded: true,
  }
}
