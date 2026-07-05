import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ quiet: true })

const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim()
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const allowServerRoleVerify = process.env.SUPABASE_ALLOW_SERVER_ROLE_VERIFY === '1'

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.')
  process.exit(1)
}

const publicClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const adminClient =
  serviceRoleKey && allowServerRoleVerify
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null

function summarizeKey(key) {
  return `${key.slice(0, 10)}...${key.slice(-6)}`
}

async function runCheck(label, verify) {
  process.stdout.write(`- ${label}... `)

  try {
    const detail = await verify()
    console.log(`OK${detail ? ` (${detail})` : ''}`)
  } catch (error) {
    console.log('FAILED')
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}

async function runOptionalCheck(label, verify) {
  process.stdout.write(`- ${label}... `)

  try {
    const detail = await verify()
    console.log(`OK${detail ? ` (${detail})` : ''}`)
  } catch (error) {
    console.log('WARN')
    console.warn(error instanceof Error ? error.message : error)
  }
}

async function verifyTableCount(client, table, options = {}) {
  const { count, error } = await client
    .from(table)
    .select('id', { count: 'exact', head: true })
    .match(options)

  if (error) {
    throw new Error(`${table}: ${error.message}`)
  }

  return `${count ?? 0} rows visible`
}

async function verifyStorageBucket(client, bucket) {
  const { data, error } = await client.storage.from(bucket).list('', { limit: 1 })

  if (error) {
    throw new Error(`${bucket}: ${error.message}`)
  }

  return `${data?.length ?? 0} objects visible in sample`
}

async function main() {
  console.log(`Verifying Supabase project: ${supabaseUrl}`)
  console.log(`Using anon key: ${summarizeKey(supabaseAnonKey)}`)
  console.log(
    adminClient
      ? 'Privileged admin checks enabled with SUPABASE_SERVICE_ROLE_KEY in a server-only context.'
      : 'Privileged admin checks skipped. Set SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ALLOW_SERVER_ROLE_VERIFY=1 only in a server-only environment to validate moderation access.'
  )

  await runCheck('Public photos access', () => verifyTableCount(publicClient, 'photos'))
  await runCheck('Public guestbook access', () =>
    verifyTableCount(publicClient, 'guestbook_messages')
  )
  await runCheck('Public guestbook comments access', () =>
    verifyTableCount(publicClient, 'guestbook_comments')
  )
  await runCheck('Approved guest uploads access', () =>
    verifyTableCount(publicClient, 'guest_uploads', { status: 'approved' })
  )

  await runOptionalCheck('Guestbook RPC access', async () => {
    const { data, error } = await publicClient.rpc('get_guestbook_messages_with_comments')

    if (error) {
      throw new Error(`get_guestbook_messages_with_comments: ${error.message}`)
    }

    return `${Array.isArray(data) ? data.length : 0} messages returned`
  })

  await runCheck('guest-photos bucket readability', () =>
    verifyStorageBucket(publicClient, 'guest-photos')
  )
  await runCheck('guest-videos bucket readability', () =>
    verifyStorageBucket(publicClient, 'guest-videos')
  )
  await runCheck('guest-voice bucket readability', () =>
    verifyStorageBucket(publicClient, 'guest-voice')
  )

  if (adminClient) {
    await runCheck('Admin guest uploads visibility', () =>
      verifyTableCount(adminClient, 'guest_uploads')
    )
    await runCheck('Admin guestbook visibility', () =>
      verifyTableCount(adminClient, 'guestbook_messages')
    )
  }

  if (process.exitCode) {
    console.error('Supabase verification finished with failures.')
    process.exit(process.exitCode)
  }

  console.log('Supabase verification finished successfully.')
}

void main()
