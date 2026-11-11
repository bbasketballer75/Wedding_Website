/**
 * Pixel and text diffing without pixelmatch/pngjs.
 *
 * PNGs are decoded to raw RGB through the repo's existing `sharp`
 * devDependency, compared in memory with a pixelmatch-compatible colour metric
 * (YIQ-weighted, threshold in 0..1), and re-encoded to diff PNGs through
 * sharp. No new dependencies, no media copies.
 *
 * Metric notes (documented in docs/rebuild/PARITY.md):
 *  - a pixel counts as "changed" when delta > 35215 * pixelThreshold^2 where
 *    delta is pixelmatch's 0.5053*y^2 + 0.299*i^2 + 0.1957*q^2 YIQ delta
 *  - anti-aliasing detection is intentionally NOT implemented: deterministic
 *    captures (fixed browser, same machine) render identical AA, so AA
 *    heuristics would only hide real sub-pixel drift
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { HarnessError, formatRatio, normalizeText } from './util.mjs'

/** pixelmatch's maximum possible squared delta, used to normalise the threshold. */
const MAX_DELTA = 35215

export async function decodePng(file) {
  let result
  try {
    result = await sharp(file)
      .removeAlpha()
      .toColourspace('srgb')
      .raw()
      .toBuffer({ resolveWithObject: true })
  } catch (error) {
    throw new HarnessError(`Could not decode PNG ${file}: ${error.message}`, { cause: error })
  }
  const { data, info } = result
  if (info.channels !== 3) {
    throw new HarnessError(`Unexpected channel count ${info.channels} while decoding ${file}`)
  }
  return { file, data, width: info.width, height: info.height }
}

/**
 * YIQ-weighted per-pixel colour delta (pixelmatch's formula).
 * `dr/dg/db` are differences in 0..255 space.
 */
export function colourDelta(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2
  const dg = g1 - g2
  const db = b1 - b2
  const y = 0.29889531 * dr + 0.58662247 * dg + 0.11448223 * db
  const i = 0.59597799 * dr - 0.2741761 * dg - 0.32180189 * db
  const q = 0.21147017 * dr - 0.52261711 * dg + 0.31114694 * db
  return 0.5053 * y * y + 0.299 * i * i + 0.1957 * q * q
}

/**
 * Decide whether the pixel at (x, y) of the legacy image counts as changed.
 *
 * Exact mode (`edgeTolerance = 0`): the same-position rebuild pixel must be
 * within the colour threshold.
 *
 * Edge-raster tolerance (`edgeTolerance >= 1`): a same-position mismatch is
 * also forgiven when ANY rebuild pixel within the +/-N px Chebyshev
 * neighbourhood is under the same colour threshold. N=1 forgives a one-pixel
 * raster phase (e.g. `backdrop-filter` surfaces snapped to fractional edges)
 * without hiding sub-2px feature changes: moved/removed/changed content still
 * differs outside that neighbourhood. The neighbourhood is searched in the
 * other image only — that is what a raster phase/shift looks like.
 */
function pixelIsChanged(legacy, rebuild, width, height, x, y, maxDelta, edgeTolerance) {
  const offset = (y * width + x) * 3
  const r1 = legacy.data[offset]
  const g1 = legacy.data[offset + 1]
  const b1 = legacy.data[offset + 2]
  const r2 = rebuild.data[offset]
  const g2 = rebuild.data[offset + 1]
  const b2 = rebuild.data[offset + 2]
  if (r1 === r2 && g1 === g2 && b1 === b2) return { changed: false, maxChannelDelta: 0 }
  const channelDelta = Math.max(Math.abs(r1 - r2), Math.abs(g1 - g2), Math.abs(b1 - b2))
  if (colourDelta(r1, g1, b1, r2, g2, b2) <= maxDelta) {
    return { changed: false, maxChannelDelta: channelDelta }
  }
  if (edgeTolerance <= 0) return { changed: true, maxChannelDelta: channelDelta }
  const startY = Math.max(0, y - edgeTolerance)
  const endY = Math.min(height - 1, y + edgeTolerance)
  const startX = Math.max(0, x - edgeTolerance)
  const endX = Math.min(width - 1, x + edgeTolerance)
  for (let ny = startY; ny <= endY; ny += 1) {
    for (let nx = startX; nx <= endX; nx += 1) {
      if (nx === x && ny === y) continue
      const neighbourOffset = (ny * width + nx) * 3
      const nr = rebuild.data[neighbourOffset]
      const ng = rebuild.data[neighbourOffset + 1]
      const nb = rebuild.data[neighbourOffset + 2]
      if (colourDelta(r1, g1, b1, nr, ng, nb) <= maxDelta) {
        return { changed: false, maxChannelDelta: channelDelta }
      }
    }
  }
  return { changed: true, maxChannelDelta: channelDelta }
}

/**
 * Compare two decoded RGB images of identical size.
 * `edgeTolerance` defaults to 0 (exact per-pixel comparison); pass 1 for the
 * documented edge-raster tolerance mode.
 * @returns {{changedPixels:number,totalPixels:number,ratio:number,maxChannelDelta:number,boundingBox:object|null,edgeTolerance:number}}
 */
export function compareDecoded(legacy, rebuild, { pixelThreshold = 0.12, edgeTolerance = 0 } = {}) {
  if (legacy.width !== rebuild.width || legacy.height !== rebuild.height) {
    throw new HarnessError(
      `Image dimensions differ: legacy ${legacy.width}x${legacy.height} vs rebuild ${rebuild.width}x${rebuild.height}`
    )
  }
  const width = legacy.width
  const height = legacy.height
  const totalPixels = width * height
  const maxDelta = MAX_DELTA * pixelThreshold * pixelThreshold
  let changedPixels = 0
  let maxChannelDelta = 0
  let minX = Infinity
  let minY = Infinity
  let maxX = -1
  let maxY = -1
  for (let pixel = 0; pixel < totalPixels; pixel += 1) {
    const x = pixel % width
    const y = Math.floor(pixel / width)
    const verdict = pixelIsChanged(legacy, rebuild, width, height, x, y, maxDelta, edgeTolerance)
    if (verdict.maxChannelDelta > maxChannelDelta) maxChannelDelta = verdict.maxChannelDelta
    if (!verdict.changed) continue
    changedPixels += 1
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  return {
    changedPixels,
    totalPixels,
    ratio: totalPixels === 0 ? 0 : changedPixels / totalPixels,
    maxChannelDelta,
    boundingBox:
      changedPixels > 0
        ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
        : null,
    edgeTolerance,
  }
}

/** Write a diff PNG: unchanged pixels dimmed legacy, changed pixels magenta. */
export function buildDiffRaw(legacy, rebuild, { pixelThreshold = 0.12, edgeTolerance = 0 } = {}) {
  const { data, width, height } = legacy
  const diff = Buffer.alloc(width * height * 3)
  const maxDelta = MAX_DELTA * pixelThreshold * pixelThreshold
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const offset = pixel * 3
    const x = pixel % width
    const y = Math.floor(pixel / width)
    const verdict = pixelIsChanged(legacy, rebuild, width, height, x, y, maxDelta, edgeTolerance)
    if (verdict.changed) {
      diff[offset] = 255
      diff[offset + 1] = 0
      diff[offset + 2] = 255
    } else {
      diff[offset] = Math.round(data[offset] * 0.35)
      diff[offset + 1] = Math.round(data[offset + 1] * 0.35)
      diff[offset + 2] = Math.round(data[offset + 2] * 0.35)
    }
  }
  return { data: diff, width, height }
}

async function writeRawPng({ data, width, height }, file) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await sharp(data, { raw: { width, height, channels: 3 } })
    .png({ compressionLevel: 6 })
    .toFile(file)
}

/**
 * Compare one logical shot: every slice pair, then aggregate.
 * Writes one diff PNG per slice into `diffDir`.
 */
export async function compareShotSlices({
  legacyFiles,
  rebuildFiles,
  diffDir,
  key,
  pixelThreshold = 0.12,
  edgeTolerance = 0,
}) {
  const sliceResults = []
  let changedPixels = 0
  let totalPixels = 0
  let maxChannelDelta = 0
  let sizeMismatch = false
  const sliceCountMismatch = legacyFiles.length !== rebuildFiles.length
  const boundingBox = { x: Infinity, y: Infinity, width: 0, height: 0, maxX: -1, maxY: -1 }

  const sliceCount = Math.max(legacyFiles.length, rebuildFiles.length)
  for (let index = 0; index < sliceCount; index += 1) {
    const legacyFile = legacyFiles[index]
    const rebuildFile = rebuildFiles[index]
    const diffFile = path.join(diffDir, `${key}--s${String(index).padStart(3, '0')}.png`)
    if (!legacyFile || !rebuildFile) {
      sliceResults.push({
        slice: index,
        status: 'slice-missing',
        diffFile: null,
        changedPixels: null,
        totalPixels: null,
        ratio: null,
      })
      sizeMismatch = true
      continue
    }
    const legacy = await decodePng(legacyFile)
    const rebuild = await decodePng(rebuildFile)
    if (legacy.width !== rebuild.width || legacy.height !== rebuild.height) {
      sizeMismatch = true
      const mismatched = buildDiffRaw(
        legacy,
        { data: legacy.data, width: legacy.width, height: legacy.height },
        { pixelThreshold }
      )
      const { data, width, height } = mismatched
      // Dimension mismatch: paint the dimmed legacy slice red-ish so the report
      // makes the mismatch obvious without inventing a comparison.
      for (let pixel = 0; pixel < width * height; pixel += 1) {
        const offset = pixel * 3
        data[offset] = Math.min(255, data[offset] + 120)
        data[offset + 1] = Math.round(data[offset + 1] * 0.5)
        data[offset + 2] = Math.round(data[offset + 2] * 0.5)
      }
      await writeRawPng({ data, width, height }, diffFile)
      sliceResults.push({
        slice: index,
        status: 'size-mismatch',
        diffFile,
        legacy: { width: legacy.width, height: legacy.height },
        rebuild: { width: rebuild.width, height: rebuild.height },
        changedPixels: null,
        totalPixels: null,
        ratio: null,
      })
      continue
    }
    const metrics = compareDecoded(legacy, rebuild, { pixelThreshold, edgeTolerance })
    const diffRaw = buildDiffRaw(legacy, rebuild, { pixelThreshold, edgeTolerance })
    await writeRawPng(diffRaw, diffFile)
    changedPixels += metrics.changedPixels
    totalPixels += metrics.totalPixels
    maxChannelDelta = Math.max(maxChannelDelta, metrics.maxChannelDelta)
    if (metrics.boundingBox) {
      boundingBox.x = Math.min(boundingBox.x, metrics.boundingBox.x)
      boundingBox.y = Math.min(boundingBox.y, metrics.boundingBox.y)
      boundingBox.maxX = Math.max(
        boundingBox.maxX,
        metrics.boundingBox.x + metrics.boundingBox.width
      )
      boundingBox.maxY = Math.max(
        boundingBox.maxY,
        metrics.boundingBox.y + metrics.boundingBox.height
      )
    }
    sliceResults.push({
      slice: index,
      status: metrics.changedPixels === 0 ? 'identical' : 'diff',
      diffFile,
      changedPixels: metrics.changedPixels,
      totalPixels: metrics.totalPixels,
      ratio: metrics.ratio,
      maxChannelDelta: metrics.maxChannelDelta,
      boundingBox: metrics.boundingBox,
    })
  }
  const ratio = totalPixels === 0 ? 0 : changedPixels / totalPixels
  return {
    changedPixels,
    totalPixels,
    ratio,
    maxChannelDelta,
    edgeTolerance,
    sliceCountMismatch,
    sizeMismatch,
    sliceResults,
    boundingBox:
      boundingBox.maxX < 0
        ? null
        : {
            x: boundingBox.x,
            y: boundingBox.y,
            width: boundingBox.maxX - boundingBox.x,
            height: boundingBox.maxY - boundingBox.y,
          },
  }
}

/**
 * Diff-level perturbation for selfcheck: copy a screenshot, paint a magenta
 * patch plus a border, and return the metrics of comparing the two. Proves the
 * diff threshold actually detects a known change.
 */
export async function perturbPng(
  sourceFile,
  targetFile,
  { pixelThreshold = 0.12, edgeTolerance = 0 } = {}
) {
  const source = await decodePng(sourceFile)
  const data = Buffer.from(source.data)
  const paint = (x, y) => {
    const offset = (y * source.width + x) * 3
    data[offset] = 255
    data[offset + 1] = 0
    data[offset + 2] = 255
  }
  const border = 3
  for (let x = 0; x < source.width; x += 1) {
    for (let t = 0; t < border; t += 1) {
      paint(x, t)
      paint(x, source.height - 1 - t)
    }
  }
  for (let y = 0; y < source.height; y += 1) {
    for (let t = 0; t < border; t += 1) {
      paint(t, y)
      paint(source.width - 1 - t, y)
    }
  }
  const patchWidth = Math.max(24, Math.floor(source.width * 0.06))
  const patchHeight = Math.max(24, Math.floor(source.height * 0.06))
  const startX = Math.floor((source.width - patchWidth) / 2)
  const startY = Math.floor((source.height - patchHeight) / 2)
  for (let y = startY; y < startY + patchHeight; y += 1) {
    for (let x = startX; x < startX + patchWidth; x += 1) paint(x, y)
  }
  await writeRawPng({ data, width: source.width, height: source.height }, targetFile)
  const perturbed = await decodePng(targetFile)
  const metrics = compareDecoded(source, perturbed, { pixelThreshold, edgeTolerance })
  return { ...metrics, file: targetFile, ratioLabel: formatRatio(metrics.ratio) }
}

/* ------------------------------------------------------------------ */
/* Text / DOM contract diff                                            */
/* ------------------------------------------------------------------ */

function serializeMeta(meta) {
  return Object.keys(meta ?? {})
    .sort()
    .map(key => `meta:${key}=${normalizeText(meta[key])}`)
    .join('\n')
}

function serializeLines(lines) {
  return lines.map(line => normalizeText(line)).join('\n')
}

/**
 * Semantic DOM/text comparison of the two text payloads for one shot.
 * Returns { status: 'pass'|'fail', differences: [...] }.
 */
export function compareTextPayloads(legacy, rebuild) {
  const differences = []
  const push = (field, legacyValue, rebuildValue) => {
    differences.push({ field, legacy: legacyValue, rebuild: rebuildValue })
  }
  if (!legacy || !rebuild) {
    push('payload', legacy ? 'present' : 'missing', rebuild ? 'present' : 'missing')
    return { status: 'fail', differences }
  }
  if (legacy.title !== rebuild.title) push('title', legacy.title, rebuild.title)
  if (legacy.lang !== rebuild.lang) push('lang', legacy.lang, rebuild.lang)
  if (legacy.canonical !== rebuild.canonical) push('canonical', legacy.canonical, rebuild.canonical)

  const legacyMeta = serializeMeta(legacy.meta)
  const rebuildMeta = serializeMeta(rebuild.meta)
  if (legacyMeta !== rebuildMeta) {
    const legacyKeys = new Set(Object.keys(legacy.meta ?? {}))
    const rebuildKeys = new Set(Object.keys(rebuild.meta ?? {}))
    for (const key of new Set([...legacyKeys, ...rebuildKeys])) {
      if (normalizeText(legacy.meta?.[key]) !== normalizeText(rebuild.meta?.[key])) {
        push(`meta.${key}`, legacy.meta?.[key] ?? null, rebuild.meta?.[key] ?? null)
      }
    }
  }

  const legacyHeadings = serializeLines(
    legacy.headings.map(heading => `h${heading.level}:${heading.text}`)
  )
  const rebuildHeadings = serializeLines(
    rebuild.headings.map(heading => `h${heading.level}:${heading.text}`)
  )
  if (legacyHeadings !== rebuildHeadings) {
    push(
      'headings',
      legacy.headings.map(heading => `h${heading.level}: ${heading.text}`),
      rebuild.headings.map(heading => `h${heading.level}: ${heading.text}`)
    )
  }

  const legacyLinks = serializeLines(
    legacy.links.map(link => `${link.href}|${link.text}|${link.ariaLabel}`)
  )
  const rebuildLinks = serializeLines(
    rebuild.links.map(link => `${link.href}|${link.text}|${link.ariaLabel}`)
  )
  if (legacyLinks !== rebuildLinks) {
    push(
      'links',
      legacy.links.map(link => `${link.text} → ${link.href}`),
      rebuild.links.map(link => `${link.text} → ${link.href}`)
    )
  }

  const legacyImages = serializeLines(
    legacy.images.map(image => `${image.src}|${image.alt}|${image.loading}`)
  )
  const rebuildImages = serializeLines(
    rebuild.images.map(image => `${image.src}|${image.alt}|${image.loading}`)
  )
  if (legacyImages !== rebuildImages) {
    push(
      'images',
      legacy.images.map(image => `${image.alt} → ${image.src} (${image.loading})`),
      rebuild.images.map(image => `${image.alt} → ${image.src} (${image.loading})`)
    )
  }

  const legacyLines = legacy.bodyText.split('\n')
  const rebuildLines = rebuild.bodyText.split('\n')
  if (legacy.bodyText !== rebuild.bodyText) {
    let firstDifference = -1
    const max = Math.max(legacyLines.length, rebuildLines.length)
    for (let index = 0; index < max; index += 1) {
      if (legacyLines[index] !== rebuildLines[index]) {
        firstDifference = index
        break
      }
    }
    push('bodyText', legacyLines, rebuildLines)
    return {
      status: 'fail',
      differences,
      bodyText: {
        legacyLines: legacyLines.length,
        rebuildLines: rebuildLines.length,
        firstDifferenceLine: firstDifference,
        context: {
          legacy: legacyLines.slice(Math.max(0, firstDifference - 3), firstDifference + 6),
          rebuild: rebuildLines.slice(Math.max(0, firstDifference - 3), firstDifference + 6),
        },
      },
    }
  }
  return { status: differences.length === 0 ? 'pass' : 'fail', differences }
}
