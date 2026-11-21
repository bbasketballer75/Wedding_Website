const fs = require('fs')
const dir = 'tools/parity/output/admin-smoke/shots/diff'
const files = fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort()
const summary = JSON.parse(fs.readFileSync('tools/parity/output/admin-smoke/summary.json', 'utf8'))
const slices = summary.shots[0].pixelDiff.slices
slices.forEach((s, i) => console.log(i, s.status, s.changedPixels, s.ratio, JSON.stringify(s.boundingBox)))
console.log('first diff slice file:', files[0])
console.log('legacy/rebuild shots:', summary.shots[0].files.legacy, summary.shots[0].files.rebuild)
