const fs = require('fs')
const dir = 'tools/parity/output/w9-matrix-final4'
const summary = JSON.parse(fs.readFileSync(dir + '/summary.json', 'utf8'))
for (const shot of summary.shots) {
  if (!['admin-login__desktop__dark', 'admin__desktop__dark'].includes(shot.key)) continue
  const diffFile = dir + '/text/diff/' + shot.key + '.json'
  console.log('===', shot.key, '| textDiff status', shot.textDiff.status, '| pixel ratio', shot.pixelDiff.ratio)
  if (!fs.existsSync(diffFile)) continue
  const diff = JSON.parse(fs.readFileSync(diffFile, 'utf8'))
  for (const d of diff.differences) {
    console.log('  ', d.field, '| legacy:', JSON.stringify(d.legacy).slice(0, 150), '| rebuild:', JSON.stringify(d.rebuild).slice(0, 150))
  }
}
