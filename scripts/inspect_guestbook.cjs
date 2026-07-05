require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function inspect() {
  console.log('--- Inspector: guestbook_messages ---')

  // 1. Get Count
  const { count, error: countError } = await supabase
    .from('guestbook_messages')
    .select('id', { count: 'exact', head: true })
  if (countError) {
    console.error('Error fetching count:', countError)
    return
  }
  console.log(`Total Rows: ${count}`)

  // 2. Sample Data (Limit 5)
  // SKILL RULE: Never output full tables.
  const { data, error } = await supabase.rpc('get_guestbook_messages_with_comments')

  if (error) {
    console.error('Error fetching data:', error)
    return
  }

  const sample = Array.isArray(data)
    ? data.slice(0, 5).map(entry => ({
        id: entry.id,
        name: entry.name,
        type: entry.type,
        created_at: entry.created_at,
        comment_count: Array.isArray(entry.comments) ? entry.comments.length : 0,
      }))
    : []

  console.log('Sample Data:')
  if (sample.length === 0) {
    console.log('(No rows found - table is empty but reachable)')
  } else {
    console.table(sample)
  }
}

inspect()
