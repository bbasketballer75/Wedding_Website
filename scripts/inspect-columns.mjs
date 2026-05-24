import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim()

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function main() {
  const { data, error } = await supabase
    .from('site_editorial_features')
    .select('*')
    .limit(1)

  if (error) {
    console.error('Error fetching columns:', error)
    return
  }

  if (data && data.length > 0) {
    console.log('Columns in site_editorial_features:', Object.keys(data[0]))
  } else {
    console.log('Table site_editorial_features is empty, but let\'s try to get its structure by inserting a dummy or select.')
    // Let's fetch using a generic select
    const { data: cols, error: err } = await supabase.rpc('get_table_info', { table_name: 'site_editorial_features' }).catch(() => ({ data: null }))
    console.log('Alternative columns check:', cols)
  }
}

main().catch(console.error)
