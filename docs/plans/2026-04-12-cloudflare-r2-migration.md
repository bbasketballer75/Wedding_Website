# Cloudflare R2 Media Migration Plan

**Goal:** Move all wedding media (videos, photos, background audio, guest uploads) from Supabase Storage to Cloudflare R2. Zero bandwidth fees, built-in global CDN, same `media.wedding.theporadas.com` domain — guests and search engines notice nothing.

---

## Why This Migration Matters

|           | Supabase Storage             | Cloudflare R2                    |
| --------- | ---------------------------- | -------------------------------- |
| Storage   | $0.021/GB/month              | $0.015/GB/month                  |
| Bandwidth | **$0.09/GB**                 | **$0.00**                        |
| CDN       | None (single region)         | Global Cloudflare PoPs           |
| Free tier | 1 GB storage, 2 GB bandwidth | 10 GB storage, 1M requests/month |

Your site has multiple large video files (Film page, background audio) and will grow as guest uploads accumulate. The Supabase bandwidth cost is the killer — every page load that hits the Film page pulls 50–200 MB of video. With R2, that cost disappears entirely.

**Expected savings:** With even 20 GB/month of bandwidth (modest for a media-heavy site with video), that's $1.80/month gone under R2 vs. $1.80 under Supabase. At scale (100 GB/month during the wedding period), that's $9/month vs. $0.

---

## Current Architecture

```
/media/* paths      → getMediaPath() → Supabase Storage URL directly
                      (https://rxzbbtghnrvzubqrbhhx.supabase.co/storage/v1/object/public/wedding-media/...)

/video/* paths      → getMediaPath() → VITE_MEDIA_BASE_URL/video/...
/background_audio/* → getMediaPath() → VITE_MEDIA_BASE_URL/background_audio/...
VITE_MEDIA_BASE_URL = https://media.wedding.theporadas.com

VTT caption files   → /__vtt_proxy/* → Netlify redirects to media.wedding.theporadas.com
                      (Needed because browser blocks cross-origin <track> elements)
```

**Upload script** (`scripts/upload-remote-media.js`): Uses `tus-js-client` to upload `public/video`, `public/background_audio`, `public/media` to Supabase Storage bucket `wedding-media`.

**Guest uploads**: Guests upload photos via `/upload` page → stored in Supabase Storage → URLs saved in `guest_uploads.photo_urls[]` → admin approves → served to guests.

---

## Migration Phases

| Phase | What                                                    | Effort                 |
| ----- | ------------------------------------------------------- | ---------------------- |
| 1     | Create R2 bucket, attach `media.wedding.theporadas.com` | 20 min                 |
| 2     | Migrate existing media files with rclone                | 30 min + transfer time |
| 3     | Update upload script for R2                             | 1 hr                   |
| 4     | Update app code + env vars                              | 30 min                 |
| 5     | Remove VTT proxy (optional, enabled by R2 CORS)         | 15 min                 |
| 6     | Migrate guest uploads to R2                             | 2 hr                   |
| 7     | Decommission Supabase Storage                           | 10 min                 |

Phases 1–4 are the critical path and can be completed in a single session. Phase 6 can wait until after Phase 4 is deployed and working.

---

## Prerequisites

### Tools to Install

```bash
# Wrangler CLI — Cloudflare's official R2 management tool
npm install -g wrangler

# rclone — best tool for bucket-to-bucket file migration
# macOS:
brew install rclone

# Windows (run in PowerShell as admin):
winget install Rclone.Rclone
# or download installer from: https://rclone.org/downloads/

# AWS CLI (optional, useful for scripted R2 operations)
# macOS: brew install awscli
# Windows: winget install Amazon.AWSCLI
```

### Accounts Needed

1. **Cloudflare account** — the domain `theporadas.com` must already be on Cloudflare (it is, since you have `media.wedding.theporadas.com` as a subdomain). Log in at dash.cloudflare.com.
2. **Cloudflare R2 enabled** — R2 is opt-in. Go to Cloudflare Dashboard → R2 → Enable (requires payment method, but free tier is generous).

---

## Phase 1: Create R2 Bucket and Attach Custom Domain

### Step 1: Authenticate Wrangler

```bash
wrangler login
```

This opens a browser. Log in with the Cloudflare account that manages `theporadas.com`.

### Step 2: Create the R2 bucket

```bash
wrangler r2 bucket create wedding-media
```

Expected output:

```
Created bucket 'wedding-media' with default storage class of Standard.
```

### Step 3: Verify the bucket exists

```bash
wrangler r2 bucket list
```

### Step 4: Configure CORS on the bucket

R2 supports CORS configuration — this means we can serve VTT files directly from R2 and eliminate the Netlify proxy later (Phase 5). Create the CORS config file first:

```bash
# Create cors.json in your project root (add to .gitignore if you want)
```

**`r2-cors.json`** (save this file in your project root):

```json
[
  {
    "AllowedOrigins": [
      "https://www.theporadas.com",
      "https://theporadas.com",
      "http://localhost:5173",
      "http://localhost:4173"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 86400
  }
]
```

Apply the CORS rules:

```bash
wrangler r2 bucket cors set wedding-media --file r2-cors.json
```

Verify:

```bash
wrangler r2 bucket cors get wedding-media
```

### Step 5: Get your R2 API endpoint

You'll need this for rclone and the upload script:

```bash
wrangler whoami
```

Note your **Account ID** (looks like `abc123def456...`). Your R2 S3-compatible endpoint will be:

```
https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

### Step 6: Create R2 API credentials

In the Cloudflare Dashboard:

1. Go to **R2 → Manage R2 API tokens**
2. Create token with **Edit** permissions on `wedding-media` bucket
3. Save the **Access Key ID** and **Secret Access Key** — you'll need these in multiple places

> These are NOT the same as your Cloudflare API token. They're specifically for S3-compatible access to R2.

### Step 7: Attach custom domain to R2 bucket

This is done in the Cloudflare Dashboard (Wrangler's `domain add` command requires the zone to be in Cloudflare already):

1. Go to **R2 → wedding-media → Settings → Custom Domains**
2. Click **Connect Domain**
3. Enter: `media.wedding.theporadas.com`
4. Cloudflare automatically creates a DNS record and issues an SSL cert

After this, `https://media.wedding.theporadas.com/<object-key>` will serve from R2.

> **Note:** This replaces whatever `media.wedding.theporadas.com` was pointing to before. Do NOT do this until Phase 2 (file migration) is complete, or you'll have a brief window where the domain serves from R2 but files haven't been copied yet. Do Phases 1–2 before Step 7.

---

## Phase 2: Migrate Existing Files with rclone

### Step 1: Get Supabase S3 credentials

Supabase Storage has S3-compatible access. Get dedicated credentials (not the service role key):

1. Go to **Supabase Dashboard → Project Settings → Storage → S3 access credentials**
2. Click **Generate new credentials**
3. Note the **Access Key ID** and **Secret Access Key**
4. The S3 endpoint is: `https://rxzbbtghnrvzubqrbhhx.supabase.co/storage/v1/s3`
5. Region: `auto` (or leave blank)

### Step 2: Configure rclone

Run the interactive config:

```bash
rclone config
```

**Add Supabase Storage as a remote:**

```
n) New remote
name> supabase-storage
Type of storage> s3 (Amazon S3 Compliant Storage Providers including...)
provider> Other
env_auth> false
access_key_id> <YOUR_SUPABASE_S3_ACCESS_KEY_ID>
secret_access_key> <YOUR_SUPABASE_S3_SECRET_ACCESS_KEY>
region> auto
endpoint> https://rxzbbtghnrvzubqrbhhx.supabase.co/storage/v1/s3
```

**Add R2 as a remote:**

```
n) New remote
name> r2
Type of storage> s3
provider> Cloudflare
env_auth> false
access_key_id> <YOUR_R2_ACCESS_KEY_ID>
secret_access_key> <YOUR_R2_SECRET_ACCESS_KEY>
region> auto
endpoint> https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

Alternatively, create `~/.config/rclone/rclone.conf` directly:

```ini
[supabase-storage]
type = s3
provider = Other
access_key_id = <SUPABASE_S3_ACCESS_KEY>
secret_access_key = <SUPABASE_S3_SECRET_ACCESS_KEY>
region = auto
endpoint = https://rxzbbtghnrvzubqrbhhx.supabase.co/storage/v1/s3

[r2]
type = s3
provider = Cloudflare
access_key_id = <R2_ACCESS_KEY>
secret_access_key = <R2_SECRET_KEY>
region = auto
endpoint = https://<ACCOUNT_ID>.r2.cloudflarestorage.com
no_check_bucket = true
```

### Step 3: Dry run — verify rclone can see your files

```bash
# List files in Supabase Storage bucket
rclone ls supabase-storage:wedding-media

# List files in R2 (should be empty before migration)
rclone ls r2:wedding-media
```

### Step 4: Run the migration

```bash
# Dry run first — shows what WOULD be copied, no actual transfers
rclone copy supabase-storage:wedding-media r2:wedding-media --dry-run --verbose

# Actual migration with progress display
rclone copy supabase-storage:wedding-media r2:wedding-media \
  --progress \
  --transfers 10 \
  --checkers 20 \
  --s3-upload-concurrency 8 \
  --verbose

# For large video files, add checksum verification:
rclone copy supabase-storage:wedding-media r2:wedding-media \
  --progress \
  --transfers 4 \
  --checkers 8 \
  --checksum
```

**Flag explanations:**

- `--progress`: Live transfer stats
- `--transfers 10`: 10 parallel file transfers (lower this if bandwidth is limited)
- `--checksum`: Verifies file integrity after copy (slower but safe)
- `--s3-upload-concurrency 8`: Parallel chunks for large files

### Step 5: Verify migration is complete

```bash
# Compare source and destination — should show no differences
rclone check supabase-storage:wedding-media r2:wedding-media --verbose

# Count files in each
rclone size supabase-storage:wedding-media
rclone size r2:wedding-media
# Total size and count should match
```

### Step 6: Spot-check a few files in the browser

Before switching the domain, test a file directly via the R2 account URL:

```
https://<ACCOUNT_ID>.r2.cloudflarestorage.com/wedding-media/video/your-video.mp4
```

This won't work from the public (bucket is not public via the S3 URL), but you can use Wrangler:

```bash
# List files at a specific path in R2
wrangler r2 object get wedding-media/video/ceremony.mp4 --file /tmp/test-ceremony.mp4
```

Or verify via the Cloudflare Dashboard → R2 → wedding-media → Browse.

### Step 7: Attach custom domain (from Phase 1 Step 7)

Only now, after files are migrated, complete **Phase 1 Step 7** — attach `media.wedding.theporadas.com` to the R2 bucket.

Once the domain is attached and DNS propagates (~1-2 min since Cloudflare is authoritative), `https://media.wedding.theporadas.com/video/ceremony.mp4` will serve from R2. Test this in a browser.

---

## Phase 3: Update the Upload Script

The current `scripts/upload-remote-media.js` uses `tus-js-client` (Supabase's resumable upload protocol). R2 uses S3 multipart uploads instead. Replace it with `@aws-sdk/client-s3`.

### Step 1: Install the AWS SDK

```bash
npm install --save-dev @aws-sdk/client-s3 @aws-sdk/lib-storage
```

`@aws-sdk/lib-storage` provides the `Upload` helper with automatic multipart splitting (equivalent to tus chunked uploads).

### Step 2: Add R2 env vars to `.env` (and `.env.example`)

```bash
# Cloudflare R2 Media Storage (add to .env)
R2_ACCOUNT_ID=<your_cloudflare_account_id>
R2_ACCESS_KEY_ID=<your_r2_access_key_id>
R2_SECRET_ACCESS_KEY=<your_r2_secret_access_key>
R2_MEDIA_BUCKET=wedding-media
R2_PUBLIC_BASE_URL=https://media.wedding.theporadas.com
```

### Step 3: Rewrite `scripts/upload-remote-media.js`

Replace the entire file:

```js
import fs from 'node:fs'
import path from 'node:path'
import { S3Client } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const BUCKET_NAME = process.env.R2_MEDIA_BUCKET || 'wedding-media'
const MEDIA_ROOTS = ['public/video', 'public/background_audio', 'public/media']

if (!ACCOUNT_ID) throw new Error('Missing R2_ACCOUNT_ID')
if (!ACCESS_KEY_ID) throw new Error('Missing R2_ACCESS_KEY_ID')
if (!SECRET_ACCESS_KEY) throw new Error('Missing R2_SECRET_ACCESS_KEY')

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
})

const CONTENT_TYPES = new Map([
  ['.avif', 'image/avif'],
  ['.flac', 'audio/flac'],
  ['.gif', 'image/gif'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.json', 'application/json'],
  ['.m4a', 'audio/mp4'],
  ['.mov', 'video/quicktime'],
  ['.mp3', 'audio/mpeg'],
  ['.mp4', 'video/mp4'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.vtt', 'text/vtt'],
  ['.wav', 'audio/wav'],
  ['.webm', 'video/webm'],
  ['.webp', 'image/webp'],
])

function hashString(value) {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function sanitizePathSegment(segment) {
  const lastDot = segment.lastIndexOf('.')
  const hasExt = lastDot > 0
  const base = hasExt ? segment.slice(0, lastDot) : segment
  const ext = hasExt ? segment.slice(lastDot) : ''
  const safe = base.replace(/[^A-Za-z0-9._-]/g, '_')
  return safe === base ? `${safe}${ext}` : `${safe}__${hashString(segment)}${ext}`
}

function toRemoteMediaPath(filePath) {
  return filePath
    .replace(/^public[\\/]/, '')
    .split(/[\\/]/)
    .filter(Boolean)
    .map(sanitizePathSegment)
    .join('/')
}

function getContentType(filePath) {
  return CONTENT_TYPES.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream'
}

function walk(directory) {
  const results = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      results.push(...walk(fullPath))
      continue
    }
    results.push(fullPath)
  }
  return results
}

async function uploadFile(filePath, objectKey, contentType) {
  const fileSize = fs.statSync(filePath).size
  const fileSizeMb = (fileSize / (1024 * 1024)).toFixed(2)

  const upload = new Upload({
    client: s3,
    params: {
      Bucket: BUCKET_NAME,
      Key: objectKey,
      Body: fs.createReadStream(filePath),
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    },
    partSize: 6 * 1024 * 1024, // 6 MB chunks (matches previous tus chunk size)
    queueSize: 4, // parallel part uploads
  })

  let lastLoggedPercent = -1
  upload.on('httpUploadProgress', progress => {
    if (!progress.total) return
    const percent = Math.floor((progress.loaded / progress.total) * 100)
    if (percent >= lastLoggedPercent + 25 || percent === 100) {
      lastLoggedPercent = percent
      console.log(`Progress ${objectKey}: ${percent}%`)
    }
  })

  await upload.done()
  console.log(`Uploaded ${objectKey} (${fileSizeMb} MB)`)
}

async function main() {
  const files = MEDIA_ROOTS.flatMap(root => {
    if (!fs.existsSync(root)) return []
    return walk(root)
  })

  console.log(`Uploading ${files.length} files to R2 bucket ${BUCKET_NAME}`)

  for (const filePath of files) {
    const objectKey = toRemoteMediaPath(filePath)
    const contentType = getContentType(filePath)
    await uploadFile(filePath, objectKey, contentType)
  }

  console.log(
    `\nDone. Files available at: ${process.env.R2_PUBLIC_BASE_URL || `https://${ACCOUNT_ID}.r2.cloudflarestorage.com/${BUCKET_NAME}`}`
  )
}

main().catch(error => {
  console.error('R2 media upload failed:', error)
  process.exitCode = 1
})
```

### Step 4: Remove the old Supabase tus dependency

```bash
npm uninstall tus-js-client
```

Also remove `@supabase/supabase-js` from the upload script — it's no longer used there (it's still used by the app itself, just not the upload script).

---

## Phase 4: Update App Code and Env Vars

### Step 1: Update `src/utils/media.ts`

Currently, `/media/` paths are hardcoded to route through Supabase Storage. After migration, all media should route through `VITE_MEDIA_BASE_URL` (`media.wedding.theporadas.com`, now backed by R2).

**Change in `src/utils/media.ts`:**

Remove the special Supabase Storage handling for `/media/` prefix (lines 50–54):

```ts
// REMOVE this block:
const supabaseUrl = trimTrailingSlash(import.meta.env.VITE_SUPABASE_URL || '')
const supabaseMediaBucket = import.meta.env.VITE_SUPABASE_MEDIA_BUCKET || DEFAULT_MEDIA_BUCKET
if (supabaseUrl && path.startsWith(STORAGE_MEDIA_PREFIX)) {
  return `${supabaseUrl}/storage/v1/object/public/${supabaseMediaBucket}/${toRemoteMediaPath(path)}`
}
```

Also remove the constants that are now unused:

```ts
// REMOVE:
const STORAGE_MEDIA_PREFIX = '/media/'
const DEFAULT_MEDIA_BUCKET = 'wedding-media'
```

After the change, `/media/*` paths fall through to the same `VITE_MEDIA_BASE_URL` logic that already handles `/video/` and `/background_audio/`. The function becomes simpler:

```ts
const OFFLOADED_MEDIA_PREFIXES = ['/video/', '/background_audio/', '/media/']
// (STORAGE_MEDIA_PREFIX and DEFAULT_MEDIA_BUCKET removed)

export function getMediaPath(path: string): string {
  if (!path.startsWith('/')) {
    return path
  }

  const mediaBaseUrl = trimTrailingSlash(import.meta.env.VITE_MEDIA_BASE_URL || '')
  const shouldOffload = OFFLOADED_MEDIA_PREFIXES.some(prefix => path.startsWith(prefix))

  if (!mediaBaseUrl || !shouldOffload) {
    return path
  }

  if (import.meta.env.DEV) {
    return `${DEV_MEDIA_PROXY_PREFIX}/${toRemoteMediaPath(path)}`
  }

  if (path.endsWith('.vtt')) {
    return `/__vtt_proxy/${toRemoteMediaPath(path)}`
  }

  return `${mediaBaseUrl}/${toRemoteMediaPath(path)}`
}
```

### Step 2: Update `.env`

```bash
# Keep:
VITE_MEDIA_BASE_URL=https://media.wedding.theporadas.com

# Remove (no longer needed after media.ts change):
# VITE_SUPABASE_MEDIA_BUCKET=wedding-media  ← if you had this set

# Add (for upload script):
R2_ACCOUNT_ID=<your_cloudflare_account_id>
R2_ACCESS_KEY_ID=<your_r2_access_key_id>
R2_SECRET_ACCESS_KEY=<your_r2_secret_access_key>
R2_MEDIA_BUCKET=wedding-media
R2_PUBLIC_BASE_URL=https://media.wedding.theporadas.com
```

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` stay — they're still needed for the database (auth, guestbook, guest_uploads metadata, etc). Only the Storage piece moves to R2.

### Step 3: TypeScript check

```bash
npx tsc --noEmit
```

Expected: 0 errors. The only change was removing the Supabase URL references inside `media.ts` — nothing typed changes externally.

### Step 4: Run all tests

```bash
npx playwright test --workers=1
```

The tests mock all Supabase Storage URLs in `publicSite.ts` — the mock intercepts pattern-match on `supabase.co` URLs. After the change, `/media/` paths no longer go to `supabase.co`, they go to `media.wedding.theporadas.com`. The existing mock in `publicSite.ts` should already intercept `media.wedding.theporadas.com` — verify this is the case and add an intercept if not.

### Step 5: Deploy

```bash
git add src/utils/media.ts .env scripts/upload-remote-media.js package.json package-lock.json
git commit -m "feat(media): migrate static media from Supabase Storage to Cloudflare R2"
git push origin main
```

---

## Phase 5: Remove the VTT Netlify Proxy (Optional but Recommended)

The `/__vtt_proxy/*` Netlify redirect exists because `media.wedding.theporadas.com` historically had no CORS headers, and browsers block cross-origin `<track>` elements. Now that R2 serves `media.wedding.theporadas.com` with the CORS headers we set in Phase 1, this proxy is no longer needed.

### Step 1: Test direct VTT access

In a browser console on `www.theporadas.com`, run:

```js
fetch('https://media.wedding.theporadas.com/video/your-captions.vtt')
  .then(r => r.text())
  .then(console.log)
```

If it returns the VTT content without a CORS error, the proxy is no longer needed.

### Step 2: Update `src/utils/media.ts`

Remove the VTT proxy special-case:

```ts
// REMOVE:
if (path.endsWith('.vtt')) {
  return `/__vtt_proxy/${toRemoteMediaPath(path)}`
}
```

### Step 3: Remove the redirect from `netlify.toml`

```toml
# REMOVE:
[[redirects]]
  from = "/__vtt_proxy/*"
  to = "https://media.wedding.theporadas.com/:splat"
  status = 200
  force = true
```

### Step 4: Test the Film page

Open `/film` in the browser and verify captions still load and display correctly.

---

## Phase 6: Migrate Guest Uploads to R2

Currently, when guests upload photos via `/upload`, the files go directly to Supabase Storage. The `guest_uploads.photo_urls` column stores the full Supabase Storage URLs. This phase replaces that with R2.

This is more involved because it requires a server-side upload handler (you can't put R2 credentials in the browser). The approach: use a **Netlify serverless function** or **Supabase Edge Function** to generate a pre-signed R2 URL, then the browser uploads directly to R2.

### Architecture (New Guest Upload Flow)

```
Browser → POST /api/guest-upload-url → Netlify Function
                                         → generates R2 pre-signed URL
                                         ← returns { uploadUrl, objectKey, publicUrl }
Browser → PUT <uploadUrl> → R2 (direct, no server in the middle)
Browser → POST Supabase guest_uploads → saves publicUrl in photo_urls
```

### Step 1: Create the Netlify Function

Create `netlify/functions/guest-upload-url.ts`:

```ts
import type { Handler } from '@netlify/functions'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import crypto from 'node:crypto'

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
const MAX_SIZE_BYTES = 20 * 1024 * 1024 // 20 MB

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  let body: { contentType: string; contentLength: number; guestId: string }
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' }
  }

  const { contentType, contentLength, guestId } = body

  if (!ALLOWED_TYPES.has(contentType)) {
    return { statusCode: 400, body: 'Unsupported file type' }
  }

  if (contentLength > MAX_SIZE_BYTES) {
    return { statusCode: 400, body: 'File too large (max 20 MB)' }
  }

  const ext = contentType.split('/')[1].replace('jpeg', 'jpg')
  const objectKey = `guest-uploads/${guestId}/${crypto.randomUUID()}.${ext}`

  const command = new PutObjectCommand({
    Bucket: process.env.R2_MEDIA_BUCKET || 'wedding-media',
    Key: objectKey,
    ContentType: contentType,
    ContentLength: contentLength,
  })

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 }) // 5 min expiry

  const publicUrl = `${process.env.R2_PUBLIC_BASE_URL}/${objectKey}`

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uploadUrl, objectKey, publicUrl }),
  }
}
```

Install the presigner package:

```bash
npm install --save-dev @aws-sdk/s3-request-presigner
npm install @netlify/functions
```

### Step 2: Add R2 vars to Netlify environment

In **Netlify Dashboard → Site Settings → Environment Variables**, add:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_MEDIA_BUCKET`
- `R2_PUBLIC_BASE_URL`

These are server-only (not `VITE_` prefixed) so they never appear in the browser bundle.

### Step 3: Update the guest upload client code

In the guest upload page (likely `src/pages/Upload.tsx` or similar), change the upload logic:

```ts
// OLD: Upload directly to Supabase Storage
const { data, error } = await supabase.storage
  .from('wedding-media')
  .upload(`guest-uploads/${fileName}`, file)

// NEW: Get pre-signed URL from our function, then upload directly to R2
async function uploadToR2(file: File, guestId: string): Promise<string> {
  // 1. Get pre-signed URL
  const response = await fetch('/api/guest-upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contentType: file.type,
      contentLength: file.size,
      guestId,
    }),
  })

  if (!response.ok) throw new Error('Failed to get upload URL')

  const { uploadUrl, publicUrl } = await response.json()

  // 2. Upload directly to R2
  await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  })

  return publicUrl
}
```

### Step 4: Migrate existing guest upload URLs in the database

Existing approved photos have Supabase Storage URLs in `guest_uploads.photo_urls`. Either:

**Option A (recommended):** Keep existing Supabase URLs working by keeping Supabase Storage active for just the `guest-uploads/` prefix. New uploads go to R2; old ones stay on Supabase. This is zero-risk.

**Option B:** Migrate existing URLs with an rclone sync + SQL update:

```bash
# Copy guest-uploads prefix from Supabase to R2
rclone copy "supabase-storage:wedding-media/guest-uploads" \
  "r2:wedding-media/guest-uploads" \
  --progress

# Then run a SQL update to rewrite URLs in the database:
```

```sql
-- Replace Supabase Storage URLs with R2 URLs in photo_urls
-- Run in Supabase SQL editor
UPDATE guest_uploads
SET photo_urls = (
  SELECT array_agg(
    replace(
      url,
      'https://rxzbbtghnrvzubqrbhhx.supabase.co/storage/v1/object/public/wedding-media/',
      'https://media.wedding.theporadas.com/'
    )
  )
  FROM unnest(photo_urls) AS url
);
```

---

## Phase 7: Decommission Supabase Storage

Once you've verified R2 is working for all media paths and guest uploads (new + migrated), clean up Supabase Storage to stop any residual billing:

### Step 1: Delete objects from Supabase Storage

In Supabase Dashboard → Storage → wedding-media → select all → delete.

Or via the Supabase MCP:

```
mcp__execute_sql: DELETE FROM storage.objects WHERE bucket_id = 'wedding-media';
```

> **Warning:** Only do this after confirming all URLs in the app and database now point to R2.

### Step 2: Delete the bucket

In Supabase Dashboard → Storage → wedding-media → Delete bucket.

### Step 3: Remove Supabase Storage env var from `.env`

```bash
# Remove if present:
VITE_SUPABASE_MEDIA_BUCKET=wedding-media
```

Remove the Supabase service-role value only if it was used solely for storage uploads.
Keep it if you still use it for admin DB operations or edge functions. See
`docs/archival/SECURITY.md` for secret-handling rules.

---

## Environment Variables Reference

### Before (current)

| Variable                    | Where Used                  |
| --------------------------- | --------------------------- |
| `VITE_SUPABASE_URL`         | App + upload script         |
| `VITE_SUPABASE_ANON_KEY`    | App (database)              |
| `VITE_MEDIA_BASE_URL`       | App (video/audio paths)     |
| `SUPABASE_SERVICE_ROLE_KEY` | Upload script, admin DB ops |
| `SUPABASE_MEDIA_BUCKET`     | Upload script               |

### After (R2 migration complete)

| Variable                    | Where Used                      |
| --------------------------- | ------------------------------- |
| `VITE_SUPABASE_URL`         | App (database only)             |
| `VITE_SUPABASE_ANON_KEY`    | App (database only)             |
| `VITE_MEDIA_BASE_URL`       | App (all media paths — now R2)  |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin DB ops only               |
| `R2_ACCOUNT_ID`             | Upload script, Netlify function |
| `R2_ACCESS_KEY_ID`          | Upload script, Netlify function |
| `R2_SECRET_ACCESS_KEY`      | Upload script, Netlify function |
| `R2_MEDIA_BUCKET`           | Upload script, Netlify function |
| `R2_PUBLIC_BASE_URL`        | Upload script                   |

---

## Code Changes Summary

| File                                    | Change                                                                                                             |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `src/utils/media.ts`                    | Remove Supabase Storage direct URL construction for `/media/` prefix; all media goes through `VITE_MEDIA_BASE_URL` |
| `scripts/upload-remote-media.js`        | Replace `tus-js-client` + Supabase with `@aws-sdk/client-s3` + R2                                                  |
| `netlify/functions/guest-upload-url.ts` | New — generates R2 pre-signed URLs for guest photo uploads                                                         |
| `src/pages/Upload.tsx` (or equivalent)  | Update to use `/api/guest-upload-url` + direct PUT to R2                                                           |
| `netlify.toml`                          | Remove `/__vtt_proxy/` redirect (Phase 5)                                                                          |
| `.env`                                  | Add R2 vars, remove Supabase storage vars                                                                          |

---

## Rollback Plan

If anything goes wrong during Phase 4 (app code + env var update), rollback is trivial:

1. Revert the `VITE_MEDIA_BASE_URL` change in Netlify environment variables
2. Revert `src/utils/media.ts` to the version with Supabase Storage routing for `/media/`
3. Deploy

The files are still in Supabase Storage (you don't delete them until Phase 7), so reverting restores full functionality immediately.

---

## Timeline

```
Day 1 (setup + migration):
  Phase 1: Create R2 bucket + CORS (20 min)
  Phase 2: rclone migration (30 min setup + transfer time)
  Phase 3: Update upload script (45 min)
  Phase 4: Update app code + deploy (30 min)
  Phase 5: Remove VTT proxy (15 min) — optional

Day 2+ (guest uploads):
  Phase 6: Netlify function + upload page update (2 hr)
  Phase 7: Decommission Supabase Storage (10 min)
```

You get 80% of the savings (eliminating bandwidth costs for all static media) after Day 1. Phase 6 is a nice-to-have that completes the migration.
