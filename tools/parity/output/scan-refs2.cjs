const fs = require('fs')
const path = require('path')
const urls = new Set()
for (const f of fs.readdirSync('rebuild/dist/assets')) {
  if (!f.endsWith('.js')) continue
  const text = fs.readFileSync(path.join('rebuild/dist/assets', f), 'utf8')
  for (const m of text.match(/https:\/\/[a-z0-9.-]*supabase[a-z0-9./-]*/gi) || []) urls.add(m)
  for (const m of text.match(/placeholder[a-z.-]*/gi) || []) urls.add(m)
}
console.log([...urls].slice(0, 10))
// storage key literal
for (const f of fs.readdirSync('rebuild/dist/assets')) {
  if (!f.endsWith('.js')) continue
  const text = fs.readFileSync(path.join('rebuild/dist/assets', f), 'utf8')
  const key = text.match(/sb-[a-z0-9]+-auth-token/)
  if (key) console.log('auth key literal:', key[0], 'in', f)
}
