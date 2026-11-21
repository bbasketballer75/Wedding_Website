const fs = require('fs')
const path = require('path')
function scan(dir, label) {
  const out = new Set()
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f)
    if (!fs.statSync(p).isFile() || !f.endsWith('.js')) continue
    const text = fs.readFileSync(p, 'utf8')
    const m = text.match(/[a-z0-9]{20}\.supabase\.co/g) || []
    for (const x of m) out.add(x)
  }
  console.log(label, '=>', [...out].slice(0, 5).join(', '))
}
scan('dist/assets', 'legacy')
scan('rebuild/dist/assets', 'rebuild')
const legacyIndex = fs.readFileSync('dist/index.html', 'utf8')
const rebuildIndex = fs.readFileSync('rebuild/dist/index.html', 'utf8')
const m1 = legacyIndex.match(/dns-prefetch" href="https:\/\/([^"]+)/)
const m2 = rebuildIndex.match(/(?:dns-prefetch|preconnect)" href="https:\/\/([^"]+)/)
console.log('legacy index host:', m1 ? m1[1] : 'none')
console.log('rebuild index host:', m2 ? m2[1] : 'none')
