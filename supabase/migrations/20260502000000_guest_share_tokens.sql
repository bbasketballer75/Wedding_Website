CREATE TABLE IF NOT EXISTS public.guest_share_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for token lookups (public view by token)
CREATE INDEX IF NOT EXISTS idx_guest_share_tokens_token ON public.guest_share_tokens(token);

-- Index for email lookups (to check if token exists for email)
CREATE INDEX IF NOT EXISTS idx_guest_share_tokens_email ON public.guest_share_tokens(guest_email);

-- Row Level Security
ALTER TABLE public.guest_share_tokens ENABLE ROW LEVEL SECURITY;

-- Public can INSERT (create token on first upload)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'guest_share_tokens'
    and policyname = 'Public can create share token'
  ) then
    create policy "Public can create share token"
      on public.guest_share_tokens
      for insert to public with check (true);
  end if;
end
$$;

-- Public can SELECT by token (lookup for shared album page)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'guest_share_tokens'
    and policyname = 'Public can lookup share token'
  ) then
    create policy "Public can lookup share token"
      on public.guest_share_tokens
      for select to public using (true);
  end if;
end
$$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON public.guest_share_tokens TO anon, authenticated, service_role;
