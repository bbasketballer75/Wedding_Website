-- ============================================
-- Cutover migration 001 (D-01 / R17): repair the guestbook submit RPC
-- ============================================
--
-- CONTEXT
--   `20240303000003_rate_limiting.sql` created
--   `submit_guestbook_message_with_rate_limit(...)` against the old schema. It
--   inserted `guestbook_messages.type` (and wrote `p_type`), but
--   `20260410001200_drop_guestbook_type_and_anniversary.sql` dropped that column.
--   Every submission therefore raises SQLSTATE 42703 and the frozen client
--   falls back to a direct anon INSERT, which bypasses the server-side rate
--   limit entirely.
--
--   This forward migration restores the wrapper without the dropped column. The
--   public signature is kept identical (the frozen rebuild composer already
--   calls p_name/p_email/p_content/p_media_url/p_max_requests/p_window_minutes);
--   p_type is accepted and ignored for signature compatibility.
--
-- SAFETY
--   Additive/replacement only: no table, column or row changes. `DROP FUNCTION`
--   followed by `CREATE FUNCTION` is required because the OUT column list cannot
--   be changed with CREATE OR REPLACE. `IF EXISTS` keeps it re-runnable.
-- ============================================

DROP FUNCTION IF EXISTS public.submit_guestbook_message_with_rate_limit(
  text,
  text,
  text,
  text,
  text,
  integer,
  integer
);

CREATE FUNCTION public.submit_guestbook_message_with_rate_limit(
  p_name text,
  p_email text,
  p_content text,
  p_type text DEFAULT 'text',
  p_media_url text DEFAULT NULL,
  p_max_requests integer DEFAULT 3,
  p_window_minutes integer DEFAULT 1
)
RETURNS TABLE (
  success boolean,
  message_id uuid,
  error_message text,
  rate_limit_remaining integer,
  rate_limit_reset_after integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ip_address text;
  v_rate_check record;
  v_message_id uuid;
BEGIN
  -- Keep the frozen validation surface: trim, then require a non-empty name,
  -- email and content. Oversized payloads are rejected before any write.
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RETURN QUERY SELECT false, null::uuid, 'Please add your name.', 0, 0;
    RETURN;
  END IF;
  IF p_email IS NULL OR btrim(p_email) = '' THEN
    RETURN QUERY SELECT false, null::uuid, 'Please add your email.', 0, 0;
    RETURN;
  END IF;
  IF p_content IS NULL OR btrim(p_content) = '' THEN
    RETURN QUERY SELECT false, null::uuid, 'Please write a message.', 0, 0;
    RETURN;
  END IF;
  IF length(p_content) > 5000 THEN
    RETURN QUERY SELECT false, null::uuid, 'That message is too long.', 0, 0;
    RETURN;
  END IF;

  -- Get client IP address (frozen behaviour).
  v_ip_address := coalesce(
    current_setting('request.headers', true)::json ->> 'x-forwarded-for',
    current_setting('request.headers', true)::json ->> 'x-real-ip',
    'unknown'
  );

  -- Check + increment the persistent rate limit (frozen semantics).
  SELECT * INTO v_rate_check
  FROM public.check_rate_limit(v_ip_address, 'guestbook_submit', p_max_requests, p_window_minutes);

  IF NOT v_rate_check.allowed THEN
    RETURN QUERY SELECT
      false,
      null::uuid,
      format(
        'Rate limit exceeded. Please wait %s seconds before submitting another message.',
        v_rate_check.reset_after_seconds
      ),
      0,
      v_rate_check.reset_after_seconds;
    RETURN;
  END IF;

  PERFORM public.increment_rate_limit(v_ip_address, 'guestbook_submit', p_window_minutes);

  -- Insert the message. NOTE: `type` no longer exists on this table; p_type is
  -- intentionally ignored so the frozen signature stays source-compatible.
  INSERT INTO public.guestbook_messages (
    name,
    email,
    content,
    media_url,
    ip_address,
    reactions
  ) VALUES (
    btrim(p_name),
    lower(btrim(p_email)),
    p_content,
    p_media_url,
    v_ip_address,
    '{}'::jsonb
  )
  RETURNING id INTO v_message_id;

  RETURN QUERY SELECT
    true,
    v_message_id,
    null::text,
    v_rate_check.remaining,
    v_rate_check.reset_after_seconds;
END;
$$;

COMMENT ON FUNCTION public.submit_guestbook_message_with_rate_limit(
  text, text, text, text, text, integer, integer
) IS 'Submits a guestbook message with server-side rate limiting (R17 repair; type column removed).';

-- The wrapper is the only sanctioned write path for guestbook submissions.
GRANT EXECUTE ON FUNCTION public.submit_guestbook_message_with_rate_limit(
  text, text, text, text, text, integer, integer
) TO anon, authenticated;
