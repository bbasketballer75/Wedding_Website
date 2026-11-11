/**
 * Supabase Edge Function: guest-upload-url
 *
 * Signs a short-lived R2 `PUT` URL for the public guest-upload flow and returns
 * the matching public media URL. Contract-compatible with the frozen Netlify
 * function `netlify/functions/guest-upload-url.ts` (same request/response shape,
 * MIME allowlist, 500 MB cap, `guest-uploads/{photos|videos}/<uuid>.<ext>` key).
 *
 * Secrets (set on the Supabase project, never in the repo):
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *   R2_MEDIA_BUCKET (default wedding-media),
 *   R2_PUBLIC_BASE_URL (e.g. https://media.wedding.theporadas.com)
 *
 * The browser uploads directly to R2 (XHR PUT, progress preserved); the anon
 * JWT gate is handled by the platform (`verify_jwt`), so no user can mint URLs
 * without the project anon key.
 */
import { AwsClient } from 'npm:aws4fetch@1.0.20'

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
])

const MAX_SIZE_BYTES = 500 * 1024 * 1024
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (request.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)

  const accountId = Deno.env.get('R2_ACCOUNT_ID')
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')
  const bucket = Deno.env.get('R2_MEDIA_BUCKET') ?? 'wedding-media'
  const publicBaseUrl = Deno.env.get('R2_PUBLIC_BASE_URL')

  if (!accountId || !accessKeyId || !secretAccessKey || !publicBaseUrl) {
    return json({ error: 'Server configuration error' }, 500)
  }

  let body: { contentType?: unknown; contentLength?: unknown }
  try {
    body = (await request.json()) as { contentType?: unknown; contentLength?: unknown }
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const { contentType, contentLength } = body
  if (typeof contentType !== 'string' || !ALLOWED_TYPES.has(contentType)) {
    return json({ error: 'Unsupported file type' }, 400)
  }
  if (
    typeof contentLength !== 'number' ||
    !Number.isFinite(contentLength) ||
    contentLength <= 0 ||
    contentLength > MAX_SIZE_BYTES
  ) {
    return json({ error: 'Invalid content length' }, 400)
  }

  const mediaType = contentType.startsWith('video/') ? 'videos' : 'photos'
  const extension = contentType
    .split('/')[1]
    .replace('quicktime', 'mov')
    .replace('jpeg', 'jpg')
  const objectKey = `guest-uploads/${mediaType}/${crypto.randomUUID()}.${extension}`

  const client = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: 's3',
    region: 'auto',
  })

  try {
    const url = new URL(`https://${accountId}.r2.cloudflarestorage.com/${bucket}/${objectKey}`)
    url.searchParams.set('X-Amz-Expires', '300')
    const signed = await client.sign(url, { method: 'PUT', aws: { signQuery: true } })
    return json({
      uploadUrl: signed.url,
      publicUrl: `${publicBaseUrl.replace(/\/$/, '')}/${objectKey}`,
    })
  } catch {
    return json({ error: 'Failed to generate upload URL' }, 500)
  }
})
