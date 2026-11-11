/**
 * Supabase Edge Function: guest-media
 *
 * Public read-only proxy for guest-upload objects in R2. This exists because the
 * production media Worker (media.wedding.theporadas.com) only routes
 * /media, /video and /background_audio; guest uploads live under
 * guest-uploads/{photos,videos}/ and need their own public surface.
 *
 * Deployed with `verify_jwt = false` (images/videos are embedded in <img>/<video>
 * tags and cannot send headers). Only the `guest-uploads/` prefix is served, and
 * object keys are validated; the R2 credentials stay server-side (shared project
 * secrets with `guest-upload-url`).
 *
 * URL shape: https://<ref>.supabase.co/functions/v1/guest-media/guest-uploads/<...>
 */

import { AwsClient } from 'npm:aws4fetch@1.0.20'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
}

function notFound(): Response {
  return new Response('Not found', { status: 404, headers: CORS_HEADERS })
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (request.method !== 'GET' && request.method !== 'HEAD') return notFound()

  const accountId = Deno.env.get('R2_ACCOUNT_ID')
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')
  const bucket = Deno.env.get('R2_MEDIA_BUCKET') ?? 'wedding-media'
  if (!accountId || !accessKeyId || !secretAccessKey) return notFound()

  const url = new URL(request.url)
  const objectKey = url.searchParams.get('key') ?? ''
  if (!objectKey.startsWith('guest-uploads/') || objectKey.includes('..')) return notFound()

  const client = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' })
  const signed = await client.sign(
    new URL(`https://${accountId}.r2.cloudflarestorage.com/${bucket}/${objectKey}`),
    { method: 'GET', aws: { signQuery: true } }
  )

  const objectResponse = await fetch(signed.url, { method: request.method })
  if (!objectResponse.ok || !objectResponse.body) return notFound()

  const contentType = objectResponse.headers.get('content-type') ?? 'application/octet-stream'
  return new Response(request.method === 'HEAD' ? null : objectResponse.body, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      ETag: objectResponse.headers.get('etag') ?? '',
    },
  })
})
