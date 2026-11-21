const fs = require('fs')
const dir = 'tools/parity/output/w9-matrix-final4'
const summary = JSON.parse(fs.readFileSync(dir + '/summary.json', 'utf8'))
for (const key of ['gallery__desktop__dark', 'guestbook__desktop__dark', 'admin__desktop__dark', 'admin-login__desktop__dark']) {
  const shot = summary.shots.find(s => s.key === key)
  console.log('===', key)
  for (const slice of shot.pixelDiff.slices) {
    if (slice.changedPixels > 0) console.log('  window', slice.slice, 'changed', slice.changedPixels, 'bbox', JSON.stringify(slice.boundingBox))
  }
}
