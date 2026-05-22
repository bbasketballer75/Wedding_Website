-- ============================================================================
-- Migration: Photo Claiming & Guest Identities
-- Date: 2026-05-21
-- Description: Creates guest_identities and photo_claims tables for the guest experience.
-- ============================================================================

-- Create guest_identities table
create table if not exists public.guest_identities (
  id uuid default gen_random_uuid() primary key,
  email text not null unique,
  session_id text,
  display_name text not null,
  is_verified boolean default false not null,
  created_at timestamp with time zone default now() not null
);

-- Create photo_claims table
create table if not exists public.photo_claims (
  id uuid default gen_random_uuid() primary key,
  guest_identity_id uuid not null references public.guest_identities(id) on delete cascade,
  photo_id uuid references public.photos(id) on delete cascade,
  face_id uuid references public.media_review_faces(id) on delete set null,
  claim_type text not null check (claim_type in ('upload', 'face')),
  status text default 'pending' not null check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint unique_identity_photo unique(guest_identity_id, photo_id),
  constraint unique_identity_face unique(guest_identity_id, face_id)
);

-- Enable RLS
alter table public.guest_identities enable row level security;
alter table public.photo_claims enable row level security;

-- RLS policies for guest_identities
create policy "Allow public insert on guest_identities" on public.guest_identities
  for insert with check (true);

create policy "Allow public read on guest_identities" on public.guest_identities
  for select using (true);

create policy "Allow admin full access on guest_identities" on public.guest_identities
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- RLS policies for photo_claims
create policy "Allow public insert on photo_claims" on public.photo_claims
  for insert with check (true);

create policy "Allow public read on photo_claims" on public.photo_claims
  for select using (true);

create policy "Allow admin full access on photo_claims" on public.photo_claims
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Indexes for performance optimization
create index if not exists idx_guest_identities_email on public.guest_identities(email);
create index if not exists idx_photo_claims_status on public.photo_claims(status);
create index if not exists idx_photo_claims_guest_identity on public.photo_claims(guest_identity_id);
create index if not exists idx_photo_claims_photo_id on public.photo_claims(photo_id);
create index if not exists idx_photo_claims_face_id on public.photo_claims(face_id);

-- Alter moderation_audit_log check constraint to allow 'photo_claim'
alter table public.moderation_audit_log drop constraint if exists moderation_audit_log_entity_type_check;
alter table public.moderation_audit_log add constraint moderation_audit_log_entity_type_check check (entity_type in ('guest_upload', 'guestbook_message', 'photo_claim'));

