require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

console.log(`Checking connection...`)
console.log(`URL: ${supabaseUrl}`)
console.log(`Key: ${supabaseKey ? supabaseKey.slice(0, 15) + '...' : 'MISSING'}`)

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing URL or Key in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testConnection() {
  try {
    console.log('1. Testing Auth Service (Health Check)...')
    const { data: authData, error: authError } = await supabase.auth.getSession()
    if (authError) {
      console.error('Auth Check Failed:', authError)
      throw authError // This might be the one with empty message?
    }
    console.log('✅ Auth Service is reachable.')

    console.log('2. Testing Database (guest_book)...')
    const { data, error } = await supabase.from('guestbook').select('*').limit(1)

    if (error) {
      console.error('Database Check Failed:', error)
      console.log('Error details:', JSON.stringify(error, null, 2))
      throw error
    }
    console.log('✅ Database is reachable!')
    console.log(`Query result count: ${data.length}`)
  } catch (err) {
    console.error('❌ FINAL FAILURE:', err)
    process.exit(1)
  }
}

testConnection()
