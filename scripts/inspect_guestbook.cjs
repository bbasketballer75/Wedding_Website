require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function inspect() {
  console.log('--- Inspector: guestbook table ---')

  // 1. Get Count
  const { count, error: countError } = await supabase
    .from('guestbook')
    .select('*', { count: 'exact', head: true })
  if (countError) {
    console.error('Error fetching count:', countError)
    return
  }
  console.log(`Total Rows: ${count}`)

  // 2. Sample Data (Limit 5)
  // SKILL RULE: Never output full tables.
  const { data, error } = await supabase.from('guestbook').select('*').limit(5)
  if (error) {
    console.error('Error fetching data:', error)
    return
  }

  console.log('Sample Data:')
  if (data.length === 0) {
    console.log('(No rows found - table is empty but reachable)')
  } else {
    console.table(data)
  }
}

inspect()
