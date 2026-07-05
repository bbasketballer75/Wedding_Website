import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'

dotenv.config({ quiet: true })

const rootDir = process.cwd()
const envFiles = [
  '.env',
  '.env.local',
  '.env.development',
  '.env.development.local',
  '.env.production',
  '.env.production.local',
  '.env.test',
  '.env.test.local',
  '.env.example',
]

const requiredPublicEnv = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']
const recommendedPublicEnv = ['VITE_SITE_URL']
const optionalPublicEnv = ['VITE_MEDIA_BASE_URL']
const failures = []
const warnings = []

function addFailure(message) {
  failures.push(message)
  console.error(`FAIL: ${message}`)
}

function addWarning(message) {
  warnings.push(message)
  console.warn(`WARN: ${message}`)
}

function addPass(message) {
  console.log(`OK: ${message}`)
}

function readFileIfPresent(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null
}

function isPlaceholderValue(value) {
  const normalized = value.trim()
  return (
    normalized === '' ||
    /^your[-_a-z0-9]/i.test(normalized) ||
    /^change[-_a-z0-9]/i.test(normalized) ||
    normalized.includes('example') ||
    normalized === 'xxxxx'
  )
}

function validateUrl(name, value, required) {
  if (!value) {
    if (required) {
      addFailure(`${name} is missing from the active environment.`)
    }
    return
  }

  try {
    const parsed = new URL(value)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      addFailure(`${name} must use http or https.`)
      return
    }
  } catch {
    addFailure(`${name} is not a valid URL.`)
    return
  }

  addPass(`${name} is configured.`)
}

console.log('Checking release environment configuration...')

const envExamplePath = path.join(rootDir, '.env.example')
const envExample = readFileIfPresent(envExamplePath)
if (!envExample) {
  addFailure('.env.example is missing.')
} else {
  for (const variable of [...requiredPublicEnv, ...recommendedPublicEnv, ...optionalPublicEnv]) {
    if (envExample.includes(variable)) {
      addPass(`.env.example documents ${variable}.`)
    } else {
      addFailure(`.env.example does not document ${variable}.`)
    }
  }
}

validateUrl('VITE_SUPABASE_URL', process.env.VITE_SUPABASE_URL?.trim(), true)
if (!process.env.VITE_SUPABASE_ANON_KEY?.trim()) {
  addFailure('VITE_SUPABASE_ANON_KEY is missing from the active environment.')
} else {
  addPass('VITE_SUPABASE_ANON_KEY is configured.')
}
validateUrl('VITE_SITE_URL', process.env.VITE_SITE_URL?.trim(), false)
validateUrl('VITE_MEDIA_BASE_URL', process.env.VITE_MEDIA_BASE_URL?.trim(), false)

if (!process.env.VITE_SITE_URL?.trim()) {
  addWarning(
    'VITE_SITE_URL is not set. Canonical URLs and share metadata will fall back to the default domain.'
  )
}

if (!process.env.VITE_SENTRY_DSN?.trim()) {
  addWarning('VITE_SENTRY_DSN is not set. Production error monitoring will be disabled.')
} else {
  addPass('VITE_SENTRY_DSN is configured.')
}

if (!process.env.VITE_GA_ID?.trim()) {
  addWarning(
    'VITE_GA_ID is not set. If analytics is required for launch, `npm run verify:launch` will fail.'
  )
} else {
  addPass('VITE_GA_ID is configured.')
}

if (!process.env.VITE_APP_VERSION?.trim()) {
  addWarning(
    'VITE_APP_VERSION is not set. Monitoring will fall back to the package version unless a launch-specific release label is provided.'
  )
} else {
  addPass('VITE_APP_VERSION is configured.')
}

for (const envFile of envFiles) {
  const filePath = path.join(rootDir, envFile)
  const raw = readFileIfPresent(filePath)

  if (!raw || envFile === '.env.example') {
    continue
  }

  const parsed = dotenv.parse(raw)
  const serviceRoleValue = parsed.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleValue) {
    addPass(`${envFile} does not define SUPABASE_SERVICE_ROLE_KEY.`)
    continue
  }

  if (isPlaceholderValue(serviceRoleValue)) {
    addWarning(
      `${envFile} includes a placeholder SUPABASE_SERVICE_ROLE_KEY entry. Remove it from browser-facing env files before launch.`
    )
    continue
  }

  addFailure(
    `${envFile} contains a populated SUPABASE_SERVICE_ROLE_KEY. Move it to a server-only secret store.`
  )
}

if (failures.length > 0) {
  console.error(`Release environment verification failed with ${failures.length} issue(s).`)
  process.exit(1)
}

console.log('Release environment verification passed.')
if (warnings.length > 0) {
  console.log(`Completed with ${warnings.length} warning(s).`)
}
