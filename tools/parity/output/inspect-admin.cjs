const fs = require('fs')
const path = 'tools/parity/output/admin-smoke/text'
for (const side of ['legacy', 'rebuild']) {
  const file = path + '/' + side + '/admin-photos__desktop__dark.json'
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  console.log('===', side, 'title:', data.title)
  console.log(data.bodyText.slice(0, 700).replace(/\n/g, ' | '))
}
const diff = JSON.parse(fs.readFileSync('tools/parity/output/admin-smoke/text/diff/admin-photos__desktop__dark.json', 'utf8'))
console.log('=== first text differences fields:', diff.differences.map(d => d.field).slice(0, 5))
console.log('bodyText context:', JSON.stringify(diff.bodyText?.context ?? null).slice(0, 800))
