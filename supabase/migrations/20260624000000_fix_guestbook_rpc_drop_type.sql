-- ============================================
-- Migration: Fix get_guestbook_messages_with_comments RPC
--
-- Context:
--   The `type` column was dropped from `guestbook_messages` in
--   `20260410001200_drop_guestbook_type_and_anniversary.sql`
--   (guestbook went text-only; voice/video flows were removed).
--   The `get_guestbook_messages_with_comments()` RPC was authored
--   against the old schema and still references `gm.type` in its
--   SELECT and GROUP BY, causing the runtime error
--   "column gm.type does not exist" (SQLSTATE 42703).
--
--   The verify script surfaces this as a WARN on every run:
--     npm run verify:supabase
--       - Guestbook RPC access... WARN
--         get_guestbook_messages_with_comments: column gm.type does not exist
--
-- Fix:
--   DROP + CREATE the function with the corrected RETURNS TABLE
--   (no `type` column) and SELECT / GROUP BY clauses that no
--   longer reference `gm.type`.
--
--   CREATE OR REPLACE FUNCTION cannot change the OUT parameter
--   list / RETURNS TABLE column set in PostgreSQL, so we must
--   DROP the old signature first. IF EXISTS guards keep the
--   migration re-runnable / safe on partially-applied state.
-- ============================================

DROP FUNCTION IF EXISTS public.get_guestbook_messages_with_comments()
CREATE FUNCTION public.get_guestbook_messages_with_comments()
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  content text,
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
  GROUP BY gm.id, gm.name, gm.email, gm.content, gm.media_url, gm.reactions, gm.created_at
  ORDER BY gm.created_at DESC;
END;
$$ LANGUAGE plpgsql
-- Re-grant default privileges (carried over from the original CREATE OR REPLACE
-- in 20240303000002_guestbook_comments.sql, where the function is callable by
-- the anon role via PostgREST). Function defaults to PUBLIC execute on creation,
-- but be explicit so future reviewers can see the intent.
GRANT EXECUTE ON FUNCTION public.get_guestbook_messages_with_comments() TO anon
GRANT EXECUTE ON FUNCTION public.get_guestbook_messages_with_comments() TO authenticated
