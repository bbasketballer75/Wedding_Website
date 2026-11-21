const fs = require('fs')
const path = require('path')
for (const f of fs.readdirSync('rebuild/dist/assets')) {
  if (!f.endsWith('.js')) continue
  const text = fs.readFileSync(path.join('rebuild/dist/assets', f), 'utf8')
  const i = text.indexOf('sb-zaczcyzvavetgfuucljf-auth-token')
  if (i >= 0) {
    console.log('file:', f)
    console.log('context:', text.slice(Math.max(0, i - 220), i + 220).replace(/\n/g, ' '))
  }
}
