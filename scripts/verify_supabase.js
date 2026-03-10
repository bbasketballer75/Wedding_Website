
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log(`Testing connection to: ${supabaseUrl}`);

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Missing URL or Key in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    try {
        const { data, error } = await supabase.from('guest_book').select('count', { count: 'exact', head: true });
        if (error) throw error;
        console.log('✅ Connection Successful!');
        console.log(`Found ${data} entries in guest_book (or accessible tables).`);
    } catch (err) {
        console.error('❌ Connection Failed:', err.message);
        process.exit(1);
    }
}

testConnection();
