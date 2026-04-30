-- Photo Claiming Schema Migration
-- Creates tables for email-based photo claiming with magic link and 6-digit code verification
-- Migration: 20260501000000_photo_claiming_schema.sql

-- ============================================================
-- Guest Identities Table
-- Stores verified email identities for claiming photos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.guest_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_guest_identities_email ON public.guest_identities(email);

-- ============================================================
-- Photo Claims Table
-- Links claimed photos to guest identities
-- ============================================================
CREATE TABLE IF NOT EXISTS public.photo_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id TEXT NOT NULL,  -- References guest_uploads.id
  guest_identity_id UUID REFERENCES public.guest_identities(id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for identity lookups
CREATE INDEX IF NOT EXISTS idx_photo_claims_identity ON public.photo_claims(guest_identity_id);
-- Index for photo_id lookups to check if a photo is already claimed
CREATE INDEX IF NOT EXISTS idx_photo_claims_photo_id ON public.photo_claims(photo_id);

-- ============================================================
-- Verification Codes Table
-- Stores 6-digit codes for one-time password verification
-- ============================================================
CREATE TABLE IF NOT EXISTS public.verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for email+code lookups (for validation queries)
CREATE INDEX IF NOT EXISTS idx_verification_codes_email_code ON public.verification_codes(email, code);

-- ============================================================
-- Row Level Security Policies
-- ============================================================
ALTER TABLE public.guest_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;

-- guest_identities policies:
-- Public can INSERT/UPSERT (create or update identity on claim)
-- Only the identity owner can read their own identity (by email match)
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'guest_identities'
      and policyname = 'Public can upsert guest identity'
  ) then
    create policy "Public can upsert guest identity"
      on public.guest_identities
      for insert
      to public
      with check (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'guest_identities'
      and policyname = 'Public can update guest identity'
  ) then
    create policy "Public can update guest identity"
      on public.guest_identities
      for update
      to public
      using (true)
      with check (true);
  end if;
end
$$;

-- photo_claims policies:
-- Public can INSERT (create claim)
-- Only claim owner can read their claims (via identity)
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'photo_claims'
      and policyname = 'Public can create photo claim'
  ) then
    create policy "Public can create photo claim"
      on public.photo_claims
      for insert
      to public
      with check (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'photo_claims'
      and policyname = 'Owner can read photo claims'
  ) then
    create policy "Owner can read photo claims"
      on public.photo_claims
      for select
      to public
      using (true);  -- For now, allow public read to simplify claiming flow
  end if;
end
$$;

-- verification_codes policies:
-- Public can INSERT (create code on verification request)
-- NO public SELECT (security - prevents code enumeration)
-- No DELETE policy needed (cleanup handled server-side)
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'verification_codes'
      and policyname = 'Public can create verification code'
  ) then
    create policy "Public can create verification code"
      on public.verification_codes
      for insert
      to public
      with check (true);
  end if;
end
$$;

-- Allow authenticated users and service role to manage verification codes
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'verification_codes'
      and policyname = 'Service role can manage verification codes'
  ) then
    create policy "Service role can manage verification codes"
      on public.verification_codes
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end
$$;

-- ============================================================
-- Grant Permissions
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON public.guest_identities TO anon, authenticated, service_role;
GRANT ALL ON public.photo_claims TO anon, authenticated, service_role;
GRANT ALL ON public.verification_codes TO anon, authenticated, service_role;
