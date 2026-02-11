-- Persistent playlists for edit-collection track mode
-- Created: 2026-02-11

create table if not exists public.collection_playlists (
  id bigint generated always as identity primary key,
  name text not null,
  icon text not null default '🎵',
  color text not null default '#3578b3',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.collection_playlist_items (
  id bigint generated always as identity primary key,
  playlist_id bigint not null references public.collection_playlists(id) on delete cascade,
  track_key text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (playlist_id, track_key)
);

create index if not exists idx_collection_playlists_sort_order
  on public.collection_playlists(sort_order);

create index if not exists idx_collection_playlist_items_playlist_sort
  on public.collection_playlist_items(playlist_id, sort_order);
