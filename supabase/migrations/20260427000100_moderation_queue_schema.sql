-- Migration: 20260427000100_moderation_queue_schema
-- Description: Add rejection_reason column to guest_uploads, add index on status, and ensure RLS UPDATE policy exists
-- Created: 2026-04-27

-- 1. Add rejection_reason column to guest_uploads table
ALTER TABLE guest_uploads
ADD COLUMN IF NOT EXISTS rejection_reason text;

-- 2. Add index on status column for efficient queries
CREATE INDEX IF NOT EXISTS idx_guest_uploads_status ON guest_uploads(status);

-- 3. Add comment documenting the schema change
COMMENT ON COLUMN guest_uploads.rejection_reason IS 'Optional reason shown to guest when upload is rejected';

-- 4. Verify and add RLS UPDATE policy for authenticated users (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'guest_uploads'
      AND policyname = 'Allow authenticated update'
  ) THEN
    CREATE POLICY "Allow authenticated update" ON guest_uploads
      FOR UPDATE USING (auth.role() = 'authenticated');
  END IF;
END
$$;

-- 5. Ensure RLS is enabled on guest_uploads
ALTER TABLE guest_uploads ENABLE ROW LEVEL SECURITY;