import fs from 'fs'
import path from 'path'

// Read the source file
const sourcePath = path.join('src', 'data', 'sharedGallery.js')
const sourceContent = fs.readFileSync(sourcePath, 'utf8')

// Extract the array content roughly (simplest way without eval)
// We look for the start of the array and the end
const arrayContent = sourceContent.substring(
  sourceContent.indexOf('['),
  sourceContent.lastIndexOf(']') + 1
)

// Dangerous but effective for this specific file format: eval text to get object
// Prepend variable declaration to make it valid JS
const sharedMedia = eval('(' + arrayContent + ')')

console.log(`Found ${sharedMedia.length} items to migrate.`)

let sql = `-- Migration to create and seed gallery_items table
-- Generated automatically

-- 1. Create Table
CREATE TABLE IF NOT EXISTS public.gallery_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    src TEXT NOT NULL,
    type TEXT DEFAULT 'image',
    caption TEXT,
    original_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    width INTEGER,
    height INTEGER,
    legacy_id TEXT
);

-- 2. Enable RLS
ALTER TABLE public.gallery_items ENABLE ROW LEVEL SECURITY;

-- 3. Create Policy (Public Read)
CREATE POLICY "Public read access" ON public.gallery_items
    FOR SELECT USING (true);

-- 4. Seed Data
INSERT INTO public.gallery_items (legacy_id, type, src, caption, original_name, created_at)
VALUES
`

const values = sharedMedia.map(item => {
  // Extract date from originalName (20250511_180812-0b9c.jpg)
  let createdAt = 'NOW()'
  if (item.originalName) {
    const match = item.originalName.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/)
    if (match) {
      // YYYY-MM-DD HH:mm:ss
      createdAt = `'${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:${match[6]}'`
    }
  }

  const cleanSrc = item.src.replace(/'/g, "''")
  const cleanCaption = (item.caption || '').replace(/'/g, "''")
  const cleanOriginalName = (item.originalName || '').replace(/'/g, "''")

  return `('${item.id}', '${item.type}', '${cleanSrc}', '${cleanCaption}', '${cleanOriginalName}', ${createdAt})`
})

sql += values.join(',\n') + ';'

// Write to file
const outputPath = path.join('supabase', 'migrations', '20260111_seed_gallery.sql')
// Ensure directory exists
const dir = path.dirname(outputPath)
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true })
}

fs.writeFileSync(outputPath, sql)

console.log(`Migration file generated at: ${outputPath}`)
