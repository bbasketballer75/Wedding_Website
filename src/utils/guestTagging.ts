import JSZip from 'jszip'
import { getMediaPath } from '@/utils/media'

export interface GuestTaggingManifestItem {
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

export interface GuestTaggingManifest {
  batchKey: string
  label: string
  createdAt: string
  exportableUploadCount: number
  exportablePhotoCount: number
  items: GuestTaggingManifestItem[]
}

export interface GuestTaggingFace {
  id: string
  name: string
  x: number
  y: number
  box: {
    left: number
    top: number
    width: number
    height: number
  } | null
}

export interface GuestTaggingSyncUpdate {
  photoId: string
  url: string
  filename: string
  faces: GuestTaggingFace[]
}

export interface GuestTaggingSyncPayload {
  batchKey: string
  label: string
  createdAt: string
  updates: GuestTaggingSyncUpdate[]
}

const MWG_FACE_REGEX =
  /<rdf:Description\b[^>]*mwg-rs:Name="([^"]+)"[^>]*mwg-rs:Type="Face"[^>]*>\s*<mwg-rs:Area\b[^>]*stArea:x="([^"]+)"[^>]*stArea:y="([^"]+)"[^>]*stArea:w="([^"]+)"[^>]*stArea:h="([^"]+)"[^>]*\/>/g
const MPREG_FACE_REGEX =
  /<rdf:li\b[^>]*MPReg:PersonDisplayName="([^"]+)"[^>]*MPReg:Rectangle="([^"]+)"/g

function decodeXml(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim()
}

function numberFromText(value: string) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function extractEmbeddedXmpText(bytes: Uint8Array) {
  const startToken = new TextEncoder().encode('<x:xmpmeta')
  const endToken = new TextEncoder().encode('</x:xmpmeta>')

  function indexOfToken(token: Uint8Array) {
    outer: for (let index = 0; index <= bytes.length - token.length; index += 1) {
      for (let offset = 0; offset < token.length; offset += 1) {
        if (bytes[index + offset] !== token[offset]) {
          continue outer
        }
      }

      return index
    }

    return -1
  }

  const start = indexOfToken(startToken)
  if (start < 0) return null

  const end = indexOfToken(endToken)
  if (end <= start) return null

  return new TextDecoder().decode(bytes.slice(start, end + endToken.length))
}

function parseDigikamFaces(metadataText: string) {
  const faces: Array<{ name: string; x: number; y: number; width: number; height: number }> = []
  const seen = new Set<string>()
  let match: RegExpExecArray | null

  while ((match = MWG_FACE_REGEX.exec(metadataText)) !== null) {
    const [, rawName, rawX, rawY, rawWidth, rawHeight] = match
    const name = decodeXml(rawName)
    const x = numberFromText(rawX)
    const y = numberFromText(rawY)
    const width = numberFromText(rawWidth)
    const height = numberFromText(rawHeight)
    if (!name || x == null || y == null || width == null || height == null) continue

    const key = `${name}:${x}:${y}:${width}:${height}`
    if (seen.has(key)) continue
    seen.add(key)
    faces.push({ name, x, y, width, height })
  }

  while ((match = MPREG_FACE_REGEX.exec(metadataText)) !== null) {
    const [, rawName, rawRectangle] = match
    const name = decodeXml(rawName)
    const [xText, yText, widthText, heightText] = rawRectangle.split(',').map(value => value.trim())
    const x = numberFromText(xText)
    const y = numberFromText(yText)
    const width = numberFromText(widthText)
    const height = numberFromText(heightText)
    if (!name || x == null || y == null || width == null || height == null) continue

    const key = `${name}:${x}:${y}:${width}:${height}`
    if (seen.has(key)) continue
    seen.add(key)
    faces.push({ name, x, y, width, height })
  }

  return faces
}

async function getImageDimensions(file: File) {
  try {
    const bitmap = await createImageBitmap(file)
    const dimensions = {
      width: bitmap.width,
      height: bitmap.height,
    }
    bitmap.close()
    return dimensions
  } catch {
    return null
  }
}

async function parseTaggedFileFaces(file: File, sidecarFile?: File | null) {
  const parts: string[] = []

  if (sidecarFile) {
    parts.push(await sidecarFile.text())
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const embeddedXmp = extractEmbeddedXmpText(bytes)
  if (embeddedXmp) {
    parts.push(embeddedXmp)
  }

  const metadataText = parts.join('\n')
  if (!metadataText.trim()) {
    return []
  }

  const parsedFaces = parseDigikamFaces(metadataText)
  if (parsedFaces.length === 0) {
    return []
  }

  const dimensions = await getImageDimensions(file)

  return parsedFaces.map((face, index) => {
    const x = Number((face.x * 100).toFixed(2))
    const y = Number((face.y * 100).toFixed(2))

    const box = dimensions
      ? {
          left: Number(
            clamp((face.x - face.width / 2) * dimensions.width, 0, dimensions.width).toFixed(2)
          ),
          top: Number(
            clamp((face.y - face.height / 2) * dimensions.height, 0, dimensions.height).toFixed(2)
          ),
          width: Number((face.width * dimensions.width).toFixed(2)),
          height: Number((face.height * dimensions.height).toFixed(2)),
        }
      : null

    return {
      id: `${file.name}-${index + 1}`,
      name: face.name,
      x,
      y,
      box,
    }
  })
}

function findManifestFile(files: File[]) {
  return files.find(file => file.name === 'guest-tagging-manifest.json') ?? null
}

function getSidecarCandidates(filename: string) {
  return [`${filename}.xmp`.toLowerCase(), `${filename.replace(/\.[^.]+$/, '')}.xmp`.toLowerCase()]
}

export async function buildGuestTaggingSyncPayloadFromFiles(files: FileList | File[]) {
  const fileArray = Array.from(files)
  const manifestFile = findManifestFile(fileArray)

  if (!manifestFile) {
    throw new Error('Select the tagged folder contents including guest-tagging-manifest.json.')
  }

  const manifest = JSON.parse(await manifestFile.text()) as GuestTaggingManifest
  const filesByName = new Map(fileArray.map(file => [file.name.toLowerCase(), file]))
  const updates: GuestTaggingSyncUpdate[] = []

  for (const item of manifest.items) {
    const imageFile = filesByName.get(item.filename.toLowerCase())
    if (!imageFile) continue

    const sidecar =
      getSidecarCandidates(item.filename)
        .map(candidate => filesByName.get(candidate) ?? null)
        .find(Boolean) ?? null

    const faces = await parseTaggedFileFaces(imageFile, sidecar)
    if (faces.length === 0) continue

    updates.push({
      photoId: item.photoId,
      url: item.url,
      filename: item.filename,
      faces,
    })
  }

  return {
    batchKey: manifest.batchKey,
    label: manifest.label,
    createdAt: manifest.createdAt,
    updates,
  } satisfies GuestTaggingSyncPayload
}

export async function downloadGuestTaggingBatchZip(
  manifest: GuestTaggingManifest,
  onProgress?: (completed: number, total: number) => void
) {
  const zip = new JSZip()
  zip.file('guest-tagging-manifest.json', JSON.stringify(manifest, null, 2))

  let completed = 0
  const total = manifest.items.length

  for (const item of manifest.items) {
    const response = await fetch(getMediaPath(item.url))
    if (!response.ok) {
      throw new Error(`Could not download ${item.filename}.`)
    }

    const blob = await response.blob()
    zip.file(`organized/${item.relativePath}`, blob)
    completed += 1
    onProgress?.(completed, total)
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' })
  const downloadUrl = URL.createObjectURL(zipBlob)
  const anchor = document.createElement('a')
  anchor.href = downloadUrl
  anchor.download = `${manifest.batchKey}.zip`
  anchor.click()
  URL.revokeObjectURL(downloadUrl)
}
