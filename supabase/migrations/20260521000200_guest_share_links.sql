-- ============================================================================
-- Migration: Guest Share Links
-- Date: 2026-05-21
-- Description: Creates guest_share_tokens table for persistent guest sharing URLs.
-- ============================================================================

-- Create guest_share_tokens table
create table if not exists public.guest_share_tokens (
  id uuid default gen_random_uuid() primary key,
  guest_email text not null unique,
  token text not null unique,
  created_at timestamp with time zone default now() not null
);

-- Enable RLS
alter table public.guest_share_tokens enable row level security;

-- RLS policies for guest_share_tokens
create policy "Allow public read on guest_share_tokens" on public.guest_share_tokens
  for select using (true);

create policy "Allow public insert on guest_share_tokens" on public.guest_share_tokens
  for insert with check (true);

create policy "Allow admin full access on guest_share_tokens" on public.guest_share_tokens
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Indexes for performance optimization
create index if not exists idx_guest_share_tokens_email on public.guest_share_tokens(guest_email);
create index if not exists idx_guest_share_tokens_token on public.guest_share_tokens(token);
