const fs = require('fs')
const dir = 'tools/parity/output/w9-matrix-final5'
const summary = JSON.parse(fs.readFileSync(dir + '/summary.json', 'utf8'))
console.log('=== verification ===')
console.log('rows:', summary.totals.shots, '| pass', summary.totals.passed, '| allowed', summary.totals.allowed, '| fail', summary.totals.failed, '| error', summary.totals.errors)
console.log('tolerance:', JSON.stringify(summary.tolerance))
for (const key of ['gallery__mobile__dark', 'admin__mobile__dark', 'admin-login__mobile__dark']) {
  const shot = summary.shots.find(s => s.key === key)
  console.log('\n===', key, '| status', shot.status, '| ratio', shot.pixelDiff?.ratio, '| heights', shot.legacy.pageHeightPx, '/', shot.rebuild.pageHeightPx)
  for (const slice of shot.pixelDiff.slices) {
    if (slice.changedPixels > 0) console.log('   window', slice.slice, 'changed', slice.changedPixels, 'bbox', JSON.stringify(slice.boundingBox), '→', slice.diffFile)
  }
  const diffFile = dir + '/text/diff/' + key + '.json'
  if (fs.existsSync(diffFile)) {
    const diff = JSON.parse(fs.readFileSync(diffFile, 'utf8'))
    for (const d of diff.differences) {
      const legacy = Array.isArray(d.legacy) ? d.legacy : [d.legacy]
      const rebuild = Array.isArray(d.rebuild) ? d.rebuild : [d.rebuild]
      console.log('   text', d.field, '| legacy count', legacy.length, '| rebuild count', rebuild.length)
      // show first differing entries
      let shown = 0
      for (let i = 0; i < Math.max(legacy.length, rebuild.length) && shown < 6; i++) {
        const a = JSON.stringify(legacy[i])
        const b = JSON.stringify(rebuild[i])
        if (a !== b) { console.log('     [', i, '] legacy:', a?.slice(0, 140), '| rebuild:', b?.slice(0, 140)); shown++ }
      }
      if (diff.bodyText) console.log('   bodyText firstDiffLine:', diff.bodyText.firstDifferenceLine, 'context legacy:', JSON.stringify(diff.bodyText.context?.legacy?.slice(0, 5)), '| rebuild:', JSON.stringify(diff.bodyText.context?.rebuild?.slice(0, 5)))
    }
  }
}
