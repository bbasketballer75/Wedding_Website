const fs = require('fs')
const dir = 'tools/parity/output/w9-matrix-final5'
const matrix = fs.readFileSync(dir + '/MATRIX.md', 'utf8')
// Extract just the table block (from the first '| Route' line through the trailing newline before blank line)
const lines = matrix.split('\n')
const start = lines.findIndex(line => line.startsWith('| Route'))
let end = start
while (end < lines.length && lines[end].startsWith('|')) end += 1
const table = lines.slice(start, end).join('\n')
const summary = JSON.parse(fs.readFileSync(dir + '/matrix-summary.json', 'utf8'))
const failures = summary.rows.filter(row => row.status === 'fail' || row.status === 'error')
const failureLines = failures.map(row => `- \`${row.key}\` — ${row.failureReasons.join('; ')} → \`${row.firstFailure.path}\``)

const section = `## 11. Wave 9 full-matrix result (immutable parity dist \`603170EA…\`)

**Provenance.** One immutable parity build: \`rebuild/dist/index.html\` mtime \`2026-11-09T21:14:01\`,
size 3546 B, sha256 \`603170EAE0A7408420A7194CC2CAF832D1FD282E8C7850F190A889498EBBA687\` (plain \`vite
build\`, no prerender, fixture Supabase project URL baked in). The hash was verified **before and
after** the run and is unchanged, so every row below comes from one build served on :4174 (frozen
legacy) and :4175 (rebuild). Command (documented 1px edge tolerance per §2):

\`\`\`bash
node tools/parity/matrix.mjs \\
  --legacy-url http://127.0.0.1:4174 \\
  --rebuild-url http://127.0.0.1:4175 \\
  --routes all --matrix all --themes dark,light \\
  --edge-tolerance 1 --no-admin --prerender --wave 9 \\
  --out tools/parity/output/w9-matrix-final5
\`\`\`

**Result: 46 rows — 35 pass, 5 allowed (documented home/film raster-phase entries), 6 fail, 0 error.
0 text diffs outside the 6 failures. All 4 admin/admin-login desktop rows now PASS after the
metadata + wordmark-link fixes; both sides authenticated (desktop heights 1928/1928).**
Prerender check: \`pending (0/9)\` — correct for a plain parity build (§10.3), not a failure.

${table}

### Remaining failures (app-side, routed to the Lead; not harness issues)

${failureLines.join('\n')}

- **gallery · mobile · dark/light** — real mobile behaviour difference: legacy page height
  11156 px renders 30 images while the rebuild is 9528 px with 24 images and a \`LOAD MORE\`
  control (first missing lazy image: \`/images/engagement/PoradaProposal-320.webp\`; first body-text
  difference at line 37: legacy continues the grid, rebuild shows \`LOAD MORE\`). This is product
  behaviour (mobile pagination/page-size), not raster phase.
- **admin · mobile · dark/light** and **admin-login · mobile · dark/light** — pixel-only difference
  (no text diffs); desktop admin is 0 px. Heights 3446/3415 (31 px delta); changed windows include
  \`shots/diff/admin__mobile__dark--s000.png\`, \`--s001.png\`, \`--s002.png\`, \`--s003.png\`. Looks like
  the mobile admin shell/layout (drawer/sidebar) rather than metadata — app-side.

### Admin coverage (captured vs exempt)

The authenticated capture mode (§10.2) worked on this dist: legacy authenticates from the seeded
Supabase session (\`sb-zaczcyzvavetgfuucljf-auth-token\`) and the rebuild now shares the same fixture
project URL, so **both sides authenticate and every admin row was CAPTURED — no exempt rows**.
\`/admin/admin/login\` are included in the 46 rows above. The 10 synthetic admin-section rows
(\`/admin/photos\`, \`/admin/albums\`, …) are supported by \`adminCaptureRoutes()\` and were exercised on
earlier intermediate dists; they were intentionally excluded from this final run per the Lead's
targeted scope (\`--no-admin\`) — run the same command without \`--no-admin\` to include them.

Generated artifacts: \`tools/parity/output/w9-matrix-final5/matrix-summary.json\`,
\`MATRIX.md\`, \`README.md\`, \`summary.json\`, \`report.html\`, \`shots/\`, \`text/\`.

`
fs.appendFileSync('docs/rebuild/PARITY.md', '\n' + section, 'utf8')
console.log('appended section 11, lines:', section.split('\n').length)
