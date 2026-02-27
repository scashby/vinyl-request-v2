-- Enable playlist CRUD under RLS (no ownership column exists)
-- Apply in Supabase SQL editor.
-- Created: 2026-02-26

begin;

alter table public.collection_playlists enable row level security;
alter table public.collection_playlist_items enable row level security;

-- Ensure API roles have table privileges (RLS still applies).
grant select, insert, update, delete on public.collection_playlists to anon, authenticated;
grant select, insert, update, delete on public.collection_playlist_items to anon, authenticated;
grant usage, select on sequence public.collection_playlists_id_seq to anon, authenticated;
grant usage, select on sequence public.collection_playlist_items_id_seq to anon, authenticated;

-- Add CRUD policies if missing.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'collection_playlists'
      and policyname = 'collection_playlists_select_all'
  ) then
    create policy collection_playlists_select_all
      on public.collection_playlists
      for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'collection_playlists'
      and policyname = 'collection_playlists_insert_all'
  ) then
    create policy collection_playlists_insert_all
      on public.collection_playlists
      for insert
      to anon, authenticated
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'collection_playlists'
      and policyname = 'collection_playlists_update_all'
  ) then
    create policy collection_playlists_update_all
      on public.collection_playlists
      for update
      to anon, authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'collection_playlists'
      and policyname = 'collection_playlists_delete_all'
  ) then
    create policy collection_playlists_delete_all
      on public.collection_playlists
      for delete
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'collection_playlist_items'
      and policyname = 'collection_playlist_items_select_all'
  ) then
    create policy collection_playlist_items_select_all
      on public.collection_playlist_items
      for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'collection_playlist_items'
      and policyname = 'collection_playlist_items_insert_all'
  ) then
    create policy collection_playlist_items_insert_all
      on public.collection_playlist_items
      for insert
      to anon, authenticated
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'collection_playlist_items'
      and policyname = 'collection_playlist_items_update_all'
  ) then
    create policy collection_playlist_items_update_all
      on public.collection_playlist_items
      for update
      to anon, authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'collection_playlist_items'
      and policyname = 'collection_playlist_items_delete_all'
  ) then
    create policy collection_playlist_items_delete_all
      on public.collection_playlist_items
      for delete
      to anon, authenticated
      using (true);
  end if;
end $$;

commit;
