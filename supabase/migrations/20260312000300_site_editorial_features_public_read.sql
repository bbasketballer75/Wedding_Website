do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_editorial_features'
      and policyname = 'Public users can read active editorial features'
  ) then
    create policy "Public users can read active editorial features"
      on public.site_editorial_features
      for select
      to anon
      using (is_active = true);
  end if;
end
$$;
