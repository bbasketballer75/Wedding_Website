const fs = require('fs')
for (const side of ['legacy', 'rebuild']) {
  const file = `tools/parity/output/gallery-repro/text/${side}/gallery__desktop__dark.json`
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  console.log(side, '=> title:', data.title, '| twitter:', data.meta['twitter:title'])
}
