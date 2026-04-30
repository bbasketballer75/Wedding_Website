import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    const authHeader = request.headers.get('Authorization') ?? ''
    if (!authHeader) {
      return jsonResponse({ error: 'Missing Authorization' }, 401)
    }

    const payload = await request.json()
    const { photo_ids } = payload

    if (!Array.isArray(photo_ids) || photo_ids.length === 0) {
      return jsonResponse({ error: 'photo_ids array required' }, 400)
    }

    if (photo_ids.length <= 20) {
      // Small batches should use client-side JSZip, not this Edge Function
      return jsonResponse({ error: 'Use client-side download for small batches' }, 400)
    }

    if (photo_ids.length > 100) {
      // Hard limit per D-23
      return jsonResponse({ error: 'Maximum 100 photos per batch download' }, 400)
    }

    // Create admin client to fetch photos and generate signed URLs
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    // Fetch photo URLs from database
    const { data: photos, error } = await adminClient
      .from('photos')
      .select('id, url, thumbnail, caption')
      .in('id', photo_ids)
      .limit(100)

    if (error) throw error
    if (!photos || photos.length === 0) {
      return jsonResponse({ error: 'No photos found' }, 404)
    }

    // Generate signed URLs for each photo (1 hour expiry per D-22)
    const signedUrls = await Promise.all(
      photos.map(async (photo) => {
        // Extract the storage path from the URL
        const urlPath = photo.url.split('/storage/v1/object/public/photos/')[1] || photo.url
        const { data: signedUrlData } = await adminClient.storage
          .from('photos')
          .createSignedUrl(urlPath, 3600) // 1 hour expiry
        return {
          id: photo.id,
          url: signedUrlData?.signedUrl || photo.url,
          caption: photo.caption
        }
      })
    )

    // Per D-22: Edge function returns signed URL for pre-generated zip
    // For now, return signed URLs - client will download and create zip
    // A full implementation would generate the zip server-side
    // This avoids memory issues per D-11

    return jsonResponse({
      signed_urls: signedUrls,
      expires_in: 3600
    })

  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : String(error) },
      500
    )
  }
})