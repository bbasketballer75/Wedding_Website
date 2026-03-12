-- ============================================
-- Migration: Server-Side Rate Limiting
-- Implements rate limiting for user-generated content
-- ============================================

-- Table: rate_limit_logs
-- Tracks request counts per IP/action combination
CREATE TABLE IF NOT EXISTS rate_limit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address text NOT NULL,
  action text NOT NULL,
  request_count integer DEFAULT 1,
  window_start timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  -- Composite index for efficient lookups
  CONSTRAINT unique_ip_action_window UNIQUE (ip_address, action, window_start)
);

-- Enable RLS
ALTER TABLE rate_limit_logs ENABLE ROW LEVEL SECURITY;

-- Only service role can access rate limit logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'rate_limit_logs'
      AND policyname = 'Service role only'
  ) THEN
    CREATE POLICY "Service role only" ON rate_limit_logs
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END
$$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rate_limit_logs_lookup 
  ON rate_limit_logs(ip_address, action, window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limit_logs_cleanup 
  ON rate_limit_logs(window_start DESC);

-- Function: check_rate_limit
-- Checks if a request is within rate limits
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_ip_address text,
  p_action text,
  p_max_requests integer DEFAULT 5,
  p_window_minutes integer DEFAULT 1
)
RETURNS TABLE (
  allowed boolean,
  remaining integer,
  reset_after_seconds integer,
  current_count integer
) AS $$
DECLARE
  v_count integer;
  v_window_start timestamp with time zone;
  v_reset_after integer;
BEGIN
  -- Calculate window start
  v_window_start := date_trunc('minute', now()) 
    - interval '1 minute' * (extract(minute from now())::int % p_window_minutes);
  
  -- Get current count for this IP/action/window
  SELECT COALESCE(request_count, 0)
  INTO v_count
  FROM rate_limit_logs
  WHERE ip_address = p_ip_address
    AND action = p_action
    AND window_start = v_window_start
  FOR UPDATE SKIP LOCKED;
  
  -- If no record exists, count is 0
  IF v_count IS NULL THEN
    v_count := 0;
  END IF;
  
  -- Calculate reset time (seconds until next window)
  v_reset_after := (p_window_minutes * 60) - 
    (extract(epoch from (now() - v_window_start))::int % (p_window_minutes * 60));
  
  -- Return rate limit status
  RETURN QUERY SELECT
    v_count < p_max_requests,  -- allowed
    GREATEST(0, p_max_requests - v_count - 1),  -- remaining (minus 1 for current request)
    v_reset_after,  -- reset_after_seconds
    v_count;  -- current_count
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: increment_rate_limit
-- Increments the request count after a successful check
CREATE OR REPLACE FUNCTION increment_rate_limit(
  p_ip_address text,
  p_action text,
  p_window_minutes integer DEFAULT 1
)
RETURNS void AS $$
DECLARE
  v_window_start timestamp with time zone;
BEGIN
  -- Calculate window start (same logic as check)
  v_window_start := date_trunc('minute', now()) 
    - interval '1 minute' * (extract(minute from now())::int % p_window_minutes);
  
  -- Insert or update the rate limit log
  INSERT INTO rate_limit_logs (ip_address, action, window_start, request_count)
  VALUES (p_ip_address, p_action, v_window_start, 1)
  ON CONFLICT (ip_address, action, window_start)
  DO UPDATE SET 
    request_count = rate_limit_logs.request_count + 1,
    created_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: cleanup_old_rate_limits
-- Removes old rate limit entries (run via cron)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS integer AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM rate_limit_logs
  WHERE window_start < now() - interval '1 hour';
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add rate limit tracking to guestbook_messages table
-- This allows us to track which submissions were rate limited
ALTER TABLE guestbook_messages 
ADD COLUMN IF NOT EXISTS ip_address text,
ADD COLUMN IF NOT EXISTS rate_limited boolean DEFAULT false;

-- Create index for IP lookups
CREATE INDEX IF NOT EXISTS idx_guestbook_messages_ip 
  ON guestbook_messages(ip_address) 
  WHERE ip_address IS NOT NULL;

-- Function: submit_guestbook_message_with_rate_limit
-- Wrapper function that enforces rate limiting on guestbook submissions
CREATE OR REPLACE FUNCTION submit_guestbook_message_with_rate_limit(
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
) AS $$
DECLARE
  v_ip_address text;
  v_rate_check record;
  v_message_id uuid;
BEGIN
  -- Get client IP address
  v_ip_address := coalesce(
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    current_setting('request.headers', true)::json->>'x-real-ip',
    'unknown'
  );
  
  -- Check rate limit
  SELECT * INTO v_rate_check
  FROM check_rate_limit(v_ip_address, 'guestbook_submit', p_max_requests, p_window_minutes);
  
  -- If rate limited, return error
  IF NOT v_rate_check.allowed THEN
    RETURN QUERY SELECT
      false,
      null::uuid,
      format('Rate limit exceeded. Please wait %s seconds before submitting another message.', 
             v_rate_check.reset_after_seconds),
      0,
      v_rate_check.reset_after_seconds;
    RETURN;
  END IF;
  
  -- Increment rate limit counter
  PERFORM increment_rate_limit(v_ip_address, 'guestbook_submit', p_window_minutes);
  
  -- Insert the message
  INSERT INTO guestbook_messages (
    name,
    email,
    content,
    type,
    media_url,
    ip_address,
    reactions
  ) VALUES (
    p_name,
    p_email,
    p_content,
    p_type,
    p_media_url,
    v_ip_address,
    '{}'::jsonb
  )
  RETURNING id INTO v_message_id;
  
  -- Return success
  RETURN QUERY SELECT
    true,
    v_message_id,
    null::text,
    v_rate_check.remaining,
    v_rate_check.reset_after_seconds;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_rate_limit TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION increment_rate_limit TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION submit_guestbook_message_with_rate_limit TO anon, authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_rate_limits TO service_role;

-- Enable real-time for rate limit logs (for admin monitoring)
ALTER PUBLICATION supabase_realtime ADD TABLE rate_limit_logs;

COMMENT ON TABLE rate_limit_logs IS 'Tracks API request rates per IP for rate limiting';
COMMENT ON FUNCTION check_rate_limit IS 'Checks if a request is within rate limits';
COMMENT ON FUNCTION submit_guestbook_message_with_rate_limit IS 'Submits guestbook message with rate limiting enforcement';
