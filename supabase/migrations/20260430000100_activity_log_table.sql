-- Migration: 20260430000100_activity_log_table
-- Description: Create activity_log table with triggers on guest_uploads, guestbook_messages, and site_editorial_features
-- Created: 2026-04-30

-- 1. Create activity_log table
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('photo_upload', 'guestbook_entry', 'featured_moment')),
  source_id TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('guest_uploads', 'guestbook_messages', 'site_editorial_features')),
  display_name TEXT,
  thumbnail_url TEXT,
  content_preview TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create index on created_at for efficient queries
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at DESC);

-- 3. Create trigger function for activity log inserts
CREATE OR REPLACE FUNCTION trigger_activity_log_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle guest_uploads: only fire when status = 'approved'
  IF TG_TABLE_NAME = 'guest_uploads' THEN
    IF NEW.status = 'approved' THEN
      INSERT INTO activity_log (type, source_id, source_type, display_name, thumbnail_url)
      VALUES ('photo_upload', NEW.id, 'guest_uploads', NEW.guest_name, NEW.photo_urls[1]);
    END IF;

  -- Handle guestbook_messages: fire on every insert
  ELSIF TG_TABLE_NAME = 'guestbook_messages' THEN
    INSERT INTO activity_log (type, source_id, source_type, display_name, thumbnail_url, content_preview)
    VALUES ('guestbook_entry', NEW.id, 'guestbook_messages', NEW.name, NEW.media_url, LEFT(NEW.content, 100));

  -- Handle site_editorial_features: only fire when is_active = true
  ELSIF TG_TABLE_NAME = 'site_editorial_features' THEN
    IF NEW.is_active = true THEN
      INSERT INTO activity_log (type, source_id, source_type, display_name, thumbnail_url)
      VALUES ('featured_moment', NEW.id, 'site_editorial_features', NEW.title, NEW.source_url);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create trigger on guest_uploads (fires on UPDATE when status changes to 'approved')
DROP TRIGGER IF EXISTS guest_uploads_after_approve ON guest_uploads;
CREATE TRIGGER guest_uploads_after_approve
  AFTER UPDATE ON guest_uploads
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved')
  EXECUTE FUNCTION trigger_activity_log_insert();

-- 5. Create trigger on guestbook_messages (fires on INSERT)
DROP TRIGGER IF EXISTS guestbook_messages_after_insert ON guestbook_messages;
CREATE TRIGGER guestbook_messages_after_insert
  AFTER INSERT ON guestbook_messages
  FOR EACH ROW
  EXECUTE FUNCTION trigger_activity_log_insert();

-- 6. Create trigger on site_editorial_features (fires on INSERT when is_active = true)
DROP TRIGGER IF EXISTS site_editorial_features_after_insert ON site_editorial_features;
CREATE TRIGGER site_editorial_features_after_insert
  AFTER INSERT ON site_editorial_features
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION trigger_activity_log_insert();

-- 7. Enable realtime on activity_log table for Supabase Realtime subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE activity_log;
