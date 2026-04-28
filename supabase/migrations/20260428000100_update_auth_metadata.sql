-- Create a wrapper function to update auth user metadata
CREATE OR REPLACE FUNCTION public.update_auth_user_metadata(uid uuid, metadata jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = auth
AS $$
BEGIN
  -- Update auth.users directly
  UPDATE auth.users
  SET user_metadata = metadata
  WHERE id = uid;
END;
$$;
