-- ============================================
-- Migration: Guestbook Comments/Replies
-- Adds table for storing replies to guestbook messages
-- ============================================

-- Table: guestbook_comments
-- Stores replies/comments on guestbook messages
CREATE TABLE IF NOT EXISTS guestbook_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES guestbook_messages(id) ON DELETE CASCADE,
  author text NOT NULL DEFAULT 'Guest',
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE guestbook_comments ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY IF NOT EXISTS "Allow public read comments" ON guestbook_comments
  FOR SELECT USING (true);

-- Allow public insert (guests can reply)
CREATE POLICY IF NOT EXISTS "Allow public insert comments" ON guestbook_comments
  FOR INSERT WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_guestbook_comments_message_id ON guestbook_comments(message_id);
CREATE INDEX IF NOT EXISTS idx_guestbook_comments_created_at ON guestbook_comments(created_at DESC);

-- Function to get message with comments
CREATE OR REPLACE FUNCTION get_guestbook_messages_with_comments()
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  content text,
  type text,
  media_url text,
  reactions jsonb,
  created_at timestamp with time zone,
  comments jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    gm.id,
    gm.name,
    gm.email,
    gm.content,
    gm.type,
    gm.media_url,
    gm.reactions,
    gm.created_at,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', gc.id,
          'author', gc.author,
          'content', gc.content,
          'created_at', gc.created_at
        ) ORDER BY gc.created_at
      ) FILTER (WHERE gc.id IS NOT NULL),
      '[]'::jsonb
    ) as comments
  FROM guestbook_messages gm
  LEFT JOIN guestbook_comments gc ON gc.message_id = gm.id
  GROUP BY gm.id, gm.name, gm.email, gm.content, gm.type, gm.media_url, gm.reactions, gm.created_at
  ORDER BY gm.created_at DESC;
END;
$$ LANGUAGE plpgsql;
