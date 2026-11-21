const fs = require('fs')
const dir = 'tools/parity/output/w9-matrix-final3'
const summary = JSON.parse(fs.readFileSync(dir + '/summary.json', 'utf8'))
for (const shot of summary.shots) {
  if (!['gallery__desktop__dark', 'guestbook__desktop__dark', 'guest-token__desktop__dark', 'admin__desktop__dark'].includes(shot.key)) continue
  console.log('===', shot.key, '| status', shot.status, '| ratio', shot.pixelDiff?.ratio)
  if (shot.pixelDiff?.boundingBox) console.log('   pixel bbox:', JSON.stringify(shot.pixelDiff.boundingBox), 'changed windows:', shot.pixelDiff.slices.filter(s => s.changedPixels > 0).map(s => `${s.slice}:${s.changedPixels}px`).join(', '))
  const textDiffFile = dir + '/text/diff/' + shot.key + '.json'
  if (fs.existsSync(textDiffFile)) {
    const diff = JSON.parse(fs.readFileSync(textDiffFile, 'utf8'))
    for (const d of diff.differences.slice(0, 8)) {
      console.log('   text', d.field, '| legacy:', JSON.stringify(d.legacy).slice(0, 130), '| rebuild:', JSON.stringify(d.rebuild).slice(0, 130))
    }
  }
}
