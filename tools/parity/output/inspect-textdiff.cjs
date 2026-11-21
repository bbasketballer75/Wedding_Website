const fs = require('fs')
const dir = 'tools/parity/output/w9-matrix-final2/text/diff'
for (const key of ['home__desktop__dark', 'activity__desktop__dark', 'gallery__desktop__dark', 'guest-token__desktop__dark', 'not-found__desktop__dark', 'admin-login__desktop__dark']) {
  const file = dir + '/' + key + '.json'
  if (!fs.existsSync(file)) continue
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  console.log('===', key)
  for (const difference of data.differences) {
    const legacy = JSON.stringify(difference.legacy)
    const rebuild = JSON.stringify(difference.rebuild)
    console.log(' ', difference.field, '| legacy:', legacy.slice(0, 160), '| rebuild:', rebuild.slice(0, 160))
  }
}
