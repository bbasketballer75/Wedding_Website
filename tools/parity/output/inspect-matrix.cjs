const fs = require('fs')
const data = JSON.parse(fs.readFileSync('tools/parity/output/w9-matrix-dryrun/matrix-summary.json', 'utf8'))
console.log('kind:', data.kind, 'rows:', data.rows.length, 'counts:', JSON.stringify(data.counts))
console.log('admin:', JSON.stringify({ included: data.admin.included, mode: data.admin.captureMode.slice(0, 80), captured: data.admin.captured.length, exempt: data.admin.exempt.length }))
console.log('prerender:', JSON.stringify({ status: data.prerender.status, expected: data.prerender.expectedRoutes, done: data.prerender.rebuildPrerendered }))
const sample = data.rows[0]
console.log('row sample keys:', Object.keys(sample).join(','))
console.log('row sample:', JSON.stringify({ key: sample.key, status: sample.status, firstFailure: sample.firstFailure, heights: [sample.legacyHeight, sample.rebuildHeight] }))
