# Skill: Supabase Integration

## Overview

This skill enables Codex to work with Supabase for database operations, storage, and real-time features in the wedding website.

## Supabase Client

### Initialization

```typescript
// File: src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient<Database>(supabaseUrl, supabaseKey)
```

### Typed Client

The project uses generated types from Supabase:

```bash
# Generate types from linked project
npm run supabase:types
```

This creates `src/types/supabase.generated.ts` with full type safety.

## Database Operations

### Select Queries

```typescript
// Basic select
const { data, error } = await supabase
  .from('photos')
  .select('*')

// Select with filters
const { data, error } = await supabase
  .from('photos')
  .select('*')
  .eq('category', 'wedding')
  .gte('created_at', '2024-01-01')
  .order('created_at', { ascending: false })
  .limit(10)

// Select specific columns
const { data, error } = await supabase
  .from('photos')
  .select('id, url, caption, created_at')

// Select with relationships
const { data, error } = await supabase
  .from('photos')
  .select(`
    *,
    photographer:photographers(*)
  `)
```

### Insert Operations

```typescript
// Single insert
const { data, error } = await supabase
  .from('guestbook_messages')
  .insert({
    name: 'John Doe',
    email: 'john@example.com',
    content: 'Congratulations!'
  })
  .select()

// Bulk insert
const { data, error } = await supabase
  .from('photos')
  .insert([
    { url: 'photo1.jpg', category: 'ceremony' },
    { url: 'photo2.jpg', category: 'reception' }
  ])
```

### Update Operations

```typescript
// Update with filter
const { data, error } = await supabase
  .from('guest_uploads')
  .update({ status: 'approved' })
  .eq('id', uploadId)

// Update with multiple filters
const { error } = await supabase
  .from('photos')
  .update({ likes: supabase.rpc('increment', { x: 1 }) })
  .eq('id', photoId)
```

### Delete Operations

```typescript
// Delete with filter
const { error } = await supabase
  .from('guest_uploads')
  .delete()
  .eq('id', uploadId)
```

## Storage Operations

### Upload Files

```typescript
// Upload to storage bucket
const uploadFile = async (file: File, bucket: string) => {
  const fileExt = file.name.split('.').pop()
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
  const filePath = `${folder}/${fileName}`

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    })

  if (error) throw error

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath)

  return publicUrl
}
```

### Common Buckets

- `guest-photos` - Guest uploaded photos
- `guest-videos` - Guest uploaded videos
- `guest-voice-messages` - Voice messages

### Download/View Files

```typescript
// Get public URL
const { data: { publicUrl } } = supabase.storage
  .from('guest-photos')
  .getPublicUrl('folder/filename.jpg')

// Create signed URL (private files)
const { data, error } = await supabase.storage
  .from('private-bucket')
  .createSignedUrl('folder/filename.jpg', 60) // 60 seconds

// Download file
const { data, error } = await supabase.storage
  .from('guest-photos')
  .download('folder/filename.jpg')
```

### Delete Files

```typescript
const { error } = await supabase.storage
  .from('guest-photos')
  .remove(['folder/filename.jpg'])
```

## Real-time Subscriptions

### Subscribe to Changes

```typescript
import { useEffect } from 'react'

useEffect(() => {
  const subscription = supabase
    .channel('guestbook_changes')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'guestbook_messages'
      },
      (payload) => {
        console.log('New message:', payload.new)
        // Update local state
      }
    )
    .subscribe()

  return () => {
    subscription.unsubscribe()
  }
}, [])
```

### Filtered Subscriptions

```typescript
const subscription = supabase
  .channel('photo_updates')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'photos',
      filter: 'category=eq.wedding'
    },
    (payload) => {
      console.log('Photo updated:', payload)
    }
  )
  .subscribe()
```

## Row Level Security (RLS)

### Understanding RLS

All tables have RLS enabled. Key policies:

| Table | Select | Insert | Update | Delete |
|-------|--------|--------|--------|--------|
| photos | Public | Admin only | Admin only | Admin only |
| guestbook_messages | Public | Public | No one | No one |
| guest_uploads | Public (approved) | Public | Admin only | Admin only |

### Error Handling

```typescript
try {
  const { data, error } = await supabase
    .from('photos')
    .insert({ url: 'test.jpg' })

  if (error) {
    // Handle specific error types
    if (error.code === '42501') {
      console.error('RLS policy violation - not authorized')
    } else if (error.code === '23505') {
      console.error('Unique constraint violation')
    } else {
      console.error('Database error:', error.message)
    }
    return
  }

  // Success
  console.log('Inserted:', data)
} catch (err) {
  console.error('Unexpected error:', err)
}
```

## Common Patterns

### Fetch with Loading State

```typescript
import { useState, useEffect } from 'react'

function useSupabaseQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: Error | null }>
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetch() {
      try {
        setLoading(true)
        const { data, error } = await queryFn()
        
        if (cancelled) return
        
        if (error) throw error
        setData(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Unknown error'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetch()

    return () => {
      cancelled = true
    }
  }, [queryFn])

  return { data, loading, error, refetch: fetch }
}
```

### Optimistic Updates

```typescript
const [messages, setMessages] = useState<Message[]>([])

const addMessage = async (newMessage: Omit<Message, 'id'>) => {
  // Optimistic update
  const tempId = crypto.randomUUID()
  const optimisticMessage = { ...newMessage, id: tempId }
  setMessages(prev => [...prev, optimisticMessage])

  try {
    const { data, error } = await supabase
      .from('guestbook_messages')
      .insert(newMessage)
      .select()
      .single()

    if (error) throw error

    // Replace temp with real data
    setMessages(prev =>
      prev.map(m => (m.id === tempId ? data : m))
    )
  } catch (err) {
    // Rollback on error
    setMessages(prev => prev.filter(m => m.id !== tempId))
    throw err
  }
}
```

## CLI Commands

```bash
# Start local Supabase
npm run supabase:start

# Stop local Supabase
npm run supabase:stop

# Check status
npm run supabase:status

# Link to remote project
npm run supabase:link

# Generate TypeScript types
npm run supabase:types

# Push migrations to remote
npm run supabase:db:push

# Pull remote changes
npm run supabase:db:pull
```

## Database Schema

### Key Tables

```sql
-- Photos table
photos (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  thumbnail text not null,
  caption text,
  category text default 'Uncategorized',
  location text,
  date timestamptz default now(),
  likes integer default 0,
  photographer text,
  is_professional boolean default false,
  tags text[] default '{}',
  faces jsonb default '[]',
  created_at timestamptz default now()
)

-- Guestbook messages
guestbook_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  content text not null,
  type text default 'text',
  media_url text,
  reactions jsonb default '{}',
  created_at timestamptz default now()
)

-- Guest uploads
guest_uploads (
  id uuid primary key default gen_random_uuid(),
  guest_name text not null,
  guest_email text not null,
  message text,
  photo_urls text[] default '{}',
  video_urls text[] default '{}',
  status text default 'pending',
  created_at timestamptz default now()
)
```

See `supabase-schema.sql` for complete schema.
