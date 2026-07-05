import fs from 'node:fs'
import path from 'node:path'

const rootDir = process.cwd()
const failures = []
const warnings = []

const skipDirectories = new Set([
  '.git',
  'coverage',
  'dist',
  'node_modules',
  'playwright-report',
  'test-results',
])

const skipExtensions = new Set([
  '.avif',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.mp3',
  '.mp4',
  '.mov',
  '.pdf',
  '.png',
  '.svg',
  '.ttf',
  '.vtt',
  '.wav',
  '.webm',
  '.webp',
  '.woff',
  '.woff2',
])

const forbiddenMentionRoots = ['src', 'public', 'tests']
const allowedDocumentationMentions = new Set([
  'PRE_LAUNCH_CHECKLIST.md',
  'PRODUCTION_READINESS.md',
  'SECURITY.md',
])

function visit(directory, filePaths) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (skipDirectories.has(entry.name)) {
      continue
    }

    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      visit(fullPath, filePaths)
      continue
    }

    const extension = path.extname(entry.name).toLowerCase()
    if (skipExtensions.has(extension)) {
      continue
    }

    filePaths.push(fullPath)
  }
}

function isPlaceholderValue(value) {
  const normalized = value.trim().replace(/^['"`]|['"`]$/g, '')
  return (
    normalized === '' ||
    /^your[-_a-z0-9]/i.test(normalized) ||
    /^change[-_a-z0-9]/i.test(normalized) ||
    normalized.includes('example')
  )
}

const filePaths = []
visit(rootDir, filePaths)

for (const filePath of filePaths) {
  const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/')
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split(/\r?\n/)

  if (
    forbiddenMentionRoots.some(
      prefix => relativePath === prefix || relativePath.startsWith(`${prefix}/`)
    ) &&
    content.includes('SUPABASE_SERVICE_ROLE_KEY')
  ) {
    failures.push(`${relativePath} mentions SUPABASE_SERVICE_ROLE_KEY in a browser-facing path.`)
  }

  if (
    relativePath.endsWith('.md') &&
    !allowedDocumentationMentions.has(path.basename(relativePath)) &&
    /SUPABASE_SERVICE_ROLE_KEY\s*[:=]/.test(content)
  ) {
    warnings.push(
      `${relativePath} contains a service-role assignment example. Prefer linking back to SECURITY.md instead.`
    )
  }

  lines.forEach((line, index) => {
    const match = line.match(/SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*(.+)$/)
    if (!match) {
      return
    }

    const value = match[1]
    if (!isPlaceholderValue(value)) {
      failures.push(
        `${relativePath}:${index + 1} contains a populated SUPABASE_SERVICE_ROLE_KEY assignment.`
      )
    }
  })
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`FAIL: ${failure}`)
  }
  process.exit(1)
}

console.log('Repo secret scan passed.')
for (const warning of warnings) {
  console.warn(`WARN: ${warning}`)
}
