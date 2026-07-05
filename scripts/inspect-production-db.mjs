import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment configurations from .env
dotenv.config({ quiet: true })

const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim()

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env file.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function checkFeaturedSlots() {
  console.log('\n--- ⭐ Active Featured Editorial Slots ---')
  const { data, error } = await supabase
    .from('site_editorial_features')
    .select('*')
    .order('display_order', { ascending: true })

  if (error) {
    console.error(`Failed to fetch featured slots: ${error.message}`)
    return
  }

  if (data && data.length > 0) {
    console.log(`Found ${data.length} featured moments in database:`)
    for (const item of data) {
      console.log(`[Slot: ${item.slot}] "${item.title}"`)
      console.log(` - Description: ${item.summary || item.trail}`)
      console.log(` - Order:       ${item.display_order}`)
      console.log(` - Image URL:   ${item.source_url}`)
      console.log('---')
    }
  } else {
    console.log('No featured moments have been curated in the live database yet.')
    console.log('Use the Admin Panel (/admin/featured) or direct queries to curate them.')
  }
}

async function checkGuestIdentities() {
  console.log('\n--- 🔍 Registered Guest Profiles ---')
  const { data, error } = await supabase
    .from('guest_identities')
    .select('id, display_name, email')
    .limit(10)

  if (error) {
    console.error(`Failed to fetch guest identities: ${error.message}`)
    return
  }

  if (data && data.length > 0) {
    console.log(`Showing up to first 10 registered guests (out of many):`)
    for (const guest of data) {
      console.log(` - ${guest.display_name} (${guest.email})`)
    }
  } else {
    console.log('No guest profiles are registered in the live database yet.')
    console.log('Guests will be registered once they submit messages or claim photos.')
  }
}

async function checkGeneralCounts() {
  console.log('\n--- 📊 General Database Counts ---')

  // Photos Count
  const { count: photosCount, error: photosError } = await supabase
    .from('photos')
    .select('id', { count: 'exact', head: true })

  if (photosError) console.error(`Photos count failed: ${photosError.message}`)
  else console.log(` - Total Photos in Gallery:       ${photosCount ?? 0}`)

  // Messages Count
  const { count: msgsCount, error: msgsError } = await supabase
    .from('guestbook_messages')
    .select('id', { count: 'exact', head: true })

  if (msgsError) console.error(`Messages count failed: ${msgsError.message}`)
  else console.log(` - Total Guestbook Messages:      ${msgsCount ?? 0}`)

  // Uploads Count
  const { count: uploadsCount, error: uploadsError } = await supabase
    .from('guest_uploads')
    .select('id', { count: 'exact', head: true })

  if (uploadsError) console.error(`Uploads count failed: ${uploadsError.message}`)
  else console.log(` - Total Guest Photo Uploads:     ${uploadsCount ?? 0}`)
}

async function main() {
  console.log('Connecting to live Supabase project to verify curation status...')
  console.log(`Database URL: ${supabaseUrl}`)

  await checkGeneralCounts()
  await checkFeaturedSlots()
  await checkGuestIdentities()
}

main().catch(console.error)
