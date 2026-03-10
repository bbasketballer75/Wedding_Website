# Supabase Setup Instructions

## Step 1: Run Database Schema

1. Go to your Supabase Dashboard: https://rxzbbtghnrvzubqrbhhx.supabase.co
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy and paste the contents of `supabase-schema.sql` file
5. Click **Run**

This creates:
- `photos` table
- `guest_uploads` table  
- `guestbook_messages` table
- Row Level Security (RLS) policies

## Step 2: Create Storage Buckets

1. In Supabase Dashboard, click **Storage** in the left sidebar
2. Click **New Bucket**
3. Create these 3 buckets:

| Bucket Name | Public | File Size Limit |
|-------------|--------|-----------------|
| `guest-photos` | ✅ Yes | 10MB |
| `guest-videos` | ✅ Yes | 100MB |
| `guest-voice` | ✅ Yes | 10MB |

4. For each bucket, after creation:
   - Click on the bucket
   - Go to **Policies** tab
   - The policies are already created by the SQL script
   - Verify they exist

## Step 3: Get Your Anon Key

The publishable key you provided may need to be verified. To get the correct anon key:

1. In Supabase Dashboard, go to **Project Settings** (gear icon)
2. Click **API** in the left sidebar
3. Copy the `anon public` key (starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)
4. Update your `.env` file:

```bash
VITE_SUPABASE_URL=https://rxzbbtghnrvzubqrbhhx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## Step 4: Test the Connection

1. Run the dev server: `npm run dev`
2. Open browser console
3. Check for any Supabase connection errors
4. Try uploading a photo on the Upload page

## Troubleshooting

### "Invalid API key" error
- Make sure you're using the `anon public` key, not the service role key
- The key should start with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9`

### "Bucket not found" error
- Make sure you created the buckets exactly as named: `guest-photos`, `guest-videos`, `guest-voice`
- Bucket names are case-sensitive

### "RLS policy violation" error
- Make sure you ran the SQL schema completely
- Check that the storage policies exist in Storage > Policies
