const sharp = require('sharp')
const fs = require('fs')
const dir = 'tools/parity/output/w9-matrix-final4/shots'
async function decode(file) {
  const { data, info } = await sharp(file).removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}
async function sample(key, slice, maxSamples = 12) {
  const legacy = await decode(`${dir}/legacy/${key}--s${String(slice).padStart(3, '0')}.png`)
  const rebuild = await decode(`${dir}/rebuild/${key}--s${String(slice).padStart(3, '0')}.png`)
  let shown = 0
  const stats = { total: 0, deltas: [] }
  for (let p = 0; p < legacy.width * legacy.height; p++) {
    const o = p * 3
    const dr = Math.abs(legacy.data[o] - rebuild.data[o])
    const dg = Math.abs(legacy.data[o + 1] - rebuild.data[o + 1])
    const db = Math.abs(legacy.data[o + 2] - rebuild.data[o + 2])
    const delta = Math.max(dr, dg, db)
    if (delta < 12) continue
    stats.total++
    stats.deltas.push(delta)
    if (shown < maxSamples) {
      const x = p % legacy.width
      const y = Math.floor(p / legacy.width)
      console.log(`  (${x},${y}) legacy=${legacy.data[o]},${legacy.data[o+1]},${legacy.data[o+2]} rebuild=${rebuild.data[o]},${rebuild.data[o+1]},${rebuild.data[o+2]} maxdelta=${delta}`)
      shown++
    }
  }
  stats.deltas.sort((a, b) => a - b)
  const median = stats.deltas.length ? stats.deltas[Math.floor(stats.deltas.length / 2)] : 0
  const p90 = stats.deltas.length ? stats.deltas[Math.floor(stats.deltas.length * 0.9)] : 0
  console.log(`  ${key} slice ${slice}: changed-ish pixels=${stats.total}, median maxChannelDelta=${median}, p90=${p90}, max=${stats.deltas[stats.deltas.length - 1] ?? 0}`)
}
;(async () => {
  console.log('=== guestbook slice 2')
  await sample('guestbook__desktop__dark', 2)
  console.log('=== admin slice 2')
  await sample('admin__desktop__dark', 2)
  console.log('=== gallery slice 1')
  await sample('gallery__desktop__dark', 1)
})()
