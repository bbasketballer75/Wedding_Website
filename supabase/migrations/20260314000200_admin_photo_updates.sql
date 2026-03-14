do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'photos'
      and policyname = 'Admin users update photos'
  ) then
    create policy "Admin users update photos"
      on public.photos
      for update
      using (coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin')
      with check (coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin');
  end if;
end
$$;
